import { H3Event, createError } from 'h3'
import { Types } from 'mongoose'
import { Enterprise, type IEnterpriseMember } from '~~/server/models/enterprise.model'
import { User } from '~~/server/models/user.model'
import { resolveSessionIdentity } from '~~/server/utils/authIdentity'
import { ROLE_DEFAULT_PERMISSIONS, type PermissionKey, type UserRole } from '~/types/permissions'

export interface AccessCheckOptions {
    allowedRoles?: Array<IEnterpriseMember['role']>
    requiredPermission?: PermissionKey
}

export async function checkEnterpriseAccess(
    event: H3Event,
    enterpriseId: string,
    options?: AccessCheckOptions | Array<IEnterpriseMember['role']>
): Promise<{ enterprise: any; currentMember: IEnterpriseMember; effectiveRole: UserRole; user: any; userId: string }> {
    let allowedRoles: Array<IEnterpriseMember['role']> | undefined
    let requiredPermission: PermissionKey | undefined

    if (Array.isArray(options)) {
        allowedRoles = options
    } else if (options) {
        allowedRoles = options.allowedRoles
        requiredPermission = options.requiredPermission
    }

    // Единственный источник личности: authIdentity (токен / JWT). Заголовки x-user-id и query не используются.
    const identity = resolveSessionIdentity(event)
    if (!identity || !Types.ObjectId.isValid(identity.userId)) {
        throw createError({ statusCode: 401, statusMessage: 'Требуется авторизация' })
    }
    const userId = identity.userId

    if (!enterpriseId || !Types.ObjectId.isValid(enterpriseId)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный ID предприятия' })
    }

    const enterprise = await Enterprise.findById(enterpriseId)
    if (!enterprise) {
        throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
    }

    const user = await User.findById(userId).lean()
    const isCreator = String((enterprise as any).creatorId?._id || (enterprise as any).creatorId || '') === String(userId)
    // Поле director — ФИО юридического руководителя, не идентификатор доступа.
    // Для совместимости признаём директора по ID, но не выдаём права по совпадению имени.
    const isDirector = enterprise.director && user && enterprise.director === String(user._id)

    let member = enterprise.members?.find(
        (m: any) => String(m.userId?._id || m.userId) === String(userId)
    )

    // Создатель всегда администратор своего предприятия. Восстанавливаем членство
    // для старых документов, где creatorId уже есть, но запись members отсутствует.
    if (isCreator && (!member || member.role !== 'Администратор')) {
        if (member) {
            await Enterprise.updateOne(
                { _id: enterprise._id, 'members.userId': new Types.ObjectId(userId) },
                { $set: { 'members.$.role': 'Администратор' } }
            )
            member = { ...member, role: 'Администратор' } as any
        } else {
            await Enterprise.updateOne(
                { _id: enterprise._id, members: { $not: { $elemMatch: { userId: new Types.ObjectId(userId) } } } },
                { $push: { members: { userId: new Types.ObjectId(userId), role: 'Администратор', joinedAt: new Date() } } }
            )
            member = { userId: new Types.ObjectId(userId), role: 'Администратор', joinedAt: new Date() } as any
        }
    }

    let memberRole: UserRole = (member?.role as UserRole) || 'Сотрудник'
    if (isCreator || isDirector || user?.role === 'Администратор') {
        memberRole = 'Администратор'
    }

    if (!member && !isCreator && !isDirector && user?.role !== 'Администратор') {
        throw createError({ statusCode: 403, statusMessage: 'У вас нет доступа к данному предприятию' })
    }

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