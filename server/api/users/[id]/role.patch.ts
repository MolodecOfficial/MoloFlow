// server/api/users/[id]/role.patch.ts
// PATCH /api/users/:id/role   body: { role }
// Назначает СИСТЕМНУЮ роль. Вызывающий определяется только по подписанному токену.
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { Types } from 'mongoose'
import { Enterprise } from '~~/server/models/enterprise.model'
import { User } from '~~/server/models/user.model'
import { publishAccessChange } from '~~/server/utils/accessEvents'
import { resolveSessionIdentity } from '~~/server/utils/authIdentity'
import { ROLE_DEFAULT_PERMISSIONS, PERMISSIONS, type UserRole } from '~/types/permissions'

const VALID_ROLES = Object.keys(ROLE_DEFAULT_PERMISSIONS) as UserRole[]

export default defineEventHandler(async (event) => {
    const targetId = getRouterParam(event, 'id')
    const body: any = (await readBody(event)) || {}
    const role = body.role as UserRole

    if (!targetId || !Types.ObjectId.isValid(targetId)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный ID пользователя' })
    }
    if (!role || !VALID_ROLES.includes(role)) {
        throw createError({ statusCode: 400, statusMessage: `Недопустимая роль. Доступно: ${VALID_ROLES.join(', ')}` })
    }

    // 1. Кто вызывает: только по токену
    const identity = resolveSessionIdentity(event)
    if (!identity) throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' })

    const caller: any = await User.findById(identity.userId).select('_id name role').lean()
    if (!caller) throw createError({ statusCode: 401, statusMessage: 'Пользователь не найден' })

    // 2. Уровень доступа вызывающего
    const enterprises: any[] = await Enterprise.find({
        $or: [{ 'members.userId': caller._id }, { director: caller.name }, { director: String(caller._id) }]
    }).select('director members').lean()

    let isAdminLevel = caller.role === 'Администратор'
    let canManage =
        isAdminLevel || (ROLE_DEFAULT_PERMISSIONS[caller.role as UserRole] || []).includes(PERMISSIONS.ACCESS_MANAGE)

    for (const ent of enterprises) {
        if (ent.director === caller.name || ent.director === String(caller._id)) {
            isAdminLevel = true
            canManage = true
        }
        const m = (ent.members || []).find((x: any) => String(x.userId) === String(caller._id))
        if (m?.role === 'Администратор') {
            isAdminLevel = true
            canManage = true
        }
        if (m && (ROLE_DEFAULT_PERMISSIONS[m.role as UserRole] || []).includes(PERMISSIONS.ACCESS_MANAGE)) {
            canManage = true
        }
    }

    if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав для назначения ролей' })
    if (role === 'Администратор' && !isAdminLevel) {
        throw createError({ statusCode: 403, statusMessage: 'Роль «Администратор» может назначить только администратор' })
    }

    // 3. Обновляем роль
    const updated: any = await User.findByIdAndUpdate(targetId, { $set: { role } }, { new: true })
        .select('_id name phone role')
        .lean()
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Пользователь не найден' })

    publishAccessChange('*', String(updated._id))

    return {
        success: true,
        message: `Роль изменена на «${role}»`,
        user: { _id: String(updated._id), name: updated.name, phone: updated.phone, role: updated.role }
    }
})
