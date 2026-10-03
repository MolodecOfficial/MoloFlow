// utils/urlHelper.ts
export function normalizeUrl(input: string): string {
    let target = input.trim()
    if (!target) return ''

    // 1. Внутренние роуты самого приложения Nuxt (/workspace, /directory)
    if (target.startsWith('/') && !target.startsWith('//')) {
        return target
    }

    // 2. Локальные хосты (localhost:3000, 127.0.0.1:8080)
    if (/^(localhost|127\.0\.0\.1)(:\d+)?/i.test(target)) {
        return `http://${target}`
    }

    // 3. Специфические протоколы (data, blob)
    if (/^(data|blob):/i.test(target)) {
        return target
    }

    // 4. Обычные доменные имена (ozon.ru -> https://ozon.ru)
    if (!/^https?:\/\//i.test(target)) {
        target = 'https://' + target
    }

    return target
}

export function extractHostname(url: string): string {
    try {
        if (url.startsWith('/')) return `Route: ${url}`
        return new URL(url).hostname
    } catch {
        return url
    }
}