// server/api/enterprises/[id]/dynamicModules/[moduleId]/dependencies/index.get.ts
import mongoose from 'mongoose'
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { runDbOp } from '~~/server/utils/moloDb/store'
import { ensureCompanyDb, COMPANY_DB, MODULES_COL } from '~~/server/utils/enterpriseDb'

export default defineEventHandler(async (event) => {
    try {
        const moduleId = getRouterParam(event, 'moduleId')
        const enterpriseId = getRouterParam(event, 'id')

        if (!moduleId || !enterpriseId) {
            throw createError({ statusCode: 400, message: 'Отсутствуют параметры' })
        }

        await ensureCompanyDb(enterpriseId)

        const orConditions: Record<string, any>[] = [{ fileName: moduleId }]
        if (mongoose.Types.ObjectId.isValid(moduleId)) {
            orConditions.push({ _id: moduleId })
        }

        let moduleDoc: any = await DynamicModule.findOne({ enterpriseId, $or: orConditions })

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

        const toPlainObject = (val: any) => {
            if (!val) return {}
            if (val instanceof Map) return Object.fromEntries(val)
            return typeof val === 'object' ? val : {}
        }

        return {
            dependencies: toPlainObject(moduleDoc.dependencies),
            devDependencies: toPlainObject(moduleDoc.devDependencies),
            serverEntry: moduleDoc.serverEntry || '',
            composables: moduleDoc.composables || []
        }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({
            statusCode: 500,
            message: error.message || 'Внутренняя ошибка сервера'
        })
    }
})