// server/api/menu/init.post.ts
import {Menu} from '~~/server/models/menu.model';

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
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                        componentName: 'dashboardEmployeeTasks'
                    },
                    {
                        id: 'employee_documents',
                        title: 'Документы',
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                        componentName: 'dashboardEmployeeDocuments'
                    },
                    {
                        id: 'employee_schedule',
                        title: 'График работы',
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true
                    },
                    {
                        id: 'employee_reports',
                        title: 'Отчеты',
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true
                    }
                ]
            },
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
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true
                    },
                    {
                        id: 'sfd2',
                        title: 'Инкассация',
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true
                    }
                ]
            },
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
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        items: [
                            {
                                id: 'register',
                                title: 'Регистрация предприятия',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Register',
                                componentPath: 'company/enterprise/Register'
                            },
                            {
                                id: 'login',
                                title: 'Войти в предприятие',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Login',
                                componentPath: 'company/enterprise/Login'
                            },
                            {
                                id: 'control',
                                title: 'Управление предприятием',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'Control',
                                componentPath: 'company/enterprise/Control'
                            },
                            {
                                id: 'createPoint',
                                title: 'Создание точки',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: false,
                                componentName: 'CreatePoint',
                                componentPath: 'company/enterprise/CreatePoint'
                            },
                            {
                                id: 'createEmployee',
                                title: 'Создание сотрудника',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: false,
                                componentName: 'CreateEmployee',
                                componentPath: 'company/enterprise/CreateEmployee'
                            },
                            {
                                id: 'createPlan',
                                title: 'Создание плана',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: false,
                                componentName: 'CreatePlan',
                                componentPath: 'company/enterprise/CreatePlan'
                            }
                        ]
                    },
                    {
                        id: 'points',
                        title: 'Точки',
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        items: [
                            {
                                id: 'ProblemPoints',
                                title: 'Проблемные точки',
                                type: 'item',
                                requiredRole: ['Управляющий'],
                                isActive: true,
                                componentName: 'ProblemPoints'
                            },
                            {
                                id: 'ConfigurePoints',
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
                title: 'Настройки',
                order: 4,
                requiredRole: ['Сотрудник', 'Управляющий'],
                isActive: true,
                type: 'menu',
                items: [
                    {
                        id: 'customisation',
                        title: 'Кастомизация',
                        type: 'item',
                        requiredRole: ['Сотрудник', 'Управляющий'],
                        isActive: true,
                        componentName: 'Customisation'
                    },
                    {
                        id: 'confirm',
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
                title: 'Модули',
                order: 5,
                requiredRole: ['Управляющий'],
                isActive: true,
                type: 'module',
                items: [
                    {
                        id: 'creature',
                        title: 'Создание модуля',
                        type: 'item',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        componentName: 'Creature',
                        componentPath: 'modules/creature'
                    },
                    {
                        id: 'preview',
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
                title: 'Поиск модуля',
                order: 6,
                requiredRole: ['Управляющий'],
                isActive: true,
                type: 'module',
                items: [
                    {
                        id: 'browser',
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
