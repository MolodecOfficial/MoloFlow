import { defineEventHandler, getRouterParam, getQuery, getHeader, createError } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import Enterprise from '~~/server/models/enterprise.model'

export default defineEventHandler(async (event) => {
    // slug справочника: например, 'servers' или 'projects'
    const slug = getRouterParam(event, 'slug')
    const query = getQuery(event)

    // Идентификатор предприятия и секретный ключ можно передать в Query (?enterpriseId=...&apiKey=...) или в Headers
    const enterpriseId = String(query.enterpriseId || getHeader(event, 'x-enterprise-id') || '').trim()
    const apiKey = String(query.apiKey || getHeader(event, 'x-api-key') || '').trim()

    if (!enterpriseId || !slug) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Требуется указать enterpriseId и slug справочника'
        })
    }

    // 1. Проверяем предприятие
    const enterprise: any = await Enterprise.findById(enterpriseId).lean()
    if (!enterprise) {
        throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
    }

    // 2. Проверка ключа разработчика (задай DEV_API_KEY в .env MoloFlow)
    const masterKey = process.env.DEV_API_KEY
    if (apiKey !== masterKey) {
        throw createError({ statusCode: 401, statusMessage: 'Неверный API ключ разработчика' })
    }

    // 3. Выкачиваем данные из изолированной БД предприятия
    const { DirectoryItem } = tenantModels(enterpriseId)
    const rawItems = await DirectoryItem.find({
        enterpriseId,
        directorySlug: slug
    })
        .sort({ createdAt: -1 })
        .lean()

    const data = rawItems.map((item: any) => ({
        id: item._id,
        code: item.code,
        title: item.title,
        description: item.description,
        ...(item.attributes || {}),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
    }))

    return {
        success: true,
        count: data.length,
        data
    }
})