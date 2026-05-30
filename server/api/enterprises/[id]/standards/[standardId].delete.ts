import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')

    const standardId = getRouterParam(event, 'standardId')

    await Standard.findOneAndUpdate(
        {
            _id: standardId,
            enterpriseId
        },
        {
            isActive: false
        }
    )

    return {
        success: true
    }
})