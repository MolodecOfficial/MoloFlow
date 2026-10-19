// server/api/menu/init.post.ts
import { Menu } from '~~/server/models/menu.model'
import { seedDefaultMenu } from '~~/server/utils/defaultMenuSeed'

export default defineEventHandler(async () => {
    try {
        const existingGroups = await Menu.countDocuments()

        if (existingGroups > 0) {
            return {
                message: 'Меню уже инициализировано',
                initialized: false,
                count: existingGroups
            }
        }

        await seedDefaultMenu()
        const savedCount = await Menu.countDocuments()

        return {
            message: 'Полное дерево меню инициализировано',
            initialized: true,
            count: savedCount
        }
    } catch (error: any) {
        console.error('❌ Ошибка в POST /api/menu/init:', error.message)
        throw createError({
            statusCode: 500,
            message: error.message || 'Ошибка инициализации меню'
        })
    }
})