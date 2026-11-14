import { createError } from 'h3'

export function gsheetsBridgeUrl(): string {
  const url = String(process.env.GOOGLE_APPS_SCRIPT_URL || '').trim()
  if (!url) throw createError({ statusCode: 503, statusMessage: 'Google Таблицы не настроены: добавьте GOOGLE_APPS_SCRIPT_URL в переменные окружения сервера. См. app/docs/google-sheets-sync/README.md' })
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(url)) {
    throw createError({ statusCode: 500, statusMessage: 'Некорректный GOOGLE_APPS_SCRIPT_URL: используйте URL опубликованного Google Apps Script Web App (/exec).' })
  }
  return url
}

export async function callGsheetsBridge<T>(params: Record<string, any>, body?: Record<string, any>): Promise<T> {
  const url = gsheetsBridgeUrl()
  try {
    const result: any = await $fetch<T>(url, body
      ? { method: 'POST', body, query: params, redirect: 'follow', timeout: 25_000 }
      : { method: 'GET', query: params, redirect: 'follow', timeout: 25_000 })
    if (result && typeof result === 'object' && result.error) throw createError({ statusCode: 502, statusMessage: String(result.error) })
    return result as T
  } catch (error: any) {
    const message = error?.statusMessage || error?.data?.error || error?.data?.message || error?.message || 'Не удалось обратиться к Google Apps Script'
    throw createError({ statusCode: 502, statusMessage: `Google Таблицы: ${message}` })
  }
}
