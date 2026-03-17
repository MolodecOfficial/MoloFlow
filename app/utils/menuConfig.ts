export interface MenuItem {
    id: string;
    title: string;
    requiredRole: ('Пользователь' | 'Сотрудник' | 'Управляющий')[];
    isActive: boolean;
    componentName?  : string
    items?: MenuItem[];
    parentId?: string
}

export interface MenuGroup {
    id: string;
    title: string;
    order: number;
    requiredRole: ('Пользователь' | 'Сотрудник' | 'Управляющий')[];
    isActive?: boolean;
    items: MenuItem[];
}

export const menuConfig: MenuGroup[] = [
    {
        id: 'dashboard',
        title: 'Панель',
        isActive: true,
        requiredRole: 'Сотрудник',
        items: [
            {
                id: 'employee_tasks',
                title: 'Мои задачи',
                requiredRole: 'Сотрудник',
                isActive: true,
                componentName: 'dashboardEmployeeTasks'
            },
            {
                id: 'employee_documents',
                title: 'Документы',
                requiredRole: 'Сотрудник',
                isActive: true,
                componentName: 'dashboardEmployeeDocuments'
            },
            {
                id: 'employee_schedule',
                title: 'График работы',
                requiredRole: 'Сотрудник',
                isActive: true,
            },
            {
                id: 'employee_reports',
                title: 'Отчеты',
                requiredRole: 'Сотрудник',
                isActive: true,
            },
        ]
    },
    {
        id: 'sfd',
        title: 'СФД',
        isActive: true,
        requiredRole: 'Сотрудник',
        items: [
            {
                id: 'sfd1',
                title: 'Движение Денежных Средств',
                requiredRole: 'Сотрудник',
                isActive: true,
            },
            {
                id: 'sfd2',
                title: 'Инкассация',
                requiredRole: 'Сотрудник',
                isActive: true,
            }
        ]
    },
    {
        id: 'company',
        title: 'Настройки предприятия',
        isActive: true,
        requiredRole: 'Управляющий',
        items: [
            {
                id: 'enterprise',
                title: 'Предприятие',
                requiredRole: 'Управляющий',
                isActive: true,
                items: [
                    {
                        id: 'creature',
                        title: 'Создание предприятия',
                        requiredRole: 'Управляющий',
                        isActive: true,
                        componentName: 'Creature',
                        parentId: 'enterprise'
                    },
                    {
                        id: 'login',
                        title: 'Войти в предприятие',
                        requiredRole: 'Управляющий',
                        isActive: true,
                        componentName: 'Login',
                        parentId: 'enterprise'
                    },
                    {
                        id: 'control',
                        title: 'Управление предприятием',
                        requiredRole: 'Управляющий',
                        isActive: true,
                        componentName: 'Control',
                        parentId: 'enterprise'
                    },
                    {
                        id: 'createPoint',
                        title: 'Создание точки',
                        requiredRole: 'Управляющий',
                        isActive: false,
                        componentName: 'CreatePoint',
                        parentId: 'enterprise',
                    },{
                        id: 'createEmployee',
                        title: 'Создание сотрудника',
                        requiredRole: 'Управляющий',
                        isActive: false,
                        componentName: 'CreateEmployee',
                        parentId: 'enterprise',
                    },{
                        id: 'createPlan',
                        title: 'Создание плана',
                        requiredRole: 'Управляющий',
                        isActive: false,
                        componentName: 'CreatePlan',
                        parentId: 'enterprise',
                    },
                ]
            },
            {
                id: 'points',
                title: 'Точки',
                requiredRole: 'Управляющий',
                isActive: true,
                componentName: 'Points',
                items: [
                    {
                        id: 'ProblemPoints',
                        title: 'Проблемные точки',
                        requiredRole: 'Управляющий',
                        isActive: true,
                        componentName: 'ProblemPoints',
                        parentId: 'points'
                    },
                    {
                        id: 'ConfigurePoints',
                        title: 'Конфигурация точки',
                        requiredRole: 'Управляющий',
                        isActive: true,
                        componentName: 'ConfigurePoints',
                        parentId: 'points'
                    },
                ]
            },
            {
                id: 'termsOfUse',
                title: 'Условия пользования',
                requiredRole: 'Управляющий',
                isActive: false,
                componentName: 'TermsOfUse'
            },
        ]
    },
    {
        id: 'settings',
        title: 'Настройки',
        requiredRole: ['Сотрудник', 'Управляющий'],
        isActive: true,
        items: [
            {
                id: 'customisation',
                title: 'Кастомизация',
                requiredRole: ['Сотрудник', 'Управляющий'],
                isActive: true,
                componentName: 'Customisation'
            }
        ]
    }

];

export function getMenuByRole(role: string): MenuGroup[] {
    return menuConfig
        .filter(group => {
            if (group.isActive === false) return false

            // Проверяем requiredRole - может быть строкой или массивом
            if (Array.isArray(group.requiredRole)) {
                return group.requiredRole.includes(role)
            } else {
                return group.requiredRole === role
            }
        })
        .map(group => ({
            ...group,
            items: group.items
                .filter(item => {
                    if (item.isActive === false) return false

                    if (Array.isArray(item.requiredRole)) {
                        return item.requiredRole.includes(role)
                    } else {
                        return item.requiredRole === role
                    }
                })
                .map(item => ({
                    ...item,
                    items: item.items
                        ?.filter(child => {
                            if (child.isActive === false) return false

                            if (Array.isArray(child.requiredRole)) {
                                return child.requiredRole.includes(role)
                            } else {
                                return child.requiredRole === role
                            }
                        })
                }))
        }))
}