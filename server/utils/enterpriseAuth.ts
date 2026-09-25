import { H3Event, createError, getHeader, getCookie } from 'h3'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'
import { Enterprise, type IEnterpriseMember } from '~~/server/models/enterprise.model'
import { User } from '~~/server/models/user.model'

export async function checkEnterpriseAccess(
    event: H3Event,
    enterpriseId: string,
    allowedRoles?: Array<IEnterpriseMember['role']>
): Promise<{ enterprise: any; currentMember: IEnterpriseMember }> {
    let userId: string | null = event.context.user?._id ? String(event.context.user._id) : null
    const query = getQuery(event)
    if (!userId && query.userId && Types.ObjectId.isValid(String(query.userId))) {
        userId = String(query.userId)
    }
    // 1. Если context.user не заполнен nuxt-middleware, пробуем прочитать токен из headers/cookies
    if (!userId) {
        const authHeader = getHeader(event, 'authorization') || getHeader(event, 'x-enterprise-token')
        const cookieToken = getCookie(event, 'enterprise_token') || getCookie(event, 'token')
        const rawToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : cookieToken

        if (rawToken) {
            try {
                const config = useRuntimeConfig()
                const secret = config.jwtSecret || config.tokenSecret || 'default_secret_key'
                const decoded: any = jwt.verify(rawToken, secret)
                userId = decoded.userId || decoded._id || decoded.id || null
            } catch {
                // Если JWT не подписан или это прямой ID/простой токен
                if (Types.ObjectId.isValid(rawToken)) {
                    userId = rawToken
                }
            }
        }
    }

    // 2. Fallback: заголовок x-user-id (для SPA-клиента)
    if (!userId) {
        const headerUserId = getHeader(event, 'x-user-id')
        if (headerUserId && Types.ObjectId.isValid(headerUserId)) {
            userId = headerUserId
        }
    }

    if (!userId) {
        throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация (пользователь не найден)' })
    }

    if (!enterpriseId || !Types.ObjectId.isValid(enterpriseId)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный ID предприятия' })
    }

    const enterprise = await Enterprise.findById(enterpriseId)
    if (!enterprise) {
        throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
    }

    // Проверяем директора предприятия
    const user = await User.findById(userId).lean()
    const isDirector = enterprise.director && user && (enterprise.director === user.name || enterprise.director === String(user._id))

    // Ищем участника в списке
    const member = enterprise.members.find(
        (m) => String(m.userId?._id || m.userId) === String(userId)
    )

    let memberRole: IEnterpriseMember['role'] = member?.role || 'Сотрудник'
    if (isDirector || user?.role === 'Администратор') {
        memberRole = 'Администратор'
    }

    if (!member && !isDirector && user?.role !== 'Администратор') {
        throw createError({ statusCode: 403, statusMessage: 'У вас нет доступа к данному предприятию' })
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(memberRole)) {
        throw createError({ statusCode: 403, statusMessage: `Недостаточно прав. Требуется: ${allowedRoles.join(', ')}` })
    }

    const currentMember: IEnterpriseMember = member || {
        userId: new Types.ObjectId(userId),
        role: memberRole,
        joinedAt: new Date()
    }

    return { enterprise, currentMember }
}