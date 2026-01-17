export type NotificationType = 'notice' | 'danger' | 'error'

export interface NotificationData {
    type: NotificationType
    title: string
    text: string
    autoClose?: boolean
    duration?: number
    single?: boolean
}

export interface Notification extends NotificationData {
    id: number
}

export interface NotificationsConfig {
    notifications: Record<string, NotificationData>
    conditions: {
        userBased: {
            roles: Record<string, string[]>
            users: Record<string, string[]>
        }
    }
}

export type NotificationKey = keyof NotificationsConfig['notifications']
export type UserRole = string
export type UserName = string