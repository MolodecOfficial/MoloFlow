import { EventEmitter } from 'node:events'

// Шина живёт в globalThis, чтобы HMR/повторные импорты не плодили несколько экземпляров
const g = globalThis as any
const bus: EventEmitter = (g.__moloAccessBus ??= new EventEmitter())
bus.setMaxListeners(0)

/**
 * Сообщает всем открытым сессиям, что права изменились.
 * Вызывайте ПОСЛЕ сохранения в БД — в обработчиках добавления участника,
 * смены роли и удаления участника:
 *
 *   publishAccessChange(enterpriseId, userId)   // конкретный человек
 *   publishAccessChange(enterpriseId)           // все участники предприятия
 *   publishAccessChange('*', userId)            // системная (глобальная) роль человека изменилась
 */
export function publishAccessChange(enterpriseId: string, userId?: string) {
    bus.emit('access', {
        enterpriseId: String(enterpriseId),
        userId: userId ? String(userId) : null
    })
}

export function onAccessChange(enterpriseId: string, userId: string, cb: () => void) {
    const handler = (p: { enterpriseId: string; userId: string | null }) => {
        // '*' — глобальное изменение (например, системная роль), касается всех предприятий
        if (p.enterpriseId !== '*' && p.enterpriseId !== String(enterpriseId)) return
        if (p.userId && p.userId !== String(userId)) return
        cb()
    }
    bus.on('access', handler)
    return () => bus.off('access', handler)
}