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

        // Полное меню со всеми пунктами
        const fullMenu: any[] = [
            // Группа "Панель"
            {
                id: 'dashboard',
                title: 'Панель',
                order: 1,
                requiredRole: ['Сотрудник', 'Управляющий'],
                isActive: true,
                type: 'menu',
                items: [
                    {
                        id: 'employee_tasks',
                        title: 'Мои задачи',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                        componentName: 'dashboardEmployeeTasks'
                    },
                    {
                        id: 'employee_documents',
                        title: 'Документы',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                        componentName: 'dashboardEmployeeDocuments'
                    },
                    {
                        id: 'employee_schedule',
                        title: 'График работы',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                    },
                    {
                        id: 'employee_reports',
                        title: 'Отчеты',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                    },
                ]
            },

            // Группа "СФД"
            {
                id: 'sfd',
                title: 'СФД',
                order: 2,
                requiredRole: ['Сотрудник', 'Управляющий'],
                isActive: true,
                type: 'menu',
                items: [
                    {
                        id: 'sfd1',
                        title: 'Движение Денежных Средств',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                    },
                    {
                        id: 'sfd2',
                        title: 'Инкассация',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                    }
                ]
            },

            // Группа "Настройки предприятия"
            {
                id: 'company',
                title: 'Настройки предприятия',
                order: 3,
                requiredRole: ['Управляющий'],
                isActive: true,
                type: 'menu',
                items: [
                    {
                        id: 'enterprise',
                        title: 'Предприятие',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        items: [
                            {
                                id: 'register',
                                title: 'Регистрация предприятия',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Register',
                                componentPath: 'company/enterprise/Register',
                                parentId: 'enterprise'
                            },
                            {
                                id: 'login',
                                title: 'Войти в предприятие',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Login',
                                componentPath: 'company/enterprise/Login',
                                parentId: 'enterprise'
                            },
                            {
                                id: 'control',
                                title: 'Управление предприятием',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Control',
                                componentPath: 'company/enterprise/Control',
                                parentId: 'enterprise'
                            },
                            {
                                id: 'createPoint',
                                title: 'Создание точки',
                                requiredRole: ['Управляющий'],
                                isActive: false,
                                componentName: 'CreatePoint',
                                componentPath: 'company/enterprise/CreatePoint',
                                parentId: 'enterprise'
                            },
                            {
                                id: 'createEmployee',
                                title: 'Создание сотрудника',
                                requiredRole: ['Управляющий'],
                                isActive: false,
                                componentName: 'CreateEmployee',
                                componentPath: 'company/enterprise/CreateEmployee',
                                parentId: 'enterprise'
                            },
                            {
                                id: 'createPlan',
                                title: 'Создание плана',
                                requiredRole: ['Управляющий'],
                                isActive: false,
                                componentName: 'CreatePlan',
                                componentPath: 'company/enterprise/CreatePlan',
                                parentId: 'enterprise'
                            }
                        ]
                    },
                    {
                        id: 'points',
                        title: 'Точки',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        componentName: 'Points',
                        items: [
                            {
                                id: 'ProblemPoints',
                                title: 'Проблемные точки',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'ProblemPoints',
                                parentId: 'points'
                            },
                            {
                                id: 'ConfigurePoints',
                                title: 'Конфигурация точки',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'ConfigurePoints',
                                parentId: 'points'
                            }
                        ]
                    },
                    {
                        id: 'termsOfUse',
                        title: 'Условия пользования',
                        requiredRole: ['Управляющий'],
                        isActive: false,
                        componentName: 'TermsOfUse'
                    }
                ]
            },

            // Группа "Настройки"
            {
                id: 'settings',
                title: 'Настройки',
                order: 4,
                requiredRole: ['Сотрудник', 'Управляющий'],
                isActive: true,
                type: 'menu',
                items: [
                    {
                        id: 'customisation',
                        title: 'Кастомизация',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                        componentName: 'Customisation'
                    },
                    {
                        id: 'confirm',
                        title: 'Подтверждение',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: false,
                        componentName: 'Confirm'
                    }
                ]
            },

            // Группа "Модули" (статические модули)
            {
                id: 'modules',
                title: 'Модули',
                order: 5,
                requiredRole: ['Управляющий'],
                isActive: true,
                type: 'module',
                items: [
                    {
                        id: 'creature',
                        title: 'Создание модуля',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        componentName: 'Creature',
                        componentPath: 'modules/creature'
                    },
                    {
                        id: 'preview',
                        title: 'Предпоказ модуля',
                        requiredRole: ['Управляющий'],
                        isActive: false,
                        componentName: 'Preview',
                        componentPath: 'modules/preview'
                    }
                ]
            },

            // Группа "Поиск модуля"
            {
                id: 'search',
                title: 'Поиск модуля',
                order: 6,
                requiredRole: ['Управляющий'],
                isActive: true,
                type: 'module',
                items: [
                    {
                        id: 'browser',
                        title: 'Браузер',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        componentName: 'Browser',
                        componentPath: 'modules/browser'
                    }
                ]
            }
        ];

        // Сохраняем все группы
        for (const group of fullMenu) {
            const newGroup = new Menu(group);
            await newGroup.save();
            console.log(`Создана группа: ${group.title}`);
        }

        const savedCount = await Menu.countDocuments();

        return {
            message: 'Полное меню инициализировано',
            initialized: true,
            groups: fullMenu,
            count: savedCount
        };

    } catch (error: any) {
        console.error('Ошибка в POST /api/menu/init:', error);
        throw createError({
            statusCode: 500,
            message: error.message || 'Ошибка инициализации меню'
        });
    }
});