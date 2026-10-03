// server/api/embed-proxy.get.ts
import { defineEventHandler, getQuery, createError, sendStream } from 'h3'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const targetUrl = String(query.url || '').trim()

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный URL' })
    }

    try {
        const upstreamRes = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            redirect: 'follow'
        })

        const contentType = upstreamRes.headers.get('content-type') || 'text/html'
        event.node.res.setHeader('Content-Type', contentType)

        // Снимаем запреты на встраивание для родительского окна Nuxt
        event.node.res.removeHeader('X-Frame-Options')
        event.node.res.removeHeader('Content-Security-Policy')

        if (upstreamRes.body) {
            return sendStream(event, upstreamRes.body as any)
        }
        return await upstreamRes.text()
    } catch (err: any) {
        throw createError({
            statusCode: 502,
            statusMessage: `Ошибка подключения к ресурсу: ${err?.message || err}`
        })
    }
})