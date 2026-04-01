import DynamicModule from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id

    if (!id) {
        throw createError({
            statusCode: 400,
            message: 'Enterprise ID is required'
        })
    }

    const modules = await DynamicModule.find({
        enterpriseId: id,
        isActive: true
    }).sort({ createdAt: -1 })

    return {
        success: true,
        modules
    }
})