import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { Types } from 'mongoose'
import { Menu } from '~~/server/models/menu.model'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const query = getQuery(event)
    const enterpriseId = String(query.enterpriseId || '')

    if (!enterpriseId || !Types.ObjectId.isValid(enterpriseId)) {
        throw createError({ statusCode: 400, statusMessage: 'Не передан enterpriseId' })
    }

    await checkEnterpriseAccess(event, enterpriseId, ['Администратор', 'Управляющий'])

    // Удаление целой группы либо очистка элемента
    const deleted = await Menu.findByIdAndDelete(id)
    if (!deleted) {
        await Menu.updateMany(
            {},
            { $pull: { items: { id } } }
        )
    }

    return { success: true }
})