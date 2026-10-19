// server/utils/authIdentity.ts
// Единственное место, где сервер узнаёт, кто делает запрос.
// Никаких x-user-id / x-user-name / query.userId — их можно подделать.
import { getHeader, getCookie, type H3Event } from 'h3'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'

export interface SessionIdentity {
    userId: string
    source: 'context' | 'jwt' | 'legacy-token'
}

function readRawToken(event: H3Event): string | null {
    const header = getHeader(event, 'authorization') || getHeader(event, 'x-enterprise-token')
    if (header) return header.replace(/^Bearer\s+/i, '').trim() || null
    return getCookie(event, 'enterprise_token') || getCookie(event, 'token') || null
}

export function resolveSessionIdentity(event: H3Event): SessionIdentity | null {
    // 1. Уже проставлено middleware
    const ctxUser = event.context.user
    const ctxId = ctxUser?._id || ctxUser?.id
    if (ctxId) return { userId: String(ctxId), source: 'context' }

    const raw = readRawToken(event)
    if (!raw) return null

    // 2. Подписанный JWT (без дефолтного секрета — если его нет, проверку пропускаем)
    const config = useRuntimeConfig()
    const secret = config.jwtSecret || config.tokenSecret
    if (secret) {
        try {
            const decoded: any = jwt.verify(raw, secret)
            const id = decoded.userId || decoded._id || decoded.id
            if (id && Types.ObjectId.isValid(String(id))) return { userId: String(id), source: 'jwt' }
        } catch {
            // не JWT или просрочен — пробуем legacy
        }
    }

    // 3. Legacy: токен = сам _id пользователя. Временно, пока логин не выдаёт JWT.
    if (Types.ObjectId.isValid(raw)) return { userId: raw, source: 'legacy-token' }

    return null
}