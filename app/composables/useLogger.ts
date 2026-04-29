import { ref } from 'vue'

// Типы логов
export const logTypes = ['info', 'warning', 'error', 'success'] as const
export type LogType = typeof logTypes[number]

// Интерфейс для лога
export interface LogEntry {
    id: number
    type: LogType
    text: string
    timestamp: string
    source?: string
}

// Глобальное хранилище логов (экспортируем для доступа из других мест)
export const globalLogs = {
    logs: ref<LogEntry[]>([]),
    nextId: ref(1),
}

export function useLogger(source?: string) {
    const addLog = (type: LogType, text: string, dynamicParams?: Record<string, any>) => {
        // Автоматически определяем источник, если не передан
        let moduleSource = source || (typeof window !== 'undefined' && (window as any).__currentModuleName)


        let processedText = text
        if (dynamicParams) {
            Object.entries(dynamicParams).forEach(([key, value]) => {
                processedText = processedText.replace(`\${${key}}`, String(value))
            })
        }

        let finalText = processedText
        if (moduleSource && moduleSource !== 'unknown location') {
            finalText = `[${moduleSource}] ${finalText}`
        }

        const now = new Date()
        const timestamp = now.toLocaleTimeString('ru-RU', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }) + `.${now.getMilliseconds().toString().padStart(3, '0')}`

        const newLog: LogEntry = {
            id: globalLogs.nextId.value++,
            type,
            text: finalText,
            timestamp,
            source: moduleSource
        }

        globalLogs.logs.value.push(newLog)

        return newLog.id
    }

    const clearLogs = () => {
        globalLogs.logs.value = []
    }

    const removeLog = (id: number) => {
        globalLogs.logs.value = globalLogs.logs.value.filter(log => log.id !== id)
    }

    const getLogsByType = (type: LogType) => {
        return globalLogs.logs.value.filter(log => log.type === type)
    }

    const getLogsBySource = (source: string) => {
        return globalLogs.logs.value.filter(log => log.source === source)
    }

    return {
        logs: globalLogs.logs,
        addLog,
        clearLogs,
        removeLog,
        getLogsByType,
        getLogsBySource
    }
}