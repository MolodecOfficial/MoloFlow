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
                        componentName: 'settingsEnterpriseCreature',
                        parentId: 'enterprise'
                    },
                    {
                        id: 'control',
                        title: 'Управление предприятием',
                        requiredRole: 'Управляющий',
                        isActive: true,
                        componentName: 'settingsEnterpriseControl',
                        parentId: 'enterprise'
                    },
                ]
            },
            {
                id: 'termsOfUse',
                title: 'Условия пользования',
                requiredRole: 'Управляющий',
                isActive: false,
                componentName: 'settingsTermsOfUse'
            },
        ]
    }
];

export function getMenuByRole(role: string): MenuGroup[] {
    return menuConfig
        .filter(group =>
            group.isActive !== false &&
            group.requiredRole === role // Фильтруем группы по роли
        )
        .map(group => ({
            ...group,
            items: group.items
                .filter(item => item.requiredRole === role && item.isActive)
                .sort((a, b) => a.order - b.order)
        }))
        .sort((a, b) => a.order - b.order); // Сортируем группы
}