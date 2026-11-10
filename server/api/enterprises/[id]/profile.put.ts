import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { Enterprise } from '~~/server/models/enterprise.model'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'
import { getSelfProfile, writeSelfProfile } from '~~/server/utils/enterpriseDb'

const text = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max)
const ALLOWED = ['enterpriseName', 'ownershipForm', 'inn', 'kpp', 'ogrn', 'legalAddress', 'actualAddress', 'phone', 'email', 'director', 'okved'] as const

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })
    await checkEnterpriseAccess(event, enterpriseId, ['Администратор'])
    const body = (await readBody(event)) || {}
    const existing = await Enterprise.findById(enterpriseId).select('-keypass').lean()
    if (!existing) throw createError({ statusCode: 404, message: 'Предприятие не найдено' })

    const patch: Record<string, any> = {}
    for (const key of ALLOWED) {
        if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = text(body[key], key === 'legalAddress' || key === 'actualAddress' ? 1000 : 500)
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'enterpriseName') && !patch.enterpriseName) {
        throw createError({ statusCode: 400, message: 'Наименование предприятия не может быть пустым' })
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'inn')) {
        if (!patch.inn) throw createError({ statusCode: 400, message: 'ИНН не может быть пустым' })
        const duplicate = await Enterprise.exists({ inn: patch.inn, _id: { $ne: enterpriseId } })
        if (duplicate) throw createError({ statusCode: 409, message: 'Предприятие с таким ИНН уже существует' })
    }

    const customRaw = Array.isArray(body.customRequisites) ? body.customRequisites : undefined
    if (customRaw) {
        if (customRaw.length > 50) throw createError({ statusCode: 400, message: 'Можно добавить не более 50 дополнительных реквизитов' })
        const seen = new Set<string>()
        patch.customRequisites = customRaw.map((item: any, index: number) => {
            const label = text(item?.label, 100)
            const value = text(item?.value, 2000)
            const key = text(item?.key, 80) || `custom_${index + 1}`
            if (!label) throw createError({ statusCode: 400, message: 'У каждого дополнительного реквизита должно быть название' })
            if (seen.has(key)) throw createError({ statusCode: 400, message: `Повторяется ключ реквизита «${key}»` })
            seen.add(key)
            return { key, label, value }
        })
    }

    const profile = { ...patch, isSelfCompany: true }
    await writeSelfProfile(enterpriseId, profile)

    const registryPatch: Record<string, any> = {}
    for (const key of ALLOWED) if (Object.prototype.hasOwnProperty.call(patch, key)) registryPatch[key] = patch[key]
    if (Object.keys(registryPatch).length) await Enterprise.updateOne({ _id: enterpriseId }, { $set: registryPatch })

    const updated = await Enterprise.findById(enterpriseId).select('-keypass').lean()
    return { success: true, message: 'Реквизиты предприятия сохранены', profile: { ...updated, ...profile, _id: String(enterpriseId) } }
})
