import { defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'
import { User } from '~~/server/models/user.model'
import { ROLE_DEFAULT_PERMISSIONS } from '~/types/permissions'

// Поля, которые нельзя отдавать клиенту
const SENSITIVE_FIELDS = ['keypass', 'keyPass', 'password', 'passwordHash', 'token', 'secret']

/**
 * GET /api/enterprises/:id/me
 * Возвращает АКТУАЛЬНУЮ роль текущего пользователя в предприятии, права,
 * свежие данные пользователя и список участников. Клиент вызывает это при запуске,
 * при возврате фокуса и по таймеру, поэтому смена роли применяется без перезахода.
 */
export default defineEventHandler(async (event) => {
    setResponseHeader(event, 'Cache-Control', 'no-store')

    const enterpriseId = getRouterParam(event, 'id') as string
    const { enterprise, effectiveRole, user, userId } = await checkEnterpriseAccess(event, enterpriseId)

    const plain: any = typeof enterprise.toObject === 'function' ? enterprise.toObject() : { ...enterprise }
    for (const field of SENSITIVE_FIELDS) delete plain[field]

    const rawMembers: any[] = plain.members || []
    const memberIds = rawMembers.map(m => m.userId?._id || m.userId).filter(Boolean)
    const users = memberIds.length
        ? await User.find({ _id: { $in: memberIds } }).select('name phone').lean()
        : []
    const usersById = new Map(users.map((u: any) => [String(u._id), u]))

    const members = rawMembers.map((m) => {
        const id = String(m.userId?._id || m.userId)
        const u: any = usersById.get(id)
        return {
            userId: id,
            name: u?.name,
            phone: u?.phone,
            role: m.role,
            joinedAt: m.joinedAt
        }
    })

    return {
        role: effectiveRole,
        permissions: ROLE_DEFAULT_PERMISSIONS[effectiveRole] || [],
        user: {
            _id: String(userId),
            name: user?.name,
            phone: user?.phone,
            email: user?.email,
            role: user?.role
        },
        enterprise: { ...plain, _id: String(plain._id), members }
    }
})