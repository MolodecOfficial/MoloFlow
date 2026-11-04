import { H3Event, createError, getHeader, getQuery, getRouterParam, readBody } from 'h3'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from './sessionToken'

const OID_RE = /^[a-f0-9]{24}$/i

export function getTenantId(event: H3Event): string | null {
    // 1. Из контекста h3 (установленного middleware)
    if (event.context.enterpriseId && OID_RE.test(String(event.context.enterpriseId))) {
        return String(event.context.enterpriseId)
    }

    // 2. Из параметров маршрута (:id или :enterpriseId)
    const param = getRouterParam(event, 'enterpriseId') || getRouterParam(event, 'id')
    if (param && OID_RE.test(param)) {
        event.context.enterpriseId = param
        return param
    }

    // 3. Из заголовка x-enterprise-id (подставляется автоматически клиентом)
    const headerId = getHeader(event, 'x-enterprise-id')
    if (headerId && OID_RE.test(headerId)) {
        event.context.enterpriseId = headerId
        return headerId
    }

    // 4. Из токенов (x-enterprise-token или Authorization Bearer)
    const token = (getHeader(event, 'x-enterprise-token') || getHeader(event, 'authorization'))?.replace(/^Bearer\s+/i, '').trim()
    if (token) {
        try {
            const decoded: any = jwt.verify(token, getJwtSecret())
            const entId = decoded?.enterpriseId || decoded?.tenantId
            if (entId && OID_RE.test(entId)) {
                event.context.enterpriseId = entId
                return entId
            }
        } catch {}
    }

    // 5. Из query (?enterpriseId=...)
    const qId = getQuery(event).enterpriseId
    if (typeof qId === 'string' && OID_RE.test(qId.trim())) {
        const clean = qId.trim()
        event.context.enterpriseId = clean
        return clean
    }

    return null
}

export function requireTenantId(event: H3Event): string {
    const id = getTenantId(event)
    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Не указан enterpriseId предприятия (контекст предприятия не найден)'
        })
    }
    return id
}
