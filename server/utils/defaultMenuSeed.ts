// server/utils/defaultMenuSeed.ts
import { Menu } from '~~/server/models/menu.model'

export const DEFAULT_MENU_TREE = [
    {
        id: 'company',
        placeName: 'company',
        title: 'Настройки предприятия',
        order: 1,
        requiredRole: ['Управляющий', 'Администратор'],
        isActive: true,
        type: 'menu',
        items: [
            {
                id: 'enterprise',
                placeName: 'enterprise',
                title: 'Предприятие',
                type: 'item',
                requiredRole: ['Управляющий', 'Администратор'],
                isActive: true,
                items: [
                    {
                        id: 'register',
                        placeName: 'register',
                        title: 'Регистрация предприятия',
                        type: 'item',
                        requiredRole: ['Управляющий', 'Администратор'],
                        isActive: true,
                        componentName: 'Register',
                        componentPath: 'company/enterprise/Register'
                    },
                    {
                        id: 'login',
                        placeName: 'login',
                        title: 'Войти в предприятие',
                        type: 'item',
                        requiredRole: ['Управляющий', 'Администратор'],
                        isActive: true,
                        componentName: 'Login',
                        componentPath: 'company/enterprise/Login'
                    },
                    {
                        id: 'control',
                        placeName: 'control',
                        title: 'Управление предприятием',
                        type: 'item',
                        requiredRole: ['Управляющий', 'Администратор'],
                        isActive: true,
                        componentName: 'Control',
                        componentPath: 'company/enterprise/Control'
                    }
                ]
            },
            {
                id: 'molodb',
                placeName: 'molodb',
                title: 'Базы данных (MoloDB)',
                type: 'item',
                requiredRole: ['Управляющий', 'Администратор'],
                isActive: true,
                componentName: 'MoloDBStudio',
                componentPath: 'company/MoloDBStudio'
            },
            {
                id: 'termsOfUse',
                placeName: 'termsOfUse',
                title: 'Условия пользования',
                type: 'item',
                requiredRole: ['Управляющий', 'Администратор'],
                isActive: false,
                componentName: 'TermsOfUse',
                componentPath: 'company/TermsOfUse'
            }
        ]
    },
    {
        id: 'workspace_group',
        placeName: 'workspace_group',
        title: 'Рабочее пространство',
        order: 2,
        requiredRole: ['Сотрудник', 'Управляющий', 'Администратор'],
        isActive: true,
        type: 'menu',
        items: [
            {
                id: 'workspace',
                placeName: 'workspace',
                title: 'Пространство',
                type: 'item',
                isActive: true,
                componentName: 'Workspace'
            },
            {
                id: 'directory',
                placeName: 'directory',
                title: 'Справочники',
                type: 'item',
                isActive: true,
                componentName: 'Directory'
            }
        ]
    },
    {
        id: 'settings',
        placeName: 'settings',
        title: 'Настройки',
        order: 3,
        requiredRole: ['Сотрудник', 'Управляющий', 'Администратор'],
        isActive: true,
        type: 'menu',
        items: [
            {
                id: 'customisation',
                placeName: 'customisation',
                title: 'Кастомизация',
                type: 'item',
                requiredRole: ['Сотрудник', 'Управляющий', 'Администратор'],
                isActive: true,
                componentName: 'Customisation'
            }
        ]
    },
    {
        id: 'modules',
        placeName: 'modules',
        title: 'Модули',
        order: 4,
        requiredRole: ['Управляющий', 'Администратор'],
        isActive: true,
        type: 'module',
        items: [
            {
                id: 'creature',
                placeName: 'creature',
                title: 'Создание модуля',
                type: 'item',
                requiredRole: ['Управляющий', 'Администратор'],
                isActive: true,
                componentName: 'Creature',
                componentPath: 'modules/creature'
            },
            {
                id: 'browser',
                placeName: 'browser',
                title: 'Браузер',
                type: 'item',
                requiredRole: ['Управляющий', 'Администратор'],
                isActive: true,
                componentName: 'Browser',
                componentPath: 'modules/browser'
            },
            {
                id: 'preview',
                placeName: 'preview',
                title: 'Предпоказ модуля',
                type: 'item',
                requiredRole: ['Управляющий', 'Администратор'],
                isActive: false,
                componentName: 'Preview',
                componentPath: 'modules/preview'
            }
        ]
    }
]

export async function seedDefaultMenu() {
    const count = await Menu.countDocuments()
    if (count > 0) return false

    for (const group of DEFAULT_MENU_TREE) {
        const newGroup = new Menu(group)
        await newGroup.save()
    }
    return true
}