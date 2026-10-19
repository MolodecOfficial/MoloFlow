// server/api/enterprises/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { Enterprise } from '~~/server/models/enterprise.model'
import { runDbOp } from '~~/server/utils/moloDb/store'
import { ensureCompanyDb, PROFILE_COL, COMPANY_DB } from '~~/server/utils/enterpriseDb'
import bcrypt from "bcrypt";
export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    if (!body.keypass || !String(body.keypass).trim()) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Ключ доступа к предприятию обязателен для заполнения'
        })
    }

    // Хешируем ключ перед сохранением (если используется bcrypt)
    const hashedKeypass = await bcrypt.hash(String(body.keypass).trim(), 10)

    // 1. Создаём само предприятие в общей системе
    const enterprise = await Enterprise.create({
        enterpriseName: body.enterpriseName,
        ownershipForm: body.ownershipForm,
        inn: String(body.inn),
        kpp: String(body.kpp || ''),
        ogrn: String(body.ogrn || ''),
        legalAddress: body.legalAddress,
        actualAddress: body.actualAddress,
        phone: String(body.phone),
        email: body.email,
        director: body.director,
        okved: String(body.okved || ''),
        keypass: hashedKeypass
    })

    const enterpriseId = String(enterprise._id)

    // 2. Локальная база предприятия «company»: реквизиты (profile) и модули (modules)
    await ensureCompanyDb(enterpriseId)

    // 3. Сразу записываем первый документ с данными организации в локальную коллекцию
    await runDbOp(
        { enterpriseId, db: COMPANY_DB, col: PROFILE_COL, actor: { kind: 'system', id: 'system' } },
        {
            op: 'insert',
            doc: {
                enterpriseName: body.enterpriseName,
                ownershipForm: body.ownershipForm,
                inn: String(body.inn),
                kpp: String(body.kpp || ''),
                ogrn: String(body.ogrn || ''),
                legalAddress: body.legalAddress,
                actualAddress: body.actualAddress,
                phone: String(body.phone),
                email: body.email,
                director: body.director,
                okved: String(body.okved || ''),
                isSelfCompany: true,
                createdAt: new Date().toISOString()
            }
        }
    )

    return {
        success: true,
        message: 'Предприятие и локальная база успешно инициализированы',
        enterprise: { ...enterprise.toObject(), keypass: undefined }
    }
})