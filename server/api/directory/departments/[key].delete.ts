import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { Department } from '~~/server/models/department.model'
import { DirectoryItem } from '~~/server/models/directoryItem.model'

export default defineEventHandler(async (event) => {
    const keyParam = getRouterParam(event, 'key')
    const query = getQuery(event)
    const enterpriseId = query.enterpriseId as string

    if (!keyParam || !enterpriseId) {
        throw createError({
            statusCode: 400,
            message: 'Параметры key и enterpriseId обязательны'
        })
    }

    const cleanKey = String(keyParam).trim().toLowerCase()

    // 1. Ищем удаляемый отдел
    const dept = await Department.findOne({
        enterpriseId,
        key: cleanKey
    })

    if (!dept) {
        throw createError({
            statusCode: 404,
            message: 'Отдел не найден'
        })
    }

    // 2. Снимаем привязку отдела у сотрудников и карточек предприятия
    await DirectoryItem.updateMany(
        {
            enterpriseId,
            $or: [
                { 'attributes.departmentKey': cleanKey },
                { 'attributes.department': dept.name }
            ]
        },
        {
            $unset: {
                'attributes.departmentKey': 1,
                'attributes.department': 1
            }
        }
    )

    // 3. Удаляем сам отдел
    await Department.deleteOne({ _id: dept._id })

    return {
        success: true,
        deletedKey: cleanKey,
        deletedName: dept.name
    }
})