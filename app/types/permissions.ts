export type UserRole =
    | 'Администратор'
    | 'Управляющий'
    | 'Бухгалтер'
    | 'Программист'
    | 'Сотрудник'
    | 'Наблюдатель'
    | 'Пользователь'

export const PERMISSIONS = {
    // Пространство и файлы
    WORKSPACE_VIEW: 'workspace:view',
    WORKSPACE_EDIT: 'workspace:edit',

    // Справочники
    DIRECTORY_VIEW: 'directory:view',
    DIRECTORY_EDIT: 'directory:edit',

    // Управление доступом
    ACCESS_MANAGE: 'access:manage',

    // Разработка и модули
    MODULES_DEV: 'modules:dev',
    MODULES_BROWSE: 'modules:browse',

    // Панель управления
    CONTROL_PANEL: 'control:view'
} as const

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS]

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
    Администратор: Object.values(PERMISSIONS),
    Управляющий: [
        PERMISSIONS.WORKSPACE_VIEW,
        PERMISSIONS.WORKSPACE_EDIT,
        PERMISSIONS.DIRECTORY_VIEW,
        PERMISSIONS.DIRECTORY_EDIT,
        PERMISSIONS.ACCESS_MANAGE,
        PERMISSIONS.CONTROL_PANEL,
        PERMISSIONS.MODULES_BROWSE
    ],
    Программист: [
        PERMISSIONS.WORKSPACE_VIEW,
        PERMISSIONS.WORKSPACE_EDIT,
        PERMISSIONS.DIRECTORY_VIEW,
        PERMISSIONS.MODULES_DEV,
        PERMISSIONS.MODULES_BROWSE,
        PERMISSIONS.CONTROL_PANEL
    ],
    Бухгалтер: [
        PERMISSIONS.WORKSPACE_VIEW,
        PERMISSIONS.WORKSPACE_EDIT,
        PERMISSIONS.DIRECTORY_VIEW,
        PERMISSIONS.DIRECTORY_EDIT,
        PERMISSIONS.CONTROL_PANEL
    ],
    Сотрудник: [
        PERMISSIONS.WORKSPACE_VIEW,
        PERMISSIONS.WORKSPACE_EDIT,
        PERMISSIONS.DIRECTORY_VIEW,
        PERMISSIONS.CONTROL_PANEL
    ],
    Наблюдатель: [
        PERMISSIONS.WORKSPACE_VIEW,
        PERMISSIONS.DIRECTORY_VIEW,
        PERMISSIONS.CONTROL_PANEL
    ],
    Пользователь: [
        PERMISSIONS.WORKSPACE_VIEW,
        PERMISSIONS.DIRECTORY_VIEW
    ]
}