export interface MenuItem {
    id: string;
    title: string;
    requiredRole: 'Пользователь' | 'Сотрудник' | 'Управляющий';
    isActive: boolean;
    order: number;
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
        order: 1,
        isActive: true,
        requiredRole: 'Сотрудник',
        items: [
            {
                id: 'employee_tasks',
                title: 'Мои задачи',
                requiredRole: 'Сотрудник',
                isActive: true,
                order: 1,
                componentName: 'dashboardEmployeeTasks'
            },
            {
                id: 'employee_documents',
                title: 'Документы',
                requiredRole: 'Сотрудник',
                isActive: true,
                order: 2,
                componentName: 'dashboardEmployeeDocuments'
            },
            {
                id: 'employee_schedule',
                title: 'График работы',
                requiredRole: 'Сотрудник',
                isActive: true,
                order: 3
            },
            {
                id: 'employee_reports',
                title: 'Отчеты',
                requiredRole: 'Сотрудник',
                isActive: true,
                order: 4
            },
        ]
    },
    {
        id: 'sfd',
        title: 'СФД',
        order: 2,
        isActive: true,
        requiredRole: 'Сотрудник',
        items: [
            {
                id: 'sfd1',
                title: 'Движение Денежных Средств',
                requiredRole: 'Сотрудник',
                isActive: true,
                order: 1
            },
            {
                id: 'sfd2',
                title: 'Инкассация',
                requiredRole: 'Сотрудник',
                isActive: true,
                order: 2
            }
        ]
    },
    {
        id: 'settings',
        title: 'Общие настройки',
        order: 3,
        isActive: true,
        requiredRole: 'Управляющий',
        items: [
            {
                id: 'enterprise',
                title: 'Предприятие',
                requiredRole: 'Управляющий',
                isActive: true,
                order: 1,
                items: [
                    {
                        id: 'control',
                        title: 'Управление предприятием',
                        requiredRole: 'Управляющий',
                        isActive: true,
                        order: 1,
                        componentName: 'settingsEnterpriseControl',
                        parentId: 'enterprise'
                    },
                ]
            },
            {
                id: 'test',
                title: 'test предприятия',
                requiredRole: 'Управляющий',
                isActive: true,
                order: 2,
                componentName: 'settingsTest'
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
        .filter(group => group.items.length > 0) // Убираем пустые группы
        .sort((a, b) => a.order - b.order); // Сортируем группы
}