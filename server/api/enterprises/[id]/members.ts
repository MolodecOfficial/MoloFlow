import { defineEventHandler, getRouterParam, readBody, getQuery, createError } from 'h3'
import mongoose from 'mongoose'
import { Enterprise } from '~~/server/models/enterprise.model'
import { User } from '~~/server/models/user.model'

function buildEnterpriseQuery(id: string) {
    const orList: any[] = [{ _id: id }]
    if (mongoose.Types.ObjectId.isValid(id)) {
        orList.push({ _id: new mongoose.Types.ObjectId(id) })
    }
    if (!isNaN(Number(id))) {
        orList.push({ inn: Number(id) })
    }
    return { $or: orList }
}

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const method = event.node.req.method

    if (!enterpriseId) {
        throw createError({ statusCode: 400, statusMessage: 'Не передан ID предприятия' })
    }

    const entFilter = buildEnterpriseQuery(enterpriseId)

    // GET: поиск пользователей или выдача текущего списка
    if (method === 'GET') {
        const query = getQuery(event)
        const search = query.search ? String(query.search).trim() : ''

        // Поиск незанятых юзеров по строке
        if (search) {
            const cleanPhone = search.replace(/\D/g, '')
            const users = await User.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    ...(cleanPhone ? [{ phone: { $regex: cleanPhone } }] : [])
                ]
            })
                .select('_id name phone role')
                .limit(15)
                .lean()

            return {
                users: users.map((u: any) => ({
                    _id: String(u._id),
                    name: u.name,
                    phone: u.phone,
                    role: u.role
                }))
            }
        }

        // Загрузка участников предприятия
        const enterprise: any = await Enterprise.findOne(entFilter).lean()
        if (!enterprise) {
            throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
        }

        const memberList = enterprise.members || []
        if (memberList.length === 0) {
            return {
                enterpriseName: enterprise.enterpriseName,
                members: []
            }
        }

        // Собираем всех пользователей вручную без уязвимостей populate
        const userIds = memberList.map((m: any) => m.userId)
        const users = await User.find({ _id: { $in: userIds } }).select('_id name phone role').lean()
        const usersMap = new Map(users.map((u: any) => [String(u._id), u]))

        const resultMembers = memberList.map((m: any) => {
            const uStr = String(m.userId)
            const uData: any = usersMap.get(uStr)
            return {
                userId: uStr,
                name: uData?.name || 'Пользователь',
                phone: uData?.phone || '—',
                role: m.role || uData?.role || 'Сотрудник',
                joinedAt: m.joinedAt
            }
        })

        return {
            enterpriseName: enterprise.enterpriseName,
            members: resultMembers
        }
    }

    // POST: добавление сотрудника в предприятие
    if (method === 'POST') {
        const body = await readBody(event)
        const { userId, role } = body

        if (!userId) {
            throw createError({ statusCode: 400, statusMessage: 'Не передан userId' })
        }

        const enterprise = await Enterprise.findOne(entFilter)
        if (!enterprise) {
            throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
        }

        const targetRole = role || 'Сотрудник'
        const targetUserId = String(userId)

        const memberIndex = enterprise.members.findIndex(
            (m: any) => String(m.userId) === targetUserId
        )

        if (memberIndex > -1) {
            enterprise.members[memberIndex].role = targetRole
        } else {
            enterprise.members.push({
                userId: new mongoose.Types.ObjectId(targetUserId),
                role: targetRole,
                joinedAt: new Date()
            })
        }

        // Обновляем также глобальную роль пользователя в базе
        await User.findByIdAndUpdate(targetUserId, { $set: { role: targetRole } })
        await enterprise.save()

        return { success: true, message: 'Сотрудник успешно добавлен' }
    }

    // DELETE: удаление доступа
    if (method === 'DELETE') {
        const body = await readBody(event)
        const { userId } = body

        const enterprise = await Enterprise.findOne(entFilter)
        if (!enterprise) {
            throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
        }

        enterprise.members = enterprise.members.filter(
            (m: any) => String(m.userId) !== String(userId)
        )

        await enterprise.save()
        return { success: true, message: 'Доступ сотрудника отозван' }
    }
})