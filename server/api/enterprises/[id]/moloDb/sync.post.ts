// server/api/enterprises/[id]/moloDb/sync.post.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import mongoose from 'mongoose'
import { Enterprise } from '~~/server/models/enterprise.model'
import { DirectoryItem } from '~~/server/models/directoryItem.model'
import { MoloDatabase } from '~~/server/models/moloDatabase.model'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { runDbOp, invalidateDefCache } from '~~/server/utils/moloDb/store'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId || !mongoose.Types.ObjectId.isValid(enterpriseId)) {
            throw createError({ statusCode: 400, message: 'Некорректный или отсутствующий ID предприятия' })
        }

        const actor = await resolveActor(event, enterpriseId, 'schema')
        const enterprise: any = await Enterprise.findById(enterpriseId).lean()
        if (!enterprise) {
            throw createError({ statusCode: 404, message: 'Предприятие не найдено' })
        }

        const systemCollections = [
            {
                name: 'profile',
                title: 'Реквизиты организации',
                strict: false,
                fields: [
                    { name: 'enterpriseName', label: 'Наименование', type: 'string', required: true },
                    { name: 'inn', label: 'ИНН', type: 'string', required: true },
                    { name: 'kpp', label: 'КПП', type: 'string' },
                    { name: 'ogrn', label: 'ОГРН', type: 'string' }
                ]
            },
            {
                name: 'departments',
                title: 'Штат и отделы',
                strict: false,
                fields: [
                    { name: 'code', label: 'Табельный номер', type: 'string' },
                    { name: 'title', label: 'ФИО', type: 'string', required: true },
                    { name: 'department', label: 'Отдел', type: 'string' },
                    { name: 'role', label: 'Должность', type: 'string' },
                    { name: 'phone', label: 'Телефон', type: 'string' }
                ]
            },
            {
                name: 'counterparties',
                title: 'Контрагенты',
                strict: false,
                fields: [
                    { name: 'code', label: 'ИНН', type: 'string', required: true },
                    { name: 'title', label: 'Наименование', type: 'string', required: true },
                    { name: 'kpp', label: 'КПП', type: 'string' },
                    { name: 'phone', label: 'Телефон', type: 'string' }
                ]
            },
            {
                name: 'workspace_documents',
                title: 'Документы пространства',
                strict: false,
                fields: [
                    { name: 'name', label: 'Имя файла', type: 'string', required: true },
                    { name: 'type', label: 'Тип (excel, word, pdf...)', type: 'string' },
                    { name: 'folderId', label: 'ID Папки', type: 'string' },
                    { name: 'size', label: 'Размер', type: 'number' }
                ]
            }
        ]

        let companyDb: any = await MoloDatabase.findOne({ enterpriseId, name: 'company' })
        if (!companyDb) {
            companyDb = await MoloDatabase.create({
                enterpriseId,
                name: 'company',
                title: 'Данные предприятия',
                description: 'Системное хранилище: реквизиты, справочники и файлы',
                collections: systemCollections,
                createdBy: { _id: actor.id, name: actor.name || 'System Sync' }
            })
        } else {
            const existing = companyDb.collections || []
            let changed = false
            for (const sysCol of systemCollections) {
                if (!existing.some((c: any) => c.name === sysCol.name)) {
                    existing.push(sysCol)
                    changed = true
                }
            }
            if (changed) {
                await MoloDatabase.updateOne({ _id: companyDb._id }, { $set: { collections: existing } })
            }
        }

        invalidateDefCache(enterpriseId, 'company')

        // Синхронизация профиля предприятия
        await runDbOp(
            { enterpriseId, db: 'company', col: 'profile', actor: { id: actor.id, isDev: true } },
            {
                op: 'update',
                filter: { isSelfCompany: true },
                patch: {
                    enterpriseName: enterprise.enterpriseName,
                    inn: String(enterprise.inn || ''),
                    kpp: String(enterprise.kpp || ''),
                    ogrn: String(enterprise.ogrn || ''),
                    legalAddress: enterprise.legalAddress || '',
                    director: enterprise.director || '',
                    phone: String(enterprise.phone || ''),
                    email: enterprise.email || '',
                    isSelfCompany: true,
                    updatedAt: new Date().toISOString()
                },
                upsert: true
            }
        )

        // Синхронизация записей справочников
        const directoryItems = await DirectoryItem.find({ enterpriseId: new mongoose.Types.ObjectId(enterpriseId) }).lean()
        let syncedDirectoryCount = 0

        for (const item of directoryItems) {
            const targetCol = item.directorySlug || 'departments'
            await runDbOp(
                { enterpriseId, db: 'company', col: targetCol, actor: { id: actor.id, isDev: true } },
                {
                    op: 'update',
                    filter: { sourceId: String(item._id) },
                    patch: {
                        sourceId: String(item._id),
                        code: item.code || '',
                        title: item.title,
                        description: item.description || '',
                        department: item.attributes?.department || '',
                        role: item.attributes?.role || '',
                        phone: item.attributes?.phone || '',
                        ...item.attributes,
                        updatedAt: new Date().toISOString()
                    },
                    upsert: true
                }
            )
            syncedDirectoryCount++
        }

        return {
            success: true,
            message: `Синхронизировано: ${syncedDirectoryCount} записей справочников в базу company`
        }
    } catch (e: any) {
        throw toHttpError(e)
    }
})