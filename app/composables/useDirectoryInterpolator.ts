import { ref } from 'vue'
import { useAppStore } from '~~/stores/appStore'

export interface DirectoryLookupItem {
    id: string
    code: string
    title: string
    directorySlug?: string
    role?: string
    department?: string
    phone?: string
    raw: Record<string, any>
}

// Список всех слаг-идентификаторов справочников платформы
const ALL_DIRECTORY_SLUGS = [
    'departments',
    'counterparties',
    'bank_accounts',
    'nomenclature',
    'glossary'
]

export function useDirectoryInterpolator() {
    const appStore = useAppStore()
    const directoryCache = new Map<string, DirectoryLookupItem[]>()
    const loading = ref(false)

    const getEnterpriseId = (): string => {
        return String(appStore.getEnterpriseId() || '')
    }

    // Загрузка элементов конкретного справочника с кэшированием
    const fetchDirectoryItems = async (slug: string): Promise<DirectoryLookupItem[]> => {
        const enterpriseId = getEnterpriseId()
        if (!enterpriseId) return []

        const cacheKey = `${enterpriseId}_${slug}`
        if (directoryCache.has(cacheKey)) {
            return directoryCache.get(cacheKey)!
        }

        try {
            const items = await $fetch<any[]>('/api/directory/items', {
                query: { enterpriseId, directorySlug: slug }
            })

            const normalized: DirectoryLookupItem[] = (items || []).map((item) => ({
                id: String(item._id || ''),
                code: String(item.code || '').trim(),
                title: item.title,
                directorySlug: slug,
                role: item.attributes?.role ? String(item.attributes.role) : undefined,
                department: item.attributes?.department ? String(item.attributes.department) : undefined,
                phone: item.attributes?.phone ? String(item.attributes.phone) : undefined,
                raw: item.attributes || {}
            }))

            directoryCache.set(cacheKey, normalized)
            return normalized
        } catch (e) {
            console.error(`[DirectoryInterpolator] Ошибка выборки ${slug}:`, e)
            return []
        }
    }

    // Загрузка абсолютно всех справочников предприятия разом (для сквозного поиска)
    const fetchAllDirectories = async (): Promise<DirectoryLookupItem[]> => {
        loading.value = true
        try {
            const results = await Promise.all(ALL_DIRECTORY_SLUGS.map((slug) => fetchDirectoryItems(slug)))
            return results.flat()
        } finally {
            loading.value = false
        }
    }

    const resolveSlug = (alias: string): string => {
        const clean = alias.toLowerCase().trim()
        if (clean.includes('сотрудник') || clean.includes('штат') || clean.includes('отдел')) return 'departments'
        if (clean.includes('клиент') || clean.includes('контрагент') || clean.includes('партнер')) return 'counterparties'
        if (clean.includes('банк') || clean.includes('счет')) return 'bank_accounts'
        if (clean.includes('товар') || clean.includes('номенклатур')) return 'nomenclature'
        if (clean.includes('термин') || clean.includes('глоссарий')) return 'glossary'
        return clean
    }

    /**
     * Разрешение переменной:
     * 1. Прямой ID/код: {@DEV_1}, {@044525225}, {@770101001}
     * 2. Путь через точку: {@Сотрудники.Управляющий}, {@Банк.RUB}
     */
    const resolveVariable = async (
        expression: string
    ): Promise<{ directValue?: string; candidates?: DirectoryLookupItem[] }> => {
        const cleanExpr = expression.replace(/^\{@|\}$/g, '').trim()
        if (!cleanExpr) return {}

        // ─────────────────────────────────────────────────────────────
        // СЛУЧАЙ 1: Прямой поиск по ID / Коду (без точки, например: {@DEV_1})
        // ─────────────────────────────────────────────────────────────
        if (!cleanExpr.includes('.')) {
            const allItems = await fetchAllDirectories()
            const searchTarget = cleanExpr.toLowerCase()

            // Ищем точное совпадение по code или Mongo _id
            const matched = allItems.filter((item) => {
                const matchCode = item.code.toLowerCase() === searchTarget
                const matchId = item.id.toLowerCase() === searchTarget
                return matchCode || matchId
            })

            if (matched.length === 0) {
                // Если точного нет, пробуем частичное вхождение по названию
                const fuzzy = allItems.filter(item => item.title.toLowerCase().includes(searchTarget))
                if (fuzzy.length === 1) return { directValue: fuzzy[0].title }
                if (fuzzy.length > 1) return { candidates: fuzzy }

                return { directValue: `[Не найдено: ${cleanExpr}]` }
            }

            if (matched.length === 1) {
                return { directValue: matched[0].title }
            }

            // Если в разных справочниках случайно совпал одинаковый ID/код
            return { candidates: matched }
        }

        // ─────────────────────────────────────────────────────────────
        // СЛУЧАЙ 2: Поиск по разделу и фильтру (с точкой, например: {@Сотрудники.Управляющий})
        // ─────────────────────────────────────────────────────────────
        const [rawSlug, filter] = cleanExpr.split('.').map((s) => s.trim())
        const slug = resolveSlug(rawSlug)
        const items = await fetchDirectoryItems(slug)

        if (!items.length) {
            return { directValue: `[Не найдено в ${rawSlug}]` }
        }

        if (!filter) {
            return items.length === 1 ? { directValue: items[0].title } : { candidates: items }
        }

        const filterTarget = filter.toLowerCase()
        const matched = items.filter((item) => {
            const matchRole = item.role?.toLowerCase() === filterTarget
            const matchDept = item.department?.toLowerCase() === filterTarget
            const matchCode = item.code.toLowerCase() === filterTarget
            const matchId = item.id.toLowerCase() === filterTarget
            const matchTitle = item.title.toLowerCase().includes(filterTarget)
            return matchRole || matchDept || matchCode || matchId || matchTitle
        })

        if (matched.length === 0) {
            return { directValue: `[${filter} не найден]` }
        }

        if (matched.length === 1) {
            return { directValue: matched[0].title }
        }

        return { candidates: matched }
    }

    return {
        fetchDirectoryItems,
        fetchAllDirectories,
        resolveVariable,
        loading
    }
}