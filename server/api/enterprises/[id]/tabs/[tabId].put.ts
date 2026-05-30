import { Tab } from '~~/server/models/tab.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const tabId = getRouterParam(event, 'tabId')
    const body = await readBody(event)

    const existingTab = await Tab.findOne({ _id: tabId, enterpriseId, isActive: true })
    if (!existingTab) {
        throw createError({ statusCode: 404, message: 'Вкладка не найдена' })
    }

    // Проверка уникальности slug
    if (body.slug && body.slug !== existingTab.slug) {
        const slugExists = await Tab.findOne({
            enterpriseId, slug: body.slug, _id: { $ne: tabId }, isActive: true
        })
        if (slugExists) {
            throw createError({ statusCode: 400, message: `Вкладка с ключом "${body.slug}" уже существует` })
        }
    }

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.slug !== undefined) updateData.slug = body.slug.toLowerCase().trim()
    if (body.description !== undefined) updateData.description = body.description
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.color !== undefined) updateData.color = body.color
    if (body.category !== undefined) updateData.category = body.category
    if (body.defaultViewType !== undefined) updateData.defaultViewType = body.defaultViewType
    if (body.actions !== undefined) updateData.actions = body.actions
    if (body.permissions !== undefined) updateData.permissions = body.permissions

    // Обработка групп
    if (body.groups !== undefined) {
        updateData.groups = body.groups.map((group: any, idx: number) => ({
            _id: group._id,
            name: group.name.trim(),
            description: group.description || '',
            order: group.order ?? idx,
            icon: group.icon || 'folder',
            fields: (group.fields || []).map((field: any, fidx: number) => {
                const { _id, __v, ...cleanField } = field
                cleanField.key = cleanField.key?.toLowerCase().trim() || ''
                cleanField.label = cleanField.label?.trim() || ''
                cleanField.order = cleanField.order ?? fidx
                return cleanField
            })
        }))
    }

    const tab = await Tab.findOneAndUpdate(
        { _id: tabId, enterpriseId, isActive: true },
        { $set: updateData },
        { new: true, runValidators: true }
    ).lean()

    return { success: true, tab }
})