import { defineEventHandler, getRouterParam, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { requireTenantId } from '~~/server/utils/tenantContext'

export default defineEventHandler(async (event) => {
    try {
        const key = String(getRouterParam(event, 'key') || '').trim().toLowerCase()
        const enterpriseId = requireTenantId(event)
        if (!key) throw createError({ statusCode: 400, message: 'key обязателен' })
        await resolveActor(event, enterpriseId, 'data')

        const { Department, DirectoryItem } = tenantModels(enterpriseId)
        const dept: any = await Department.findOne({ key }).lean()
        if (!dept) throw createError({ statusCode: 404, message: 'Отдел не найден' })

        await DirectoryItem.updateMany(
            { enterpriseId, $or: [{ 'attributes.departmentKey': key }, { 'attributes.department': dept.name }] },
            { $unset: { 'attributes.departmentKey': '', 'attributes.department': '' } }
        )
        await Department.deleteOne({ _id: dept._id })
        return { success: true, deletedKey: key, deletedName: dept.name }
    } catch (e) {
        throw toHttpError(e)
    }
})
