
export interface RawModuleData {
    _id: string
    name: string
    fileName?: string
    description?: string
    format: 'vue' | 'js' | 'ts'
    version?: number
    isPublic?: boolean
    isOfficial?: boolean
    tags?: string[]
    serverEntry?: string
    composables?: string[]
    code: string
    files: any[]
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
}

interface RawCacheEntry {
    data: RawModuleData | null
    fetchedAt: number
    inFlight: Promise<RawModuleData> | null
}

interface CompiledCacheEntry {
    component: any
    dynamicComponents: Record<string, any>
    css: string
    signature: string
    compiledAt: number
    inFlight: Promise<CompiledResult> | null
}

export interface CompiledResult {
    component: any
    dynamicComponents: Record<string, any>
    css: string
    signature: string
}

// Сколько живут "сырые" данные без ревалидации метаданных.
// Если модуль открыли раньше и он ещё не устарел — не ходим в сеть вообще.
const RAW_TTL_MS = 5 * 60 * 1000

const rawCache = new Map<string, RawCacheEntry>()
const compiledCache = new Map<string, CompiledCacheEntry>()

// Сколько активных (смонтированных) окон сейчас используют модуль.
// Нужно, чтобы не удалять <style> одного окна из-за unmount другого.
const activeInstanceCount = new Map<string, number>()

/**
 * Быстрый некриптографический хэш — нужен только чтобы понять,
 * "тот же самый код/файлы/зависимости или нет", а не для безопасности.
 */
function hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0
    }
    return hash.toString(36)
}

export function makeModuleSignature(
    code: string,
    files: any[] = [],
    dependencies: Record<string, string> = {},
    version?: number | string
): string {
    const filesPart = files
        .map((f: any) => `${f.path || f.name}:${f.code?.length || 0}`)
        .join('|')
    const depsPart = Object.entries(dependencies || {})
        .map(([k, v]) => `${k}@${v}`)
        .join('|')

    // Версия из БД — самый дешёвый и надёжный признак изменения,
    // хэш кода — подстраховка на случай, если version не обновляется.
    return `v${version ?? '0'}:${hashString(code + '::' + filesPart + '::' + depsPart)}`
}

export function useModuleCache() {
    return {
        // ---------- RAW ----------

        getRaw(moduleId: string): RawCacheEntry | null {
            return rawCache.get(moduleId) || null
        },

        isRawFresh(moduleId: string): boolean {
            const entry = rawCache.get(moduleId)
            return !!entry?.data && Date.now() - entry.fetchedAt < RAW_TTL_MS
        },

        setRawInFlight(moduleId: string, promise: Promise<RawModuleData>) {
            const existing = rawCache.get(moduleId)
            rawCache.set(moduleId, {
                data: existing?.data || null,
                fetchedAt: existing?.fetchedAt || 0,
                inFlight: promise
            })
        },

        setRawData(moduleId: string, data: RawModuleData) {
            rawCache.set(moduleId, {
                data,
                fetchedAt: Date.now(),
                inFlight: null
            })
        },

        // ---------- COMPILED ----------

        getCompiled(moduleId: string): CompiledCacheEntry | null {
            return compiledCache.get(moduleId) || null
        },

        isCompiledFresh(moduleId: string, signature: string): boolean {
            const entry = compiledCache.get(moduleId)
            return !!entry?.component && entry.signature === signature
        },

        setCompiledInFlight(moduleId: string, promise: Promise<CompiledResult>) {
            const existing = compiledCache.get(moduleId)
            compiledCache.set(moduleId, {
                component: existing?.component || null,
                dynamicComponents: existing?.dynamicComponents || {},
                css: existing?.css || '',
                signature: existing?.signature || '',
                compiledAt: existing?.compiledAt || 0,
                inFlight: promise
            })
        },

        setCompiledResult(moduleId: string, result: CompiledResult) {
            compiledCache.set(moduleId, {
                ...result,
                compiledAt: Date.now(),
                inFlight: null
            })
        },

        // ---------- ИНВАЛИДАЦИЯ ----------

        invalidate(moduleId: string) {
            rawCache.delete(moduleId)
            compiledCache.delete(moduleId)
        },

        invalidateAll() {
            rawCache.clear()
            compiledCache.clear()
        },

        // ---------- РЕФКАУНТ АКТИВНЫХ ОКОН (для стилей) ----------

        acquireInstance(moduleId: string): number {
            const next = (activeInstanceCount.get(moduleId) || 0) + 1
            activeInstanceCount.set(moduleId, next)
            return next
        },

        releaseInstance(moduleId: string): number {
            const next = Math.max(0, (activeInstanceCount.get(moduleId) || 0) - 1)
            if (next === 0) {
                activeInstanceCount.delete(moduleId)
            } else {
                activeInstanceCount.set(moduleId, next)
            }
            return next
        },

        hasActiveInstances(moduleId: string): boolean {
            return (activeInstanceCount.get(moduleId) || 0) > 0
        }
    }
}