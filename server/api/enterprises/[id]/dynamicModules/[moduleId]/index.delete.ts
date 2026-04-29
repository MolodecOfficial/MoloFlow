import DynamicModule from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id

    if (!id) {
        throw createError({
            statusCode: 400,
            message: 'ID модуля обязательно'
        })
    }

    const deletedModule = await DynamicModule.findByIdAndDelete(id)

    if (!deletedModule) {
        throw createError({
            statusCode: 404,
            message: 'Модуль не найден'
        })
    }

    return {
        success: true,
        message: 'Модуль успешно удалён'
    }
})