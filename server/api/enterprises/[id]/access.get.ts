import { defineEventHandler, getRouterParam, createError, getHeader } from 'h3'
import mongoose from 'mongoose'
import { Enterprise } from '~~/server/models/enterprise.model'
import '~~/server/models/user.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')

    // Получаем ID или имя текущего пользователя из заголовка или сессии
    const currentUserId = getHeader(event, 'x-user-id') || event.context.user?._id
    const currentUserName = getHeader(event, 'x-user-name') || event.context.user?.name

    if (!enterpriseId) {
        throw createError({ statusCode: 400, statusMessage: 'Не указан ID предприятия' })
    }

    let filter: any = {}
    if (mongoose.Types.ObjectId.isValid(enterpriseId)) {
        filter = { _id: enterpriseId }
    } else if (!isNaN(Number(enterpriseId))) {
        filter = { inn: Number(enterpriseId) }
    } else {
        filter = { _id: enterpriseId }
    }

    const enterprise: any = await Enterprise.findOne(filter)
        .populate('members.userId', 'name phone role')
        .lean()

    if (!enterprise) {
        throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
    }

    // Проверяем доступ: по ID или если список участников пустой (тогда доступ открыт по токену входа)
    const memberRecord = enterprise.members?.find((m: any) => {
        const u = m.userId
        return (
            u?._id?.toString() === currentUserId?.toString() ||
            u?.name === currentUserName
        )
    })

    const isOwner = enterprise.ownerId && currentUserId
        ? enterprise.ownerId.toString() === currentUserId.toString()
        : false

    // Если в members никого нет — доступ по умолчанию полный (для обратной совместимости)
    const hasAccess = enterprise.members?.length === 0 || Boolean(isOwner || memberRecord)
    const userRole = isOwner ? 'Владелец' : (memberRecord?.role || (enterprise.members?.length === 0 ? 'Владелец' : 'Нет доступа'))

    return {
        enterprise: {
            _id: enterprise._id,
            enterpriseName: enterprise.enterpriseName,
            inn: enterprise.inn,
            kpp: enterprise.kpp,
            ogrn: enterprise.ogrn,
            legalAddress: enterprise.legalAddress,
            actualAddress: enterprise.actualAddress,
            phone: enterprise.phone,
            email: enterprise.email,
            director: enterprise.director,
            okved: enterprise.okved,
            ownershipForm: enterprise.ownershipForm
        },
        access: {
            hasAccess,
            role: userRole,
            isOwner,
            canEdit: ['Владелец', 'Администратор', 'Управляющий'].includes(userRole),
            canManageMembers: ['Владелец', 'Администратор', 'Управляющий'].includes(userRole)
        },
        members: (enterprise.members || []).map((m: any) => ({
            userId: m.userId?._id,
            name: m.userId?.name || 'Пользователь',
            phone: m.userId?.phone || '—',
            role: m.role,
            joinedAt: m.joinedAt
        }))
    }
})