// server/api/enterprises/[id]/dynamicModules/[moduleId]/files/index.get.ts
import mongoose from 'mongoose'
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { runDbOp } from '~~/server/utils/moloDb/store'
import { ensureCompanyDb, COMPANY_DB, MODULES_COL } from '~~/server/utils/enterpriseDb'

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId')
    const enterpriseId = getRouterParam(event, 'id')

    if (!moduleId || !enterpriseId) {
        throw createError({ statusCode: 400, message: 'Отсутствуют параметры enterpriseId или moduleId' })
    }

    await ensureCompanyDb(enterpriseId)

    // 1. Поиск в глобальной базе DynamicModule
    const orConditions: Record<string, any>[] = [{ fileName: moduleId }]
    if (mongoose.Types.ObjectId.isValid(moduleId)) {
        orConditions.push({ _id: moduleId })
    }

    let moduleDoc: any = await DynamicModule.findOne({ enterpriseId, $or: orConditions })

    // 2. Если в глобальной нет — ищем в локальной базе предприятия
    if (!moduleDoc) {
        const { item } = await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system' } },
            { op: 'findOne', filter: { $or: [{ moduleId }, { fileName: moduleId }] } }
        )
        if (item) {
            moduleDoc = item
        }
    }

    if (!moduleDoc) {
        throw createError({ statusCode: 404, message: 'Модуль не найден' })
    }

    const files = (moduleDoc.files || []).map((file: any) => ({
        name: file.name,
        path: file.path,
        format: file.format,
        code: file.code || '',
        isServerFile: !!file.isServerFile,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
    }))

    return {
        success: true,
        mainFile: {
            name: `${moduleDoc.fileName}.${moduleDoc.format}`,
            path: `${moduleDoc.fileName}.${moduleDoc.format}`,
            format: moduleDoc.format,
            code: moduleDoc.code || ''
        },
        files
    }
})