// server/utils/sessionToken.ts
// Токен пользователя. Выдаётся при входе (2FA) и кладётся в httpOnly-cookie «molo_session».
import jwt from 'jsonwebtoken'
import { createError, setCookie, type H3Event } from 'h3'

export const SESSION_COOKIE = 'molo_session'
const TTL_SECONDS = 60 * 60 * 24 * 7

/** Секрет подписи. Берётся из .env (JWT_SECRET). Без него токены не выдаются и не проверяются. */
export function getJwtSecret(): string {
    const config: any = useRuntimeConfig()
    const secret = config.jwtSecret || process.env.JWT_SECRET || process.env.NUXT_JWT_SECRET
    if (!secret || String(secret).length < 16) {
        throw createError({ statusCode: 500, message: 'В .env не задан JWT_SECRET (минимум 16 символов)' })
    }
    return String(secret)
}

export function issueUserToken(userId: string): string {
    return jwt.sign({ userId: String(userId), type: 'user' }, getJwtSecret(), { expiresIn: TTL_SECONDS })
}

export function setSessionCookie(event: H3Event, token: string) {
    setCookie(event, SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: !import.meta.dev,
        path: '/',
        maxAge: TTL_SECONDS
    })
}
