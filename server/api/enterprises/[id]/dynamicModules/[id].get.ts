import DynamicModule from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id

    if (!id) {
        throw createError({
            statusCode: 400,
            message: 'Module ID is required'
        })
    }

    const module = await DynamicModule.findById(id)

    if (!module) {
        throw createError({
            statusCode: 404,
            message: 'Module not found'
        })
    }

    return {
        success: true,
        module
    }
})