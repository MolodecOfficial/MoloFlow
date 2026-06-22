// server/api/menu/init.post.ts
import { Menu } from '~~/server/models/menu.model';

export default defineEventHandler(async (event) => {
    try {
        const existingGroups = await Menu.countDocuments();

        if (existingGroups > 0) {
            return {
                message: 'Меню уже инициализировано',
                initialized: false,
                count: existingGroups
            };
        }

        const fullMenu: any[] = [
            {
                id: 'company',
                placeName: 'company',
                title: 'Настройки предприятия',
                order: 3,
                requiredRole: ['Управляющий'],
                isActive: true,
                type: 'menu',
                items: [
                    {
                        id: 'enterprise',
                        placeName: 'enterprise',
                        title: 'Предприятие',
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        items: [
                            {
                                id: 'register',
                                placeName: 'register',
                                title: 'Регистрация предприятия',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Register',
                                componentPath: 'company/enterprise/Register'
                            },
                            {
                                id: 'login',
                                placeName: 'login',
                                title: 'Войти в предприятие',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Login',
                            },
                            {
                                id: 'control',
                                placeName: 'control',
                                title: 'Управление предприятием',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Control',
                            },
                        ]
                    },
                    {
                        id: 'points',
                        placeName: 'points',
                        title: 'Точки',
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        items: [
                            {
                                id: 'ProblemPoints',
                                placeName: 'ProblemPoints',
                                title: 'Проблемные точки',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'ProblemPoints'
                            },
                            {
                                id: 'ConfigurePoints',
                                placeName: 'ConfigurePoints',
                                title: 'Конфигурация точки',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'ConfigurePoints'
                            }
                        ]
                    },
                    {
                        id: 'termsOfUse',
                        placeName: 'termsOfUse',
                        title: 'Условия пользования',
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: false,
                        componentName: 'TermsOfUse'
                    }
                ]
            },
            {
                id: 'settings',
                placeName: 'settings',
                title: 'Настройки',
                order: 4,
                requiredRole: ['Сотрудник', 'Управляющий'],
                isActive: true,
                type: 'menu',
                items: [
                    {
                        id: 'customisation',
                        placeName: 'customisation',
                        title: 'Кастомизация',
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                        componentName: 'Customisation'
                    },
                    {
                        id: 'confirm',
                        placeName: 'confirm',
                        title: 'Подтверждение',
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: false,
                        componentName: 'Confirm'
                    }
                ]
            },
            {
                id: 'modules',
                placeName: 'modules',
                title: 'Модули',
                order: 5,
                requiredRole: ['Управляющий'],
                isActive: true,
                type: 'module',
                items: [
                    {
                        id: 'creature',
                        placeName: 'creature',
                        title: 'Создание модуля',
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        componentName: 'Creature',
                        componentPath: 'modules/creature'
                    },
                    {
                        id: 'preview',
                        placeName: 'preview',
                        title: 'Предпоказ модуля',
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: false,
                        componentName: 'Preview',
                        componentPath: 'modules/preview'
                    }
                ]
            },
            {
                id: 'search',
                placeName: 'search',
                title: 'Поиск модуля',
                order: 6,
                requiredRole: ['Управляющий'],
                isActive: true,
                type: 'module',
                items: [
                    {
                        id: 'browser',
                        placeName: 'browser',
                        title: 'Браузер',
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        componentName: 'Browser',
                        componentPath: 'modules/browser'
                    }
                ]
            }
        ];

        for (const group of fullMenu) {
            const newGroup = new Menu(group);
            await newGroup.save();
            console.log(`✅ Создана группа: ${group.title}`);
        }

        const savedCount = await Menu.countDocuments();

        return {
            message: 'Полное меню инициализировано',
            initialized: true,
            count: savedCount
        };

    } catch (error: any) {
        console.error('❌ Ошибка в POST /api/menu/init:', error.message);
        throw createError({
            statusCode: 500,
            message: error.message || 'Ошибка инициализации меню'
        });
    }
});