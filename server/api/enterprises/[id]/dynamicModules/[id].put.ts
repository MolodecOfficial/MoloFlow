import DynamicModule from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id
    const body = await readBody(event)
    const user = event.context.user

    if (!id) throw createError({ statusCode: 400, message: 'ID модуля обязательно' })

    // Запрещаем менять enterpriseId и createdBy
    delete body.enterpriseId
    delete body.createdBy

    // Обработка тегов
    if (body.tags && typeof body.tags === 'string') {
        body.tags = body.tags.split(',').map(t => t.trim())
    }

    // Только админ может менять isOfficial
    if (body.isOfficial !== undefined && user?.name !== 'MolodecOfficial') {
        delete body.isOfficial
    }

    const updatedModule = await DynamicModule.findByIdAndUpdate(
        id,
        {
            ...body,
            updatedAt: new Date(),
            $inc: { version: 1 }
        },
        { new: true, runValidators: true }
    )

    if (!updatedModule) throw createError({ statusCode: 404, message: 'Модуль не найден' })

    return { success: true, module: updatedModule }
})