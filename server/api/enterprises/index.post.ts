// server/api/enterprises/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { createEnterprise } from '~~/server/utils/enterpriseRegistry'
import { resolveSessionIdentity } from '~~/server/utils/authIdentity'

export default defineEventHandler(async (event) => {
    const identity = resolveSessionIdentity(event)
    if (!identity?.userId) throw createError({ statusCode: 401, statusMessage: 'Войдите в аккаунт перед созданием предприятия' })
    const body = (await readBody(event)) || {}
    const enterprise = await createEnterprise(body, identity.userId)
    return { success: true, message: 'Предприятие успешно создано', enterprise }
})
