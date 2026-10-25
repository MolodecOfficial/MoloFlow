import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { allDirectoryModels } from '~~/server/utils/directoryCollections'

// DELETE /api/directory/departments/:key?enterpriseId=
// Снимает привязку к отделу у записей всех справочников и удаляет сам отдел.
export default defineEventHandler(async (event) => {
    try {
        const key = String(getRouterParam(event, 'key') || '').trim().toLowerCase()
        const enterpriseId = String(getQuery(event).enterpriseId || '')
        if (!key || !enterpriseId) throw createError({ statusCode: 400, message: 'key и enterpriseId обязательны' })
        await resolveActor(event, enterpriseId, 'data')

        const { Department } = tenantModels(enterpriseId)
        const dept: any = await Department.findOne({ key }).lean()
        if (!dept) throw createError({ statusCode: 404, message: 'Отдел не найден' })

        for (const model of await allDirectoryModels(enterpriseId)) {
            await model.updateMany(
                { $or: [{ 'attributes.departmentKey': key }, { 'attributes.department': dept.name }] },
                { $unset: { 'attributes.departmentKey': '', 'attributes.department': '' } }
            )
        }
        await Department.deleteOne({ _id: dept._id })
        return { success: true, deletedKey: key, deletedName: dept.name }
    } catch (e) {
        throw toHttpError(e)
    }
})
