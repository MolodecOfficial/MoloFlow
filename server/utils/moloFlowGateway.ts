import { createError } from 'h3'

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i
const SLUG_RE = /^[a-z0-9][a-z0-9_/-]{0,63}$/i

export function isMoloFlowGatewayConfigured(): boolean {
    return Boolean(String(process.env.MOLOFLOW_GATEWAY_URL || '').trim())
}

function gatewayBaseUrl(): string {
    const raw = String(process.env.MOLOFLOW_GATEWAY_URL || '').trim().replace(/\/+$/, '')
    if (!raw) {
        throw createError({
            statusCode: 503,
            statusMessage: 'MoloFlow Gateway не настроен',
            message: 'Добавьте MOLOFLOW_GATEWAY_URL в переменные окружения MoloFlow'
        })
    }

    let parsed: URL
    try {
        parsed = new URL(raw)
    } catch {
        throw createError({ statusCode: 500, statusMessage: 'Некорректный URL MoloFlow Gateway' })
    }

    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
        throw createError({ statusCode: 500, statusMessage: 'MoloFlow Gateway URL должен использовать HTTPS' })
    }

    return raw
}

export function getMoloFlowGatewayPublicUrl(enterpriseId: string, slug: string): string {
    const id = String(enterpriseId || '').trim()
    const route = String(slug || '').trim().replace(/^\/+|\/+$/g, '')

    if (!OBJECT_ID_RE.test(id)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный enterpriseId для MoloFlow Gateway' })
    }
    if (!SLUG_RE.test(route) || route.includes('//') || route.split('/').some(part => !part || part === '.' || part === '..')) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный маршрут эндпоинта' })
    }

    return `${gatewayBaseUrl()}/v1/${id}/${route.split('/').map(encodeURIComponent).join('/')}`
}
