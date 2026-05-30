// server/api/enterprises/[id]/standards/index.get.ts
import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const query = getQuery(event)

    const filter: any = {
        enterpriseId,
        isActive: true
    }

    // Если указан tabId, ищем стандарты для конкретной вкладки
    if (query.tabId) {
        filter.tabId = query.tabId
    }

    // Если не указан includeTemplates, исключаем шаблоны из основных результатов
    if (!query.includeTemplates) {
        filter.isTemplate = { $ne: true }
    }

    // Если запрошены только шаблоны
    if (query.onlyTemplates === 'true') {
        filter.isTemplate = true
    }

    const standards = await Standard.find(filter)
        .sort({ isDefault: -1, isTemplate: -1, updatedAt: -1 })
        .lean()

    return {
        success: true,
        standards,
        total: standards.length
    }
})