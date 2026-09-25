import { defineEventHandler } from 'h3'
import { Menu } from '~~/server/models/menu.model'

export default defineEventHandler(async () => {
    // Забираем все активные группы меню платформы
    const groups = await Menu.find({ isActive: { $ne: false } })
        .sort({ order: 1 })
        .lean()
        .exec()

    // Если база меню ещё не заполнена записями, отдаём единую базовую структуру
    if (!groups || groups.length === 0) {
        return {
            groups: [
                {
                    _id: 'default_core',
                    title: 'Главное меню',
                    items: [
                        { id: 'workspace', placeName: 'workspace', title: 'Пространство', isActive: true },
                        { id: 'directory', placeName: 'directory', title: 'Справочники', isActive: true },
                        { id: 'control', placeName: 'control', title: 'Управление', isActive: true },
                        { id: 'configurator', placeName: 'configurator', title: 'Доступ', isActive: true },
                        { id: 'browser', placeName: 'browser', title: 'Модули', isActive: true },
                        { id: 'creature', placeName: 'creature', title: 'Создание модуля', isActive: true }
                    ]
                }
            ]
        }
    }

    return { groups }
})