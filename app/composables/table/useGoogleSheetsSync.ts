// composables/table/useGoogleSheetsSync.ts
// Движок двусторонней синхронизации листов MoloTable с вкладками Google Таблиц.
//
// Цикл (syncLink):
//   1. читаем локальный лист и текущее состояние Google
//   2. трёхсторонний merge с базой (planSync)
//   3. изменения из Google применяем локально (с заглушенными событиями, чтобы не было эха)
//   4. изменения локальные отправляем в Google; при успехе база = итоговое состояние
//
// Запуск цикла: по опросу (раз в N секунд), после локальных правок (с задержкой), вручную.
// Один лист — один цикл в момент времени; запросы во время цикла схлопываются в один повторный.

import { reactive } from 'vue'
import {
    applyChanges,
    diffAll,
    groupSegments,
    planSync,
    segmentRange,
    trimMatrix,
    type CellChange,
    type GSheetsLink,
    type LinkMode,
    type Matrix,
} from '~/utils/gsheetsSync'
import { useAppStore } from "~~/stores/appStore";

export interface LinkStatus {
    busy: boolean
    lastSyncAt?: string
    lastConflicts?: number
    lastError?: string
}

export interface GSheetsEngineOptions {
    /** Текущие значения локального листа (полная прямоугольная матрица) или null, если лист не найден */
    readLocal: (link: GSheetsLink) => Matrix | null
    /** Применить изменения к локальному листу (вызывается с заглушенными событиями) */
    writeLocal: (link: GSheetsLink, changes: CellChange[]) => void
    /** Сохранить связи в документ (вызывается только когда изменилась база или состав связей) */
    persist: () => void
    /** Задержка перед синхронизацией после локальной правки, мс */
    debounceMs?: number
}

const PUSH_CHUNK = 200

export function resolveEnterpriseId(): string {
    const appStore = useAppStore()
    const fromStore = String(appStore.getEnterpriseId?.() || '').trim()
    if (/^[a-f\d]{24}$/i.test(fromStore)) return fromStore
    if (import.meta.client) {
        try {
            const raw = localStorage.getItem('currentEnterprise')
            const e = raw ? JSON.parse(raw) : null
            const id = String(e?._id || e?.id || '').trim()
            if (/^[a-f\d]{24}$/i.test(id)) return id
        } catch {
            // игнорируем повреждённые данные в localStorage
        }
    }
    throw new Error('Не найден идентификатор предприятия')
}

export function errorMessage(e: any): string {
    return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || e?.message || 'Ошибка синхронизации'
}

export function createGSheetsEngine(opts: GSheetsEngineOptions) {
    const status = reactive<Record<string, LinkStatus>>({})
    const running = new Set<string>()
    const rerun = new Set<string>()
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    let muted = false

    const st = (id: string): LinkStatus => {
        if (!status[id]) status[id] = { busy: false }
        return status[id]!
    }

    async function fetchRemote(link: GSheetsLink): Promise<Matrix> {
        const res = await $fetch<{ values: Matrix }>('/api/gsheets/values', {
            query: {
                enterpriseId: resolveEnterpriseId(),
                spreadsheetId: link.spreadsheetId,
                sheet: link.sheetTitle,
            },
        })
        return res.values || []
    }

    async function pushRemote(link: GSheetsLink, changes: CellChange[]) {
        const enterpriseId = resolveEnterpriseId()
        const data = groupSegments(changes).map((seg) => ({
            range: segmentRange(link.sheetTitle, seg),
            values: [seg.values],
        }))
        for (let i = 0; i < data.length; i += PUSH_CHUNK) {
            await $fetch('/api/gsheets/values', {
                method: 'POST',
                query: { enterpriseId },
                body: { spreadsheetId: link.spreadsheetId, data: data.slice(i, i + PUSH_CHUNK) },
            })
        }
    }

    function writeLocalMuted(link: GSheetsLink, changes: CellChange[]) {
        if (!changes.length) return
        muted = true
        try {
            opts.writeLocal(link, changes)
        } finally {
            muted = false
        }
    }

    /** Полный цикл синхронизации одной связи */
    async function syncLink(link: GSheetsLink): Promise<void> {
        if (running.has(link.id)) {
            rerun.add(link.id)
            return
        }
        running.add(link.id)
        st(link.id).busy = true

        try {
            const local = opts.readLocal(link)
            if (!local) throw new Error('Лист таблицы не найден (возможно, его удалили)')

            const remote = await fetchRemote(link)
            const prevBase: Matrix = link.base || []
            const plan = planSync(local, remote, prevBase)

            // 1) входящие изменения из Google — применяем локально
            writeLocalMuted(link, plan.pull)
            const pulledBase = applyChanges(prevBase, plan.pull)

            // 2) исходящие изменения — отправляем в Google
            let pushError = ''
            try {
                if (plan.push.length) await pushRemote(link, plan.push)
            } catch (e) {
                pushError = errorMessage(e)
            }

            // База: при успешной отправке — итоговое состояние; иначе только принятые из Google изменения,
            // чтобы локальные правки остались «грязными» и уйдут в следующем цикле.
            const nextBase = !pushError ? plan.merged : pulledBase
            const baseChanged = JSON.stringify(nextBase) !== JSON.stringify(prevBase)
            link.base = trimMatrix(nextBase)

            const s = st(link.id)
            s.lastSyncAt = new Date().toISOString()
            s.lastConflicts = plan.conflicts
            s.lastError = pushError || undefined

            if (baseChanged) opts.persist()
        } catch (e) {
            st(link.id).lastError = errorMessage(e)
        } finally {
            running.delete(link.id)
            st(link.id).busy = false
            if (rerun.delete(link.id)) void syncLink(link)
        }
    }

    /** Отложенный запуск: несколько правок подряд дают один цикл */
    function requestSync(link: GSheetsLink, delayMs = opts.debounceMs ?? 1500) {
        const prev = timers.get(link.id)
        if (prev) clearTimeout(prev)
        timers.set(link.id, setTimeout(() => {
            timers.delete(link.id)
            void syncLink(link)
        }, delayMs))
    }

    /**
     * Первичная привязка:
     *  - replace-local:  локальный лист становится копией Google; база = Google
     *  - replace-remote: Google становится копией MoloTable; база = Google, далее пушим различия
     *  - merge:          база пустая; объединение, при конфликте побеждает MoloTable
     */
    async function initLink(link: GSheetsLink, mode: LinkMode): Promise<void> {
        const remote = await fetchRemote(link)
        if (mode === 'replace-local') {
            const local = opts.readLocal(link) || []
            writeLocalMuted(link, diffAll(local, remote))
            link.base = trimMatrix(remote)
        } else if (mode === 'replace-remote') {
            link.base = trimMatrix(remote)
        } else {
            link.base = []
        }
        opts.persist()
        await syncLink(link)
    }

    function dispose() {
        for (const t of timers.values()) clearTimeout(t)
        timers.clear()
        rerun.clear()
    }

    return {
        status,
        syncLink,
        requestSync,
        initLink,
        dispose,
        /** true, пока идёт запись в локальный лист из синхронизации — правки не должны запускать новый цикл */
        isMuted: () => muted,
        isSyncing: (id: string) => Boolean(status[id]?.busy),
    }
}
