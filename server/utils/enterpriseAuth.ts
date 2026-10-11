import { H3Event, createError, getHeader, getCookie, getQuery } from 'h3'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'
import { Enterprise, type IEnterpriseMember } from '~~/server/models/enterprise.model'
import { User } from '~~/server/models/user.model'
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, type PermissionKey, type UserRole } from '~/types/permissions'

export interface AccessCheckOptions {
    allowedRoles?: Array<IEnterpriseMember['role']>
    requiredPermission?: PermissionKey
}

export async function checkEnterpriseAccess(
    event: H3Event,
    enterpriseId: string,
    options?: AccessCheckOptions | Array<IEnterpriseMember['role']>
): Promise<{ enterprise: any; currentMember: IEnterpriseMember; effectiveRole: UserRole; user: any; userId: string }> {
    // Нормализуем параметры (поддержка старого вызова с массивом ролей и нового с permission)
    let allowedRoles: Array<IEnterpriseMember['role']> | undefined
    let requiredPermission: PermissionKey | undefined

    if (Array.isArray(options)) {
        allowedRoles = options
    } else if (options) {
        allowedRoles = options.allowedRoles
        requiredPermission = options.requiredPermission
    }

    // 1. Извлекаем ID пользователя.
    // Приоритет: контекст сервера -> подписанный JWT -> заголовок -> имя -> query.
    // Раньше query.userId проверялся раньше токена — его легко подделать.
    let userId: string | null = event.context.user?._id || event.context.user?.id
        ? String(event.context.user._id || event.context.user.id)
        : null

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
                if (Types.ObjectId.isValid(rawToken)) {
                    userId = rawToken
                }
            }
        }
    }

    if (!userId) {
        const headerUserId = getHeader(event, 'x-user-id')
        if (headerUserId && Types.ObjectId.isValid(headerUserId)) {
            userId = headerUserId
        }
    }

    // Резервный вариант: поиск по имени (только однозначное совпадение).
    // Раньше этот блок стоял ПОСЛЕ throw 401 и никогда не выполнялся.
    if (!userId) {
        const rawName = getHeader(event, 'x-user-name')
        if (rawName) {
            let name = rawName
            try { name = decodeURIComponent(rawName) } catch {}
            const candidates = await User.find({ name }).select('_id').limit(2).lean()
            if (candidates.length === 1) userId = String(candidates[0]._id)
        }
    }

    if (!userId) {
        const query = getQuery(event)
        if (query.userId && Types.ObjectId.isValid(String(query.userId))) {
            userId = String(query.userId)
        }
    }

    if (!userId) {
        throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация (пользователь не найден)' })
    }

    if (!enterpriseId || !Types.ObjectId.isValid(enterpriseId)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный ID предприятия' })
    }

    // 2. Ищем предприятие и определяем статус
    const enterprise = await Enterprise.findById(enterpriseId)
    if (!enterprise) {
        throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
    }

    const user = await User.findById(userId).lean()
    const isDirector = enterprise.director && user && (enterprise.director === user.name || enterprise.director === String(user._id))

    const member = enterprise.members?.find(
        (m: any) => String(m.userId?._id || m.userId) === String(userId)
    )

    let memberRole: UserRole = (member?.role as UserRole) || 'Сотрудник'
    if (isDirector || user?.role === 'Администратор') {
        memberRole = 'Администратор'
    }

    if (!member && !isDirector && user?.role !== 'Администратор') {
        throw createError({ statusCode: 403, statusMessage: 'У вас нет доступа к данному предприятию' })
    }

    // 3. Проверка действующих ПРАВ (permissions), а не просто названия роли
    if (memberRole !== 'Администратор') {
        const userPermissions: PermissionKey[] = ROLE_DEFAULT_PERMISSIONS[memberRole] || []

        if (requiredPermission && !userPermissions.includes(requiredPermission)) {
            throw createError({
                statusCode: 403,
                statusMessage: `Недостаточно прав для выполнения действия. Требуется разрешение: ${requiredPermission}`
            })
        }

        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(memberRole as any)) {
            throw createError({
                statusCode: 403,
                statusMessage: `Недостаточно прав. Требуется роль: ${allowedRoles.join(', ')}`
            })
        }
    }

    const currentMember: IEnterpriseMember = member || {
        userId: new Types.ObjectId(userId),
        role: memberRole as any,
        joinedAt: new Date()
    }

    return { enterprise, currentMember, effectiveRole: memberRole, user, userId: String(userId) }
}