import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { useAppStore } from './appStore'

export type DocType = 'excel' | 'word' | 'pdf' | 'primary' | 'image'
export type DocData = Record<string, any> | string
export type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export interface SpaceFolder {
    id: string
    name: string
    parentId: string | null
}

export interface DocMeta {
    id: string
    folderId: string | null
    name: string
    type: DocType
    size: number
    createdAt: number
    updatedAt: number
}

export interface SpaceDocument extends DocMeta {
    data: DocData
    loadState: LoadState
}

export interface DocVersionMeta {
    id: string
    createdAt: number
    comment: string
    size: number
}

export const useWorkspaceStore = defineStore('workspace', () => {
    const appStore = useAppStore()

    // ── Структура пространства ──
    const folders = ref<SpaceFolder[]>([])
    const documents = shallowRef<SpaceDocument[]>([])
    const isLoading = ref(false)
    const isLoaded = ref(false)
    const loadError = ref<string | null>(null)

    // ── Навигация и открытые документы ──
    const activeFolderId = ref<string | null>(null)
    const openIds = ref<string[]>([])
    const activeId = ref<string | null>(null)

    // ── Очередь фонового автосохранения ──
    const dirty = new Set<string>()
    const inflight = new Map<string, Promise<void>>()
    const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const lastSavedAt = ref<number | null>(null)
    // Последняя ошибка сохранения или загрузки. Интерфейс показывает её пользователю.
    const lastError = ref<string | null>(null)
    let persistTimer: ReturnType<typeof setTimeout> | null = null

    const activeDocument = computed(() => documents.value.find(d => d.id === activeId.value))
    const openDocuments = computed(() =>
        openIds.value
            .map(id => documents.value.find(d => d.id === id))
            .filter((d): d is SpaceDocument => !!d)
    )

    const getEntId = (): string => {
        return appStore.getEnterpriseId() || ''
    }

    // ── Загрузка структуры (папки + метаданные документов) ──
    const loadWorkspace = async (force = false) => {
        const enterpriseId = getEntId()
        if (!enterpriseId) return
        if (!force && isLoaded.value) return

        isLoading.value = true
        loadError.value = null

        try {
            const [foldersRes, docsRes] = await Promise.all([
                $fetch<SpaceFolder[]>('/api/workspace/folders', { query: { enterpriseId } }),$fetch<DocMeta[]>('/api/workspace/documents', { query: { enterpriseId } })
            ])

            folders.value = foldersRes || []
            documents.value = (docsRes || []).map(meta => ({
                ...meta,
                data: meta.type === 'word' || meta.type === 'pdf' || meta.type === 'image' ? '' : {},
                loadState: 'idle'
            }))

            isLoaded.value = true
        } catch (e: any) {
            loadError.value = e?.data?.message || 'Не удалось загрузить пространство'
            console.error('[WorkspaceStore] Ошибка загрузки:', e)
        } finally {
            isLoading.value = false
        }
    }

    // ── Подгрузка содержимого конкретного документа ──
    const loadDocumentContent = async (docId: string) => {
        const doc = documents.value.find(d => d.id === docId)
        if (!doc || doc.loadState === 'loaded' || doc.loadState === 'loading') return

        doc.loadState = 'loading'
        const enterpriseId = getEntId()

        try {
            const res = await $fetch<DocMeta & { data: DocData }>(`/api/workspace/documents/${docId}`, {
                query: { enterpriseId }
            })
            doc.data = res.data
            doc.loadState = 'loaded'
            documents.value = [...documents.value]
        } catch (e: any) {
            doc.loadState = 'error'
            lastError.value = e?.data?.message || 'Не удалось загрузить документ из базы'
            documents.value = [...documents.value]
        }
    }

    // ── Сетевое сохранение одного документа ──
    const runSave = async (docId: string): Promise<void> => {
        const running = inflight.get(docId)
        if (running) return running

        const enterpriseId = getEntId()
        const task = (async () => {
            try {
                while (dirty.has(docId)) {
                    const doc = documents.value.find(d => d.id === docId)
                    dirty.delete(docId)
                    if (!doc || doc.loadState !== 'loaded') break

                    try {
                        await $fetch(`/api/workspace/documents/${docId}`, {
                            method: 'PATCH',
                            query: { enterpriseId },
                            body: { data: doc.data }
                        })
                    } catch (e: any) {
                        if (e?.statusCode === 404) {
                            // Документа на сервере уже нет: убираем его из интерфейса, чтобы не было «призрака»
                            dirty.delete(docId)
                            documents.value = documents.value.filter(d => d.id !== docId)
                            openIds.value = openIds.value.filter(id => id !== docId)
                            if (activeId.value === docId) activeId.value = openIds.value[openIds.value.length - 1] || null
                            lastError.value = 'Документ удалён на сервере. Его изменения не сохранены'
                            break
                        }
                        dirty.add(docId)
                        lastError.value = e?.data?.message || e?.statusMessage || 'Изменения не сохранены: база не ответила'
                        saveState.value = 'error'
                        throw e
                    }
                }
            } finally {
                inflight.delete(docId)
            }
        })()

        inflight.set(docId, task)
        return task
    }

    // ── Сохранение всех накопленных изменений ──
    const flushAll = async (): Promise<boolean> => {
        if (persistTimer) {
            clearTimeout(persistTimer)
            persistTimer = null
        }

        const ids = new Set([...dirty, ...inflight.keys()])
        if (!ids.size) return true

        saveState.value = 'saving'
        const results = await Promise.allSettled([...ids].map(runSave))
        const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')

        if (failed) {
            saveState.value = 'error'
            return false
        }

        saveState.value = dirty.size ? 'saving' : 'saved'
        if (!dirty.size) {
            lastSavedAt.value = Date.now()
        }
        return true
    }

    // ── Немедленное сохранение конкретного документа ──
    const flushDoc = async (docId: string) => {
        if (dirty.has(docId) || inflight.has(docId)) {
            saveState.value = 'saving'
            try {
                await runSave(docId)
                if (!dirty.size) {
                    saveState.value = 'saved'
                    lastSavedAt.value = Date.now()
                }
            } catch {
                saveState.value = 'error'
            }
        }
    }

    const schedulePersist = (delay = 700) => {
        if (persistTimer) clearTimeout(persistTimer)
        persistTimer = setTimeout(() => {
            persistTimer = null
            void flushAll()
        }, delay)
    }

    // ── Сохранение при выгрузке страницы браузера ──
    const flushKeepalive = () => {
        const enterpriseId = getEntId()
        if (!enterpriseId || !dirty.size) return

        for (const docId of dirty) {
            const doc = documents.value.find(d => d.id === docId)
            if (!doc || doc.loadState !== 'loaded') continue

            try {
                void fetch(`/api/workspace/documents/${docId}?enterpriseId=${encodeURIComponent(enterpriseId)}`, {
                    method: 'PATCH',
                    keepalive: true,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: doc.data })
                }).catch(() => {})
            } catch {}
        }
    }

    // ── Управление вкладками ──
    const openDoc = (docId: string) => {
        if (!openIds.value.includes(docId)) {
            openIds.value.push(docId)
        }
        activeId.value = docId
        void loadDocumentContent(docId)
    }

    const closeDoc = (docId: string) => {
        // Мгновенно сохраняем документ при закрытии вкладки
        void flushDoc(docId)

        const index = openIds.value.indexOf(docId)
        if (index === -1) return
        openIds.value.splice(index, 1)

        if (activeId.value === docId) {
            activeId.value = openIds.value[openIds.value.length - 1] || null
        }
    }

    // ── Мутации документов ──
    const updateDocData = (docId: string, data: DocData) => {
        const doc = documents.value.find(d => d.id === docId)
        if (!doc) return

        doc.data = data
        doc.updatedAt = Date.now()
        dirty.add(docId)
        saveState.value = 'saving'
        schedulePersist()
    }

    const resetState = () => {
        void flushAll()
        folders.value = []
        documents.value = []
        openIds.value = []
        activeId.value = null
        activeFolderId.value = null
        isLoaded.value = false
        dirty.clear()
        inflight.clear()
    }

    return {
        folders,
        documents,
        isLoading,
        isLoaded,
        loadError,
        activeFolderId,
        openIds,
        activeId,
        activeDocument,
        openDocuments,
        saveState,
        lastSavedAt,
        lastError,
        loadWorkspace,
        loadDocumentContent,
        openDoc,
        closeDoc,
        updateDocData,
        flushAll,
        flushDoc,
        flushKeepalive,
        resetState
    }
})