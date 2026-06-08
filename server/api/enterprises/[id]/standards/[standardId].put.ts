import { Standard } from '~~/server/models/standard.model'
import { Tab } from '~~/server/models/tab.model'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const standardId = getRouterParam(event, 'standardId')
    const body = await readBody(event)

    const existing = await Standard.findOne({ _id: standardId, enterpriseId, isActive: true })
    if (!existing) {
        throw createError({ statusCode: 404, message: 'Стандарт не найден' })
    }

    const targetTabId = body.tabId ? new mongoose.Types.ObjectId(body.tabId) : existing.tabId

    // Если устанавливаем isDefault: true – снимаем флаг со всех остальных стандартов ЭТОЙ ВКЛАДКИ (любого типа)
    if (body.isDefault === true) {
        await Standard.updateMany(
            {
                enterpriseId: new mongoose.Types.ObjectId(enterpriseId),
                tabId: targetTabId,
                _id: { $ne: new mongoose.Types.ObjectId(standardId) },
                isActive: true
            },
            { $set: { isDefault: false } }
        )

        // Обновляем defaultStandardId во вкладке
        await Tab.findOneAndUpdate(
            { _id: targetTabId, enterpriseId, isActive: true },
            { $set: { defaultStandardId: standardId } }
        )
    } else if (body.isDefault === false && existing.isDefault === true) {
        // Если снимаем флаг, проверяем, есть ли другой стандарт по умолчанию
        const otherDefault = await Standard.findOne({
            enterpriseId: new mongoose.Types.ObjectId(enterpriseId),
            tabId: targetTabId,
            _id: { $ne: new mongoose.Types.ObjectId(standardId) },
            isDefault: true,
            isActive: true
        })
        if (!otherDefault) {
            await Tab.findOneAndUpdate(
                { _id: targetTabId, enterpriseId, isActive: true },
                { $set: { defaultStandardId: null } }
            )
        }
    }

    const updateData: any = {
        name: body.name,
        description: body.description,
        type: body.type,
        isDefault: body.isDefault,
        settings: body.settings,
        styles: body.styles || {},
        cardSettings: body.cardSettings,
        tableSettings: body.tableSettings,
        listSettings: body.listSettings,
        showSearch: body.showSearch,
        showFilters: body.showFilters,
        showPagination: body.showPagination,
        itemsPerPage: body.itemsPerPage,
        emptyStateMessage: body.emptyStateMessage,
        emptyStateIcon: body.emptyStateIcon
    }

    const standard = await Standard.findOneAndUpdate(
        { _id: standardId, enterpriseId, isActive: true },
        { $set: updateData },
        { new: true }
    )

    if (!standard) {
        throw createError({ statusCode: 404, message: 'Стандарт не найден' })
    }

    return { success: true, standard }
})