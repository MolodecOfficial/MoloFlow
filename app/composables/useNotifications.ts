import { ref } from 'vue'

// Типы уведомлений (только 3 типа)
export const noticeTypes = ['info', 'warning', 'error'] as const
export type NoticeType = typeof noticeTypes[number]

export interface NoticeEntry {
    id: number
    type: NoticeType
    title?: string
    text: string
    source?: string
}

// Глобальное хранилище
export const globalNotifications = {
    notifications: ref<NoticeEntry[]>([]),
    nextId: ref(1),
}

export function useNotifications(source?: string) {

    // ПРОСТАЯ функция добавления уведомления
    const addNotification = (type: NoticeType, text: string, title?: string) => {
        // Определяем источник
        const moduleSource = source || getCallerSource()

        // Формируем заголовок (если не передан - используем стандартный)
        let finalTitle = title || getDefaultTitle(type)

        // Добавляем источник к заголовку
        if (moduleSource) {
            finalTitle = `[${moduleSource}] ${finalTitle}`
        }

        // Создаём уведомление
        const newNotification: NoticeEntry = {
            id: globalNotifications.nextId.value++,
            type,
            title: finalTitle,
            text,
            source: moduleSource
        }

        // Добавляем в начало
        globalNotifications.notifications.value.unshift(newNotification)


        return true
    }

    const removeNotification = (id: number) => {
        globalNotifications.notifications.value = globalNotifications.notifications.value.filter(n => n.id !== id)
    }

    const clearNotifications = () => {
        globalNotifications.notifications.value = []
    }

    return {
        notifications: globalNotifications.notifications,
        addNotification,
        removeNotification,
        clearNotifications
    }
}

function getDefaultTitle(type: NoticeType): string {
    switch (type) {
        case 'info': return 'Информация о выполнении'
        case 'warning': return 'Предупреждение'
        case 'error': return 'Ошибка'
        default: return 'Уведомление'
    }
}

// Простая функция для получения источника
function getCallerSource(): string {
    const stack = new Error().stack?.split('\n') || []

    for (let i = 3; i < stack.length; i++) {
        const line = stack[i]
        const match = line.match(/(\w+\.vue)/)
        if (match) {
            return match[1].replace('.vue', '')
        }
    }

    return ''
}