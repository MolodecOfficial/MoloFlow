import { ref } from 'vue'
import notificationsConfig from '~~/data/notifications.json'

const config = notificationsConfig

// Глобальное хранилище
const globalNotifications = {
    notifications: ref<any[]>([]),
    nextId: ref(1)
}

// Флаг для предотвращения повторного вызова
let isCheckingNotifications = false

export function useNotifications() {
    const addNotification = (key: string) => {
        // @ts-ignore
        const data: any = config.notifications[key]
        if (!data) return false

        if (data.single) {
            const shownKey = `notification_shown_${key}`
            if (localStorage.getItem(shownKey)) {
                return false
            }
            localStorage.setItem(shownKey, 'true')
        }

        // Проверяем, нет ли уже такого уведомления
        const existing = globalNotifications.notifications.value.find(n =>
            n.title === data.title && n.text === data.text
        )

        if (existing) {
            return false
        }

        const newNotification = {
            id: globalNotifications.nextId.value++,
            type: data.type,
            title: data.title,
            text: data.text
        }
        
        globalNotifications.notifications.value.unshift(newNotification)
        return true
    }

    const removeNotification = (id: number) => {
        globalNotifications.notifications.value = globalNotifications.notifications.value.filter(n => n.id !== id)
    }

    const clearNotifications = () => {
        globalNotifications.notifications.value = []
    }

    const checkAndShowNotifications = (role: string, userId?: string) => {
        // Предотвращаем повторный вызов
        if (isCheckingNotifications) {
            console.log('Уведомления уже проверяются')
            return
        }

        isCheckingNotifications = true

        try {
            const roleNotifications = config.conditions.userBased.roles[role as keyof typeof config.conditions.userBased.roles]
            if (roleNotifications) {
                roleNotifications.forEach(key => addNotification(key))
            }

            if (userId) {
                const userNotifications = config.conditions.userBased.users[userId as keyof typeof config.conditions.userBased.users]
                if (userNotifications) {
                    userNotifications.forEach(key => addNotification(key))
                }
            }
        } finally {
            // Сбрасываем флаг с задержкой
            setTimeout(() => {
                isCheckingNotifications = false
            }, 100)
        }
    }

    return {
        notifications: globalNotifications.notifications,
        addNotification,
        removeNotification,
        clearNotifications,
        checkAndShowNotifications
    }
}