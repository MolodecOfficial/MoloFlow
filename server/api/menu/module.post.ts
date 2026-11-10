import { defineEventHandler, readBody, createError } from 'h3'
import { Types } from 'mongoose'
import { Menu } from '~~/server/models/menu.model'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { enterpriseId, groupId, parentId, module } = body

    if (!enterpriseId || !groupId || !module) {
        throw createError({ statusCode: 400, statusMessage: 'Не переданы обязательные поля (enterpriseId, groupId, module)' })
    }

    await checkEnterpriseAccess(event, enterpriseId, ['Администратор', 'Управляющий'])

    // Поиск группы по ObjectId либо по строковому id (placeName)
    const groupQuery: any = Types.ObjectId.isValid(groupId)
        ? { $or: [{ _id: new Types.ObjectId(groupId) }, { id: String(groupId) }] }
        : { id: String(groupId) }

    const group = await Menu.findOne(groupQuery)
    if (!group) {
        throw createError({ statusCode: 404, statusMessage: `Группа меню "${groupId}" не найдена` })
    }

    const newMenuItem = {
        id: module.fileName || `module_${module._id}`,
        placeName: module.fileName,
        title: module.name,
        format: module.format || 'vue',
        isModule: true,
        moduleId: module._id,
        isActive: true,
        requiredRole: module.requiredRole || [],
        items: []
    }

    if (parentId) {
        const insertIntoChildren = (items: any[]): boolean => {
            for (const item of items) {
                if (String(item.id) === String(parentId) || String(item._id) === String(parentId)) {
                    item.items = item.items || []
                    item.items.push(newMenuItem)
                    return true
                }
                if (item.items && insertIntoChildren(item.items)) {
                    return true
                }
            }
            return false
        }

        const inserted = insertIntoChildren(group.items || [])
        if (!inserted) {
            group.items = group.items || []
            group.items.push(newMenuItem)
        }
    } else {
        group.items = group.items || []
        group.items.push(newMenuItem)
    }

    group.markModified('items')
    await group.save()

    return { success: true, item: newMenuItem }
})