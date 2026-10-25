// server/api/enterprises/index.get.ts
// Раньше отдавал все предприятия целиком, включая хеш keypass. Теперь только поля для списка.
import { defineEventHandler } from 'h3'
import { Enterprise } from '~~/server/models/enterprise.model'

export default defineEventHandler(async () => {
    const enterprises = await Enterprise.find()
        .select('enterpriseName inn ownershipForm status createdAt')
        .lean()
    return { enterprises }
})
