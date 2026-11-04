import { defineEventHandler, getRouterParam, createError } from 'h3'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'
import { Enterprise } from '~~/server/models/enterprise.model'
import { getSelfProfile } from '~~/server/utils/enterpriseDb'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })
    await checkEnterpriseAccess(event, enterpriseId, ['Администратор'])
    const [enterprise, profile] = await Promise.all([
        Enterprise.findById(enterpriseId).select('-keypass').lean(),
        getSelfProfile(enterpriseId)
    ])
    if (!enterprise) throw createError({ statusCode: 404, message: 'Предприятие не найдено' })
    return { success: true, profile: { ...enterprise, ...(profile || {}), _id: String(enterprise._id) } }
})
