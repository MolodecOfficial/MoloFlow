import DynamicModule from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const user = event.context.user

    if (!body.name || !body.format || !body.code || !body.enterpriseId) {
        throw createError({
            statusCode: 400,
            message: 'Missing required fields'
        })
    }

    const existingModule = await DynamicModule.findOne({
        name: body.name,
        enterpriseId: body.enterpriseId
    })

    if (existingModule) {
        throw createError({
            statusCode: 400,
            message: 'Module with this name already exists'
        })
    }

    const dynamicModule = new DynamicModule({
        ...body,

        createdBy: user
            ? {
                _id: user.id,
                name: user.name,
                role: user.role
            }
            : {
                _id: 'system',
                name: 'System'
            }
    })

    await dynamicModule.save()

    return {
        success: true,
        module: dynamicModule
    }
})