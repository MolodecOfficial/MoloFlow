import { Tab } from '~~/server/models/tab.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const body = await readBody(event)

    if (!body.name || !body.slug) {
        throw createError({
            statusCode: 400,
            message: 'Название и slug вкладки обязательны'
        })
    }

    // Проверка дубликата slug
    const existing = await Tab.findOne({
        enterpriseId,
        slug: body.slug,
        isActive: true
    })
    if (existing) {
        throw createError({
            statusCode: 400,
            message: `Вкладка с ключом "${body.slug}" уже существует`
        })
    }

    // Нормализация групп и полей
    const groups = (body.groups || []).map((group: any, idx: number) => ({
        name: group.name.trim(),
        description: group.description || '',
        order: group.order ?? idx,
        icon: group.icon || 'folder',
        image: group.image || null,
        link: group.link || '',
        fields: (group.fields || []).map((field: any, fidx: number) => {
            const { _id, __v, ...cleanField } = field
            cleanField.key = cleanField.key?.toLowerCase().trim() || ''
            cleanField.label = cleanField.label?.trim() || ''
            cleanField.order = cleanField.order ?? fidx
            return cleanField
        })
    }))

    const tabData = {
        enterpriseId,
        name: body.name.trim(),
        slug: body.slug.toLowerCase().trim(),
        description: body.description || '',
        icon: body.icon || 'folder',
        color: body.color || '#6496ff',
        category: body.category || 'custom',
        defaultViewType: body.defaultViewType || 'table',
        groups,
        actions: body.actions || [],
        permissions: body.permissions || {
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canExport: false,
            rolesAllowed: []
        }
    }

    const tab = await Tab.create(tabData)
    return { success: true, tab: tab.toObject() }
})