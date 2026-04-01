import DynamicModule from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id
    const body = await readBody(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            message: 'ID модуля обязательно'
        })
    }

    const updatedModule = await DynamicModule.findByIdAndUpdate(
        id,
        {
            ...body,
            updatedAt: new Date(),
            $inc: { version: 1 }
        },
        { new: true }
    )

    if (!updatedModule) {
        throw createError({
            statusCode: 404,
            message: 'Модуль не найден'
        })
    }

    return {
        success: true,
        module: updatedModule
    }
})