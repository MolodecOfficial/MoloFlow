// server/api/enterprises/[id]/access.get.ts
// Доступ к предприятию определяется ТОЛЬКО по подписанному токену пользователя.
// Заголовки x-user-id / x-user-name больше не используются, открытого доступа без участников нет.
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { Types } from 'mongoose'
import Enterprise from '~~/server/models/enterprise.model'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    if (!enterpriseId || !Types.ObjectId.isValid(enterpriseId)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный ID предприятия' })
    }

    // Бросит 401 без токена и 403, если пользователь не участник предприятия
    const { effectiveRole, userId } = await checkEnterpriseAccess(event, enterpriseId)

    const enterprise: any = await Enterprise.findById(enterpriseId)
        .populate('members.userId', 'name phone')
        .lean()
    if (!enterprise) throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })

    const isOwner = effectiveRole === 'Администратор'
    const canManage = ['Администратор', 'Управляющий'].includes(effectiveRole)

    return {
        enterprise: {
            _id: enterprise._id,
            enterpriseName: enterprise.enterpriseName,
            inn: enterprise.inn,
            ownershipForm: enterprise.ownershipForm,
            kpp: enterprise.kpp,
            ogrn: enterprise.ogrn,
            legalAddress: enterprise.legalAddress,
            actualAddress: enterprise.actualAddress,
            phone: enterprise.phone,
            email: enterprise.email,
            director: enterprise.director,
            okved: enterprise.okved
        },
        access: {
            hasAccess: true,
            role: effectiveRole,
            isOwner,
            canEdit: canManage,
            canManageMembers: canManage,
            requesterId: userId
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
