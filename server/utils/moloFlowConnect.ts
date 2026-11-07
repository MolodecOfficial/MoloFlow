import { createError } from 'h3'

type ConnectAuth = {
    enabled: boolean
    keyHash: string
}

type ConnectResult = {
    success: boolean
    publicUrl?: string
    updatedAt?: string
    message?: string
}

function connectConfig() {
    const baseUrl = String(process.env.MOLOFLOW_CONNECT_URL || '')
        .trim()
        .replace(/\/+$/, '')

    const publishKey = String(process.env.MOLOFLOW_CONNECT_PUBLISH_KEY || '').trim()

    if (!baseUrl || !publishKey) {
        throw createError({
            statusCode: 503,
            statusMessage: 'MoloFlow Connect не настроен',
            message: 'Добавьте MOLOFLOW_CONNECT_URL и MOLOFLOW_CONNECT_PUBLISH_KEY в серверный .env'
        })
    }

    let parsed: URL

    try {
        parsed = new URL(baseUrl)
    } catch {
        throw createError({
            statusCode: 500,
            statusMessage: 'Некорректный URL MoloFlow Connect'
        })
    }

    if (parsed.protocol !== 'https:') {
        throw createError({
            statusCode: 500,
            statusMessage: 'MoloFlow Connect URL должен использовать HTTPS'
        })
    }

    return { baseUrl, publishKey }
}

function validateRoute(enterpriseId: string, slug: string) {
    if (!/^[a-f0-9]{24}$/i.test(enterpriseId)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Некорректный enterpriseId для MoloFlow Connect'
        })
    }

    const normalized = String(slug || '')
        .trim()
        .replace(/^\/+|\/+$/g, '')

    if (
        !/^[a-z0-9][a-z0-9_/-]{0,127}$/i.test(normalized) ||
        normalized.includes('//') ||
        normalized.split('/').some(p => !p || p === '.' || p === '..')
    ) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Некорректный маршрут эндпоинта'
        })
    }

    return normalized
}

function adminUrl(baseUrl: string, enterpriseId: string, route: string) {
    return `${baseUrl}/_admin/v1/${enterpriseId}/${route}`
}

function adminHeaders(publishKey: string) {
    return {
        Authorization: `Bearer ${publishKey}`
    }
}

function normalizeAuth(auth: ConnectAuth): ConnectAuth {
    if (typeof auth.enabled !== 'boolean') {
        throw createError({
            statusCode: 400,
            statusMessage: 'Не указано состояние авторизации Connect'
        })
    }

    if (auth.enabled && !/^[a-f0-9]{64}$/i.test(auth.keyHash)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Для защищённого эндпоинта необходим SHA-256 ключа'
        })
    }

    return {
        enabled: auth.enabled,
        keyHash: auth.enabled ? auth.keyHash.toLowerCase() : ''
    }
}

export async function publishMoloFlowSnapshot(
    enterpriseId: string,
    slug: string,
    data: unknown,
    auth: ConnectAuth
): Promise<ConnectResult> {
    const route = validateRoute(enterpriseId, slug)
    const { baseUrl, publishKey } = connectConfig()
    const safeAuth = normalizeAuth(auth)

    try {
        return await $fetch<ConnectResult>(
            adminUrl(baseUrl, enterpriseId, route),
            {
                method: 'POST',
                headers: adminHeaders(publishKey),
                body: {
                    data,
                    auth: safeAuth
                },
                timeout: 20000
            }
        )
    } catch (error: any) {
        const message =
            error?.data?.error ||
            error?.data?.message ||
            error?.statusMessage ||
            error?.message ||
            'Не удалось опубликовать эндпоинт'

        throw createError({
            statusCode: error?.statusCode || 502,
            statusMessage: 'Ошибка MoloFlow Connect',
            message: String(message)
        })
    }
}

export async function updateMoloFlowSnapshotAuth(
    enterpriseId: string,
    slug: string,
    auth: ConnectAuth
): Promise<void> {
    const route = validateRoute(enterpriseId, slug)
    const { baseUrl, publishKey } = connectConfig()
    const safeAuth = normalizeAuth(auth)

    try {
        await $fetch(
            adminUrl(baseUrl, enterpriseId, route),
            {
                method: 'PUT',
                headers: adminHeaders(publishKey),
                body: { auth: safeAuth },
                timeout: 15000
            }
        )
    } catch (error: any) {
        const message =
            error?.data?.error ||
            error?.data?.message ||
            error?.statusMessage ||
            error?.message ||
            'Не удалось обновить авторизацию'

        throw createError({
            statusCode: error?.statusCode || 502,
            statusMessage: 'Ошибка обновления авторизации MoloFlow Connect',
            message: String(message)
        })
    }
}

export async function unpublishMoloFlowSnapshot(
    enterpriseId: string,
    slug: string
): Promise<void> {
    const route = validateRoute(enterpriseId, slug)
    const { baseUrl, publishKey } = connectConfig()

    try {
        await $fetch(
            adminUrl(baseUrl, enterpriseId, route),
            {
                method: 'DELETE',
                headers: adminHeaders(publishKey),
                timeout: 15000
            }
        )
    } catch (error: any) {
        const message =
            error?.data?.error ||
            error?.data?.message ||
            error?.statusMessage ||
            error?.message ||
            'Не удалось снять публикацию'

        throw createError({
            statusCode: error?.statusCode || 502,
            statusMessage: 'Ошибка MoloFlow Connect',
            message: String(message)
        })
    }
}

export function getMoloFlowConnectPublicUrl(
    enterpriseId: string,
    slug: string
) {
    const route = validateRoute(enterpriseId, slug)
    const { baseUrl } = connectConfig()

    return `${baseUrl}/v1/${enterpriseId}/${route}`
}