// server/api/menu/index.get.ts
import { defineEventHandler } from 'h3'
import { Menu } from '~~/server/models/menu.model'
import { seedDefaultMenu } from '~~/server/utils/defaultMenuSeed'

export default defineEventHandler(async () => {
    let groups = await Menu.find({ isActive: { $ne: false } })
        .sort({ order: 1 })
        .lean()
        .exec()

    // Если коллекция была удалена или пуста — инициализируем полное дерево в MongoDB
    if (!groups || groups.length === 0) {
        await seedDefaultMenu()
        groups = await Menu.find({ isActive: { $ne: false } })
            .sort({ order: 1 })
            .lean()
            .exec()
    }

    return { groups }
})