import { defineEventHandler, getRouterParam, readBody, getHeader, getCookie, createError } from 'h3'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'
import { Enterprise } from '~~/server/models/enterprise.model'
import { User } from '~~/server/models/user.model'
import { publishAccessChange } from '~~/server/utils/accessEvents'
import { ROLE_DEFAULT_PERMISSIONS, PERMISSIONS, type UserRole } from '~/types/permissions'

/**
 * PATCH /api/users/:id/role   body: { role }
 * Назначает пользователю СИСТЕМНУЮ (глобальную) роль.
 *
 * Кто может вызывать: администратор, управляющий (системная роль или роль в любом
 * предприятии) либо директор предприятия.
 * Роль «Администратор» может выдавать только тот, кто сам имеет уровень администратора.
 */

const VALID_ROLES = Object.keys(ROLE_DEFAULT_PERMISSIONS) as UserRole[]

/** Определяем, кто делает запрос (те же источники, что и в checkEnterpriseAccess) */
async function resolveCallerId(event: any): Promise<string | null> {
    const ctxUser = event.context.user
    if (ctxUser?._id || ctxUser?.id) return String(ctxUser._id || ctxUser.id)

    const authHeader = getHeader(event, 'authorization') || getHeader(event, 'x-enterprise-token')
    const cookieToken = getCookie(event, 'enterprise_token') || getCookie(event, 'token')
    const rawToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : cookieToken

    if (rawToken) {
        try {
            const config = useRuntimeConfig()
            const secret = config.jwtSecret || config.tokenSecret || 'default_secret_key'
            const decoded: any = jwt.verify(rawToken, secret)
            const id = decoded.userId || decoded._id || decoded.id
            if (id && Types.ObjectId.isValid(String(id))) return String(id)
        } catch {
            if (Types.ObjectId.isValid(rawToken)) return rawToken
        }
    }

    const headerUserId = getHeader(event, 'x-user-id')
    if (headerUserId && Types.ObjectId.isValid(headerUserId)) return headerUserId

    const rawName = getHeader(event, 'x-user-name')
    if (rawName) {
        let name = rawName
        try { name = decodeURIComponent(rawName) } catch {}
        const found = await User.find({ name }).select('_id').limit(2).lean()
        if (found.length === 1) return String(found[0]._id)
    }

    return null
}

export default defineEventHandler(async (event) => {
    const targetId = getRouterParam(event, 'id')
    const body = await readBody(event)
    const role = body?.role as UserRole

    if (!targetId || !Types.ObjectId.isValid(targetId)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный ID пользователя' })
    }
    if (!role || !VALID_ROLES.includes(role)) {
        throw createError({ statusCode: 400, statusMessage: `Недопустимая роль. Доступно: ${VALID_ROLES.join(', ')}` })
    }

    // 1. Кто вызывает
    const callerId = await resolveCallerId(event)
    if (!callerId) {
        throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' })
    }
    const caller: any = await User.findById(callerId).select('_id name role').lean()
    if (!caller) {
        throw createError({ statusCode: 401, statusMessage: 'Пользователь не найден' })
    }

    // 2. Уровень доступа вызывающего: системная роль, роль в предприятиях, директорство
    const enterprises: any[] = await Enterprise.find({
        $or: [
            { 'members.userId': caller._id },
            { director: caller.name },
            { director: String(caller._id) }
        ]
    }).select('director members').lean()

    let isAdminLevel = caller.role === 'Администратор'
    let canManage =
        isAdminLevel ||
        (ROLE_DEFAULT_PERMISSIONS[caller.role as UserRole] || []).includes(PERMISSIONS.ACCESS_MANAGE)

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

    if (!canManage) {
        throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав для назначения ролей' })
    }
    if (role === 'Администратор' && !isAdminLevel) {
        throw createError({ statusCode: 403, statusMessage: 'Роль «Администратор» может назначить только администратор' })
    }

    // 3. Обновляем роль
    const updated: any = await User.findByIdAndUpdate(
        targetId,
        { $set: { role } },
        { new: true }
    ).select('_id name phone role').lean()

    if (!updated) {
        throw createError({ statusCode: 404, statusMessage: 'Пользователь не найден' })
    }

    // Сессия этого человека обновится сразу (системная роль влияет на все предприятия)
    publishAccessChange('*', String(updated._id))

    return {
        success: true,
        message: `Роль изменена на «${role}»`,
        user: {
            _id: String(updated._id),
            name: updated.name,
            phone: updated.phone,
            role: updated.role
        }
    }
})