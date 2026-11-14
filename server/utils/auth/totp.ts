import mongoose from 'mongoose'
import { authenticator } from 'otplib'

/**
 * Проблема: сервер Nitro работает ВНУТРИ приложения на ноутбуке пользователя,
 * поэтому Date.now() = системные часы этого ноутбука. Если они сбиты (часовой пояс,
 * нет синхронизации, разряженная батарейка и т.п.) — TOTP-коды из телефона
 * не совпадают, хотя всё введено правильно.
 *
 * Решение: берём "эталонное" время с сервера MongoDB (поле localTime в ответе hello)
 * и считаем TOTP по нему, а не по часам ноутбука.
 */

let offsetMs = 0
let lastSync = 0
const SYNC_INTERVAL = 5 * 60 * 1000

async function syncFromMongo(): Promise<boolean> {
    const db = mongoose.connection?.db
    if (!db) return false
    const t0 = Date.now()
    const res: any = await db.admin().command({ hello: 1 })
    const t1 = Date.now()
    if (!res?.localTime) return false
    offsetMs = new Date(res.localTime).getTime() - Math.round((t0 + t1) / 2)
    return true
}

async function syncFromHttp(): Promise<boolean> {
    const urls = ['https://www.google.com', 'https://www.cloudflare.com']
    for (const url of urls) {
        try {
            const t0 = Date.now()
            const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) })
            const t1 = Date.now()
            const header = r.headers.get('date')
            if (header) {
                offsetMs = new Date(header).getTime() - Math.round((t0 + t1) / 2)
                return true
            }
        } catch { /* пробуем следующий */ }
    }
    return false
}

async function syncTimeOffset() {
    if (lastSync && Date.now() - lastSync < SYNC_INTERVAL) return
    let ok = false
    try { ok = await syncFromMongo() } catch { /* ignore */ }
    if (!ok) { try { ok = await syncFromHttp() } catch { /* ignore */ } }
    if (ok) {
        lastSync = Date.now()
        if (Math.abs(offsetMs) > 5000) {
            console.warn(`[totp] Часы компьютера расходятся с реальным временем на ${Math.round(offsetMs / 1000)} сек — коррекция применена`)
        }
    }
}

/** Реальное время (мс) с поправкой на сбитые часы компьютера */
export async function trueNow(): Promise<number> {
    await syncTimeOffset()
    return Date.now() + offsetMs
}

/** Проверка TOTP-кода с учётом реального времени и допуском ±1 шаг (30 сек) */
export async function verifyTotp(token: string, secret: string): Promise<boolean> {
    const epoch = await trueNow()
    const auth = authenticator.clone({ epoch, window: 1 })
    try {
        return auth.verify({ token: String(token).replace(/\s+/g, ''), secret })
    } catch {
        return false
    }
}

export { authenticator }