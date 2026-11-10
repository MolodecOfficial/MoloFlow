import { defineEventHandler, getQuery, createError } from 'h3'
import { Types } from 'mongoose'
import { Menu } from '~~/server/models/menu.model'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'
import { PERMISSIONS } from '~/types/permissions'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const enterpriseId = String(query.enterpriseId || '').trim()

    if (!enterpriseId || !Types.ObjectId.isValid(enterpriseId)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный enterpriseId' })
    }

    // Получать дерево мест для привязки модулей разрешено тем, кто имеет право MODULES_DEV
    await checkEnterpriseAccess(event, enterpriseId, {
        requiredPermission: PERMISSIONS.MODULES_DEV
    })

    const groups = await Menu.find({ isActive: { $ne: false } })
        .select('_id id title placeName type order items')
        .sort({ order: 1 })
        .lean()
        .exec()

    const locations = groups.map((g: any) => ({
        groupId: g._id || g.id,
        groupTitle: g.title,
        locations: (g.items || []).map((item: any) => ({
            id: item.id || item._id,
            title: item.title,
            placeName: item.placeName,
            type: item.type
        }))
    }))

    return { locations }
})