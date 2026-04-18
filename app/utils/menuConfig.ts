export interface MenuItem {
    id: string;
    title: string;
    requiredRole: ('Пользователь' | 'Сотрудник' | 'Управляющий')[];
    isActive: boolean;
    componentName?: string
    componentPath?: string;
    items?: MenuItem[];
    parentId?: string
}

export interface MenuGroup {
    id: string;
    title: string;
    order?: number;
    requiredRole: ('Пользователь' | 'Сотрудник' | 'Управляющий')[];
    isActive?: boolean;
    items?: MenuItem[];
}

export const menuConfig: MenuGroup[] = [
    {
        id: 'dashboard',
        title: 'Панель',
        isActive: true,
        requiredRole: ['Сотрудник'],
        items: [
            {
                id: 'employee_tasks',
                title: 'Мои задачи',
                requiredRole: ['Сотрудник'],
                isActive: true,
                componentName: 'dashboardEmployeeTasks'
            },
            {
                id: 'employee_documents',
                title: 'Документы',
                requiredRole: ['Сотрудник'],
                isActive: true,
                componentName: 'dashboardEmployeeDocuments'
            },
            {
                id: 'employee_schedule',
                title: 'График работы',
                requiredRole: ['Сотрудник'],
                isActive: true,
            },
            {
                id: 'employee_reports',
                title: 'Отчеты',
                requiredRole: ['Сотрудник'],
                isActive: true,
            },
        ]
    },
    {
        id: 'sfd',
        title: 'СФД',
        isActive: true,
        requiredRole: ['Сотрудник'],
        items: [
            {
                id: 'sfd1',
                title: 'Движение Денежных Средств',
                requiredRole: ['Сотрудник'],
                isActive: true,
            },
            {
                id: 'sfd2',
                title: 'Инкассация',
                requiredRole: ['Сотрудник'],
                isActive: true,
            }
        ]
    },
    {
        id: 'company',
        title: 'Настройки предприятия',
        isActive: true,
        requiredRole: ['Управляющий'],
        items: [
            {
                id: 'enterprise',
                title: 'Предприятие',
                requiredRole: ['Управляющий'],
                isActive: true,
                items: [
                    {
                        id: 'creature',
                        title: 'Создание предприятия',
                        requiredRole: ['Управляющий'],
                        isActive: true,
                        componentName: 'Creature',
                        componentPath: 'company/enterprise/Creature',
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
                        parentId: 'enterprise',
                    },
                    {
                        id: 'createEmployee',
                        title: 'Создание сотрудника',
                        requiredRole: ['Управляющий'],
                        isActive: false,
                        componentName: 'CreateEmployee',
                        componentPath: 'company/enterprise/CreateEmployee',
                        parentId: 'enterprise',
                    },
                    {
                        id: 'createPlan',
                        title: 'Создание плана',
                        requiredRole: ['Управляющий'],
                        isActive: false,
                        componentName: 'CreatePlan',
                        componentPath: 'company/enterprise/CreatePlan',
                        parentId: 'enterprise',
                    },
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
                    },
                ]
            },
            {
                id: 'termsOfUse',
                title: 'Условия пользования',
                requiredRole: ['Управляющий'],
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

];

export const moduleConfig: MenuGroup[] = [
    {
        id: 'modules',
        title: 'Модули',
        requiredRole: ['Управляющий'],
        isActive: true,
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
    {
        id: 'search',
        title: 'Поиск модуля',
        requiredRole: ['Управляющий'],
        isActive: true,
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

export function filterGroupsByRole(groups: MenuGroup[], role: string): MenuGroup[] {
    const filterItems = (items: MenuItem[]): MenuItem[] => {
        return items
            .filter(item => item.isActive !== false && item.requiredRole.includes(role))
            .map(item => ({
                ...item,
                items: item.items ? filterItems(item.items) : undefined
            }))
            .filter(item => !item.items || item.items.length > 0)
    }

    return groups
        .filter(group => group.isActive !== false && group.requiredRole.includes(role))
        .map(group => ({
            ...group,
            items: filterItems(group.items)
        }))
        .filter(group => group.items.length > 0)
}