import { Tab } from '~~/server/models/tab.model'
import { Entry } from '~~/server/models/entry.model'
import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const tabId = getRouterParam(event, 'tabId')

    // Проверяем существование вкладки
    const tab = await Tab.findOne({
        _id: tabId,
        enterpriseId,
        isActive: true
    })

    if (!tab) {
        throw createError({
            statusCode: 404,
            message: 'Вкладка не найдена'
        })
    }

    // Полное удаление всех связанных данных
    await Promise.all([
        // Удаляем все записи
        Entry.deleteMany({
            enterpriseId,
            tabId
        }),

        // Удаляем все стандарты
        Standard.deleteMany({
            enterpriseId,
            tabId
        }),

        // Удаляем саму вкладку (hard delete)
        Tab.deleteOne({
            _id: tabId,
            enterpriseId
        })
    ])

    return {
        success: true,
        message: 'Вкладка и все связанные данные удалены'
    }
})