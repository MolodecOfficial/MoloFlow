import { ref } from 'vue'
import { useAppStore } from '~~/stores/appStore'

export interface DirectoryLookupItem {
    id: string
    code: string
    title: string
    directorySlug: string
    role?: string
    department?: string
    phone?: string
    inn?: string
    kpp?: string
    bik?: string
    accountNumber?: string
    address?: string
    director?: string
    price?: number
    unit?: string
    raw: Record<string, any>
    availableFields: Array<{ key: string; label: string; value: string }>
}

export interface CustomDirectoryDefinition {
    slug: string
    title: string
    aliases: string[]
    codeLabel?: string
    titleLabel?: string
    groupByKey?: string
    fields: Array<{
        key: string
        label: string
        type?: string
        required?: boolean
        placeholder?: string
        span?: 1 | 2
        options?: Array<{ label: string; value: any }>
    }>
}

const SYSTEM_SLUGS = [
    'departments',
    'counterparties',
    'bank_accounts',
    'nomenclature',
    'glossary'
]

const FIELD_DICTIONARY: Record<string, string> = {
    title: 'Наименование / ФИО',
    code: 'Код / Артикул',
    inn: 'ИНН',
    kpp: 'КПП',
    ogrn: 'ОГРН',
    phone: 'Телефон',
    email: 'Email',
    legalAddress: 'Юридический адрес',
    address: 'Адрес',
    director: 'Руководитель',
    bankName: 'Банк',
    bik: 'БИК Банка',
    accountNumber: 'Расчётный счёт',
    corrAccount: 'Корр. счёт',
    swift: 'SWIFT',
    currency: 'Валюта',
    basePrice: 'Цена',
    unit: 'Ед. изм.',
    vatRate: 'НДС',
    department: 'Отдел',
    role: 'Должность / Роль'
}

export function useDirectoryInterpolator() {
    const appStore = useAppStore()
    const directoryCache = new Map<string, DirectoryLookupItem[]>()
    const customDefs = ref<CustomDirectoryDefinition[]>([])
    const loading = ref(false)

    const getEnterpriseId = (): string => String(appStore.getEnterpriseId() || '')

    const fetchDefinitions = async (): Promise<CustomDirectoryDefinition[]> => {
        const enterpriseId = getEnterpriseId()
        if (!enterpriseId) return []
        try {
            const data = await $fetch<CustomDirectoryDefinition[]>('/api/directory/definitions', {
                query: { enterpriseId }
            })
            customDefs.value = data || []
            return customDefs.value
        } catch {
            return []
        }
    }

    const normalizeItem = (item: any, slug: string): DirectoryLookupItem => {
        const raw = item.attributes || {}
        const def = customDefs.value.find((d) => d.slug === slug)

        const labelMap: Record<string, string> = { ...FIELD_DICTIONARY }
        if (def?.fields) {
            for (const f of def.fields) {
                labelMap[f.key] = f.label
            }
        }

        const fields: Array<{ key: string; label: string; value: string }> = [
            { key: 'title', label: def?.titleLabel || labelMap.title, value: String(item.title || '') }
        ]

        if (item.code) {
            fields.push({ key: 'code', label: def?.codeLabel || labelMap.code, value: String(item.code) })
        }

        for (const [k, v] of Object.entries(raw)) {
            if (v !== null && v !== undefined && String(v).trim() !== '') {
                fields.push({
                    key: k,
                    label: labelMap[k] || k,
                    value: String(v)
                })
            }
        }

        return {
            id: String(item._id || ''),
            code: String(item.code || '').trim(),
            title: item.title,
            directorySlug: slug,
            role: raw.role ? String(raw.role) : undefined,
            department: raw.department ? String(raw.department) : undefined,
            phone: raw.phone ? String(raw.phone) : undefined,
            inn: raw.inn ? String(raw.inn) : (slug === 'counterparties' && item.code ? item.code : undefined),
            kpp: raw.kpp ? String(raw.kpp) : undefined,
            bik: raw.bik ? String(raw.bik) : (slug === 'bank_accounts' && item.code ? item.code : undefined),
            accountNumber: raw.accountNumber ? String(raw.accountNumber) : undefined,
            address: raw.legalAddress || raw.address ? String(raw.legalAddress || raw.address) : undefined,
            director: raw.director || raw.headName ? String(raw.director || raw.headName) : undefined,
            price: raw.basePrice !== undefined ? Number(raw.basePrice) : undefined,
            unit: raw.unit ? String(raw.unit) : undefined,
            raw,
            availableFields: fields
        }
    }

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
            const normalized = (items || []).map((i) => normalizeItem(i, slug))
            directoryCache.set(cacheKey, normalized)
            return normalized
        } catch (e) {
            console.error(`[DirectoryInterpolator] Ошибка выборки ${slug}:`, e)
            return []
        }
    }

    const fetchAllDirectories = async (): Promise<DirectoryLookupItem[]> => {
        loading.value = true
        try {
            await fetchDefinitions()
            const allSlugs = Array.from(new Set([...SYSTEM_SLUGS, ...customDefs.value.map((d) => d.slug)]))
            const results = await Promise.all(allSlugs.map((slug) => fetchDirectoryItems(slug)))
            return results.flat()
        } finally {
            loading.value = false
        }
    }

    const resolveSlug = (alias: string): string | null => {
        const clean = alias.toLowerCase().trim()

        // 1. Проверяем системные регулярки
        if (/^(сотрудник|штат|отдел|персонал|должност)/.test(clean)) return 'departments'
        if (/^(контрагент|клиент|поставщик|подрядчик|партнер)/.test(clean)) return 'counterparties'
        if (/^(банк|счет|бик|расчетн)/.test(clean)) return 'bank_accounts'
        if (/^(товар|номенклатур|материал|услуг|продукц)/.test(clean)) return 'nomenclature'
        if (/^(термин|глоссари|словар)/.test(clean)) return 'glossary'
        if (SYSTEM_SLUGS.includes(clean)) return clean

        // 2. Проверяем кастомные справочники и их алиасы
        for (const def of customDefs.value) {
            if (def.slug.toLowerCase() === clean) return def.slug
            if (def.title.toLowerCase() === clean) return def.slug
            if (def.aliases?.some((a) => a.toLowerCase() === clean)) {
                return def.slug
            }
        }

        return null
    }

    const extractFieldValue = (item: DirectoryLookupItem, propName: string): string | null => {
        const p = propName.toLowerCase().trim()
        if (/^(название|имя|фио|title|наименование)/.test(p)) return item.title
        if (/^(инн|inn)/.test(p)) return item.inn || item.code || null
        if (/^(кпп|kpp)/.test(p)) return item.kpp || null
        if (/^(бик|bik)/.test(p)) return item.bik || null
        if (/^(счет|расчетный|account|р\/с)/.test(p)) return item.accountNumber || null
        if (/^(адрес|address|юр\.?адрес)/.test(p)) return item.address || null
        if (/^(директор|руководитель|director|шеф)/.test(p)) return item.director || null
        if (/^(телефон|тел|phone)/.test(p)) return item.phone || null
        if (/^(цена|стоимость|price)/.test(p)) return item.price !== undefined ? String(item.price) : null
        if (/^(ед|единица|unit)/.test(p)) return item.unit || null
        if (/^(код|артикул|code|sku)/.test(p)) return item.code || null

        for (const field of item.availableFields) {
            if (field.key.toLowerCase() === p || field.label.toLowerCase() === p) {
                return field.value
            }
        }

        for (const [k, v] of Object.entries(item.raw)) {
            if (k.toLowerCase() === p && v !== null && v !== undefined) return String(v)
        }
        return null
    }

    const resolveVariable = async (
        expression: string
    ): Promise<{ directValue?: string; candidates?: DirectoryLookupItem[]; item?: DirectoryLookupItem }> => {
        const cleanExpr = expression.replace(/^\{@|\}$/g, '').trim()
        if (!cleanExpr) return {}

        if (customDefs.value.length === 0) {
            await fetchDefinitions()
        }

        const parts = cleanExpr.split('.').map((s) => s.trim())
        const [rawSlug, filterText, requestedField] = parts

        const slug = resolveSlug(rawSlug)
        if (!slug) {
            const all = await fetchAllDirectories()
            const searchTarget = rawSlug.toLowerCase()
            const matched = all.filter(
                (i) => i.code.toLowerCase() === searchTarget || i.title.toLowerCase().includes(searchTarget)
            )
            if (matched.length === 1) return { directValue: matched[0].title, item: matched[0] }
            if (matched.length > 1) return { candidates: matched }
            return { directValue: `[Не найдено: ${rawSlug}]` }
        }

        const items = await fetchDirectoryItems(slug)
        if (!items.length) return { directValue: `[Справочник пуст: ${rawSlug}]` }

        if (!filterText) {
            return items.length === 1 ? { directValue: items[0].title, item: items[0] } : { candidates: items }
        }

        const fTarget = filterText.toLowerCase()
        const matched = items.filter((item) => {
            const matchTitle = item.title.toLowerCase().includes(fTarget)
            const matchCode = item.code.toLowerCase().includes(fTarget)
            const matchRaw = Object.values(item.raw).some((v) => String(v).toLowerCase().includes(fTarget))
            return matchTitle || matchCode || matchRaw
        })

        if (matched.length === 0) return { directValue: `[${filterText} не найден]` }

        if (matched.length === 1) {
            const targetItem = matched[0]
            if (requestedField) {
                const val = extractFieldValue(targetItem, requestedField)
                return { directValue: val || `[Поле ${requestedField} не заполнено]`, item: targetItem }
            }
            return { directValue: targetItem.title, item: targetItem }
        }

        return { candidates: matched }
    }

    const invalidateCache = (slug?: string) => {
        if (slug) {
            directoryCache.delete(`${getEnterpriseId()}_${slug}`)
        } else {
            directoryCache.clear()
        }
    }

    return {
        fetchDirectoryItems,
        fetchAllDirectories,
        fetchDefinitions,
        resolveVariable,
        extractFieldValue,
        invalidateCache,
        customDefs,
        loading
    }
}