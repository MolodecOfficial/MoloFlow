// server/utils/authIdentity.ts
// Единственный источник личности пользователя: подписанный JWT с полем userId.
// Токен предприятия (enterprises/login) личность не задаёт, поэтому по нему доступа не будет.
import { getHeader, getCookie, type H3Event } from 'h3'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'
import { getJwtSecret, SESSION_COOKIE } from './sessionToken'

export interface SessionIdentity {
    userId: string
    source: 'context' | 'jwt'
}

const isOid = (v: unknown): v is string =>
    typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) && Types.ObjectId.isValid(v)

/** Все токены, которые могут прийти с запросом: заголовки и cookie. */
function candidateTokens(event: H3Event): string[] {
    const out: string[] = []
    const auth = getHeader(event, 'authorization')
    if (auth) out.push(auth.replace(/^Bearer\s+/i, '').trim())
    const ent = getHeader(event, 'x-enterprise-token')
    if (ent) out.push(ent.trim())
    for (const name of [SESSION_COOKIE, 'token']) {
        const c = getCookie(event, name)
        if (c) out.push(c)
    }
    return [...new Set(out.filter(Boolean))]
}

export function resolveSessionIdentity(event: H3Event): SessionIdentity | null {
    const ctxUser = event.context.user
    const ctxId = ctxUser?._id || ctxUser?.id
    if (ctxId) return { userId: String(ctxId), source: 'context' }

    const secret = getJwtSecret()
    for (const raw of candidateTokens(event)) {
        try {
            const decoded: any = jwt.verify(raw, secret)
            if (decoded?.type === 'user' && isOid(decoded.userId)) {
                return { userId: decoded.userId, source: 'jwt' }
            }
        } catch {
            // чужой, просроченный или подделанный токен — пробуем следующий
        }
    }
    return null
}
