import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async () => {
    const standards = await Standard.find({ isActive: true })
        .sort({ isDefault: -1, createdAt: -1 })
        .lean()
    return { success: true, standards, total: standards.length }
})