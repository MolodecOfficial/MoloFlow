export interface MenuItem {
    id: string;
    title: string;
    requiredRole: 'Пользователь' | 'Сотрудник' | 'Управляющий';
    isActive: boolean;
    componentName?  : string
    items?: MenuItem[];
    parentId?: string
}

export interface MenuGroup {
    id: string;
    title: string;
    order: number;
    requiredRole: 'Пользователь' | 'Сотрудник' | 'Управляющий';
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
        id: 'settings',
        title: 'Общие настройки',
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
                id: 'termsOfUse',
                title: 'Условия пользования',
                requiredRole: 'Управляющий',
                isActive: false,
                componentName: 'TermsOfUse'
            },

        ]
    }
];

export function getMenuByRole(role: string): MenuGroup[] {
    return menuConfig
        .filter(group =>
            group.isActive !== false &&
            group.requiredRole === role
        )
        .map(group => ({
            ...group,
            items: group.items
                .filter(item =>
                    item.requiredRole === role &&
                    item.isActive !== false
                )
                .map(item => ({
                    ...item,
                    items: item.items
                        ?.filter(child =>
                            child.requiredRole === role &&
                            child.isActive !== false
                        )
                }))
        }))
}