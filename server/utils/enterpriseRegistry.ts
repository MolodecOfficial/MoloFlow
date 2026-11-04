
import bcrypt from 'bcrypt'
import { createError } from 'h3'
import { Enterprise } from '~~/server/models/enterprise.model'
import { User } from '~~/server/models/user.model'
import { ModuleCatalog } from '~~/server/models/moduleCatalog.model'
import { dropTenantDb } from './tenantDb'
import { writeSelfProfile, getSelfProfile, ensureCompanyDb } from './enterpriseDb'
import { ensureTenantStructure } from './tenantSetup'
import { allDirectoryModels, directoryModel, ensureAllDirectoryCollections } from './directoryCollections'

const str = (v: unknown) => String(v ?? '').trim()

const buildProfile = (input: Record<string, any>) => ({
    enterpriseName: str(input.enterpriseName),
    ownershipForm: str(input.ownershipForm) || 'ООО',
    inn: str(input.inn),
    kpp: str(input.kpp),
    ogrn: str(input.ogrn),
    legalAddress: str(input.legalAddress),
    actualAddress: str(input.actualAddress),
    phone: str(input.phone),
    email: str(input.email),
    director: str(input.director),
    okved: str(input.okved)
})

export const createEnterprise = async (input: Record<string, any>) => {
    const profile = buildProfile(input)
    const keypass = str(input.keypass)

    if (!profile.enterpriseName) throw createError({ statusCode: 400, statusMessage: 'Укажите название предприятия' })
    if (!profile.inn) throw createError({ statusCode: 400, statusMessage: 'Укажите ИНН предприятия' })
    if (!keypass) throw createError({ statusCode: 400, statusMessage: 'Ключ доступа к предприятию обязателен' })
    if (await Enterprise.exists({ inn: profile.inn })) {
        throw createError({ statusCode: 409, statusMessage: 'Предприятие с таким ИНН уже зарегистрировано' })
    }

    const created: any = await Enterprise.create({
        enterpriseName: profile.enterpriseName,
        inn: profile.inn,
        keypass: await bcrypt.hash(keypass, 10),
        status: 'provisioning'
    })
    const id = String(created._id)

    try {
        await ensureTenantStructure(id)
        await ensureAllDirectoryCollections(id)
        await writeSelfProfile(id, profile)
        await Enterprise.updateOne({ _id: created._id }, { $set: { status: 'active' } })
    } catch (e) {
        await dropTenantDb(id).catch(() => {})
        await Enterprise.deleteOne({ _id: created._id })
        throw e
    }
    return { _id: id, enterpriseName: profile.enterpriseName, inn: profile.inn, status: 'active' as const }
}

export const deleteEnterprise = async (id: string): Promise<void> => {
    await Enterprise.updateOne({ _id: id }, { $set: { status: 'deleting' } })
    await dropTenantDb(id)
    await ModuleCatalog.deleteMany({ enterpriseId: id })
    await Enterprise.deleteOne({ _id: id })
}

/** Пересобирает системные записи без затирания пользовательских данных */
export const rebuildSystemDirectories = async (enterpriseId: string) => {
    const enterprise: any = await Enterprise.findById(enterpriseId).lean()
    if (!enterprise) throw createError({ statusCode: 404, message: 'Предприятие не найдено' })

    for (const model of await allDirectoryModels(enterpriseId)) {
        await model.deleteMany({ directorySlug: 'bank_accounts' })
    }

    const departments = directoryModel(enterpriseId, 'departments')
    const counterparties = directoryModel(enterpriseId, 'counterparties')

    const now = new Date().toISOString()
    const members: any[] = enterprise.members || []
    const uids = members.map((m) => String(m.userId?._id ?? m.userId))
    const users: any[] = await User.find({ _id: { $in: uids } }).select('name phone').lean()
    const byId = new Map(users.map((u) => [String(u._id), u]))

    for (const m of members) {
        const uid = String(m.userId?._id ?? m.userId)
        const u = byId.get(uid)

        // Ищем существующую запись сотрудника, чтобы сохранить его персональные правки
        const existing: any = await departments.findOne({
            $or: [
                { 'attributes.userId': uid },
                { 'attributes.phone': u?.phone },
                { title: u?.name }
            ]
        }).lean()

        // Табельный номер: если уже был задан вручную (например LDR_1), сохраняем его!
        // Роль подставляется ТОЛЬКО если код был вообще пуст.
        const currentCode = existing?.code && existing.code !== existing?.attributes?.role
            ? existing.code
            : (existing?.code || `EMP-${uid.slice(-4).toUpperCase()}`)

        const existingAttrs = existing?.attributes || {}

        await departments.updateOne(
            { _id: existing?._id || new (departments.base.Types.ObjectId)() },
            {
                $set: {
                    enterpriseId,
                    directorySlug: 'departments',
                    title: existing?.title || u?.name || 'Без имени',
                    code: currentCode,
                    description: existing?.description || `Телефон: ${u?.phone || 'не указан'}`,
                    attributes: {
                        ...existingAttrs,
                        system: true,
                        userId: uid,
                        role: m.role || existingAttrs.role || 'Сотрудник',
                        phone: existingAttrs.phone || u?.phone || '',
                        joinedAt: existingAttrs.joinedAt || m.joinedAt || now
                    }
                }
            },
            { upsert: true }
        )
    }

    // Удаляем только тех системных сотрудников, которых реально исключили из штата предприятия
    await departments.deleteMany({ 'attributes.system': true, 'attributes.userId': { $nin: uids } })

    const profile: any = await getSelfProfile(enterpriseId)
    if (profile?.inn) {
        const existingCounterparty: any = await counterparties.findOne({ 'attributes.isSelf': true }).lean()
        await counterparties.updateOne(
            { 'attributes.isSelf': true },
            {
                $set: {
                    enterpriseId,
                    directorySlug: 'counterparties',
                    title: `${profile.enterpriseName || 'Организация'} (Наша компания)`,
                    code: profile.inn,
                    description: `КПП: ${profile.kpp || '—'}, ОГРН: ${profile.ogrn || '—'}`,
                    attributes: {
                        ...(existingCounterparty?.attributes || {}),
                        system: true,
                        isSelf: true,
                        inn: profile.inn,
                        kpp: profile.kpp || '',
                        address: profile.legalAddress || ''
                    }
                }
            },
            { upsert: true }
        )
    }

    return { staff: uids.length }
}