import { Standard } from '~~/server/models/standard.model'
import { Tab } from '~~/server/models/tab.model'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const body = await readBody(event)

    if (!body.name || !body.type) {
        throw createError({
            statusCode: 400,
            message: 'Название и тип стандарта обязательны'
        })
    }

    if (!body.tabId) {
        throw createError({
            statusCode: 400,
            message: 'Необходимо указать вкладку'
        })
    }

    // Если новый стандарт помечен как isDefault – снимаем флаг со всех других стандартов ЭТОЙ ВКЛАДКИ (всех типов)
    if (body.isDefault === true) {
        await Standard.updateMany(
            {
                enterpriseId: new mongoose.Types.ObjectId(enterpriseId),
                tabId: new mongoose.Types.ObjectId(body.tabId),
                isActive: true
            },
            { $set: { isDefault: false } }
        )
    }

    const standard = await Standard.create({
        enterpriseId,
        name: body.name,
        description: body.description || '',
        type: body.type,
        isDefault: body.isDefault || false,
        tabId: body.tabId,
        settings: body.settings || {},
        styles: body.styles || {},
        cardSettings: body.cardSettings || {},
        tableSettings: body.tableSettings || {},
        listSettings: body.listSettings || {},
        showSearch: body.showSearch,
        showFilters: body.showFilters,
        showPagination: body.showPagination,
        itemsPerPage: body.itemsPerPage,
        emptyStateMessage: body.emptyStateMessage,
        emptyStateIcon: body.emptyStateIcon
    })

    // Если isDefault = true – обновляем defaultStandardId во вкладке
    if (body.isDefault === true) {
        await Tab.findOneAndUpdate(
            { _id: body.tabId, enterpriseId, isActive: true },
            { $set: { defaultStandardId: standard._id } }
        )
    }

    return {
        success: true,
        standard
    }
})