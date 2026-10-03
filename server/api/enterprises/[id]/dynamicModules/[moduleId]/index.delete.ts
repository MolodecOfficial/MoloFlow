import { defineEventHandler, createError, getRouterParam } from 'h3'
import { Types } from 'mongoose'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { Menu } from '~~/server/models/menu.model'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'
import { PERMISSIONS } from '~/types/permissions'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id') || event.context.params?.id
    const moduleId = getRouterParam(event, 'moduleId') || event.context.params?.moduleId

    if (!enterpriseId || !Types.ObjectId.isValid(enterpriseId)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Некорректный ID предприятия'
        })
    }

    if (!moduleId || !Types.ObjectId.isValid(moduleId)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Некорректный ID модуля'
        })
    }

    // 1. Проверяем право на разработку и модификацию модулей (MODULES_DEV)
    const { currentMember, effectiveRole } = await checkEnterpriseAccess(event, enterpriseId, {
        requiredPermission: PERMISSIONS.MODULES_DEV
    })

    // 2. Ищем целевой модуль
    const targetModule = await DynamicModule.findById(moduleId)
    if (!targetModule) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Модуль не найден'
        })
    }

    // 3. Защита от удаления чужого модуля:
    // Администратор и Управляющий могут удалять любые модули предприятия.
    // Программист может удалять свои модули (или любые, если авторство не указано).
    const isPrivileged = effectiveRole === 'Администратор' || effectiveRole === 'Управляющий'
    const isAuthor = !targetModule.createdBy?._id || String(targetModule.createdBy._id) === String(currentMember.userId)

    if (!isPrivileged && !isAuthor) {
        throw createError({
            statusCode: 403,
            statusMessage: 'У вас нет прав на удаление чужого модуля (удалить может автор или администратор)'
        })
    }

    // 4. Удаляем модуль
    await DynamicModule.findByIdAndDelete(moduleId)

    // 5. Каскадно вычищаем модуль из меню
    // 5. Каскадно вычищаем модуль из меню
    try {
        const moduleObjectId = new Types.ObjectId(moduleId)
        await Menu.updateMany(
            {},
            {
                $pull: {
                    items: {
                        $or: [
                            { moduleId: moduleObjectId },
                            { moduleId: moduleId },
                            { id: targetModule.fileName },
                            { placeName: targetModule.fileName }
                        ]
                    }
                }
            } as any
        )
    } catch (err) {
        console.warn('[DynamicModules] Ошибка очистки меню при удалении:', err)
    }

    return {
        success: true,
        message: 'Модуль успешно удалён'
    }
})