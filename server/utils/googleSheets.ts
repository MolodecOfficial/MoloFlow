// server/utils/googleSheets.ts
// Клиент Google Sheets API на сервере. Аутентификация — сервисный аккаунт (JWT, RS256).
// Настройка: переменная окружения GOOGLE_SERVICE_ACCOUNT_JSON — содержимое JSON-ключа аккаунта.
// Каждая таблица, с которой работает MoloTable, должна быть расшарена на client_email этого аккаунта
// (роль «Редактор»).
import { createSign } from 'node:crypto'
import { createError } from 'h3'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const REQUEST_TIMEOUT_MS = 20_000

interface ServiceAccount {
    client_email: string
    private_key: string
}

let cachedToken: { value: string; expiresAt: number } | null = null

function loadServiceAccount(): ServiceAccount {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!raw) {
        throw createError({
            statusCode: 503,
            statusMessage: 'Google Sheets не настроен: задайте переменную GOOGLE_SERVICE_ACCOUNT_JSON',
        })
    }
    try {
        const sa = JSON.parse(raw)
        if (!sa?.client_email || !sa?.private_key) throw new Error('missing fields')
        return {
            client_email: String(sa.client_email),
            private_key: String(sa.private_key).replace(/\\n/g, '\n'),
        }
    } catch {
        throw createError({ statusCode: 500, statusMessage: 'GOOGLE_SERVICE_ACCOUNT_JSON повреждён или неверного формата' })
    }
}

export function serviceAccountEmail(): string {
    return loadServiceAccount().client_email
}

async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.value

    const sa = loadServiceAccount()
    const now = Math.floor(Date.now() / 1000)
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
    const claims = Buffer.from(JSON.stringify({
        iss: sa.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
    })).toString('base64url')
    const unsigned = `${header}.${claims}`
    const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url')

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${unsigned}.${signature}`,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
        console.error('[googleSheets] token request failed', res.status, await res.text().catch(() => ''))
        throw createError({ statusCode: 502, statusMessage: 'Не удалось получить доступ к Google (проверьте ключ сервисного аккаунта)' })
    }
    const json: any = await res.json()
    cachedToken = {
        value: String(json.access_token),
        expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    }
    return cachedToken.value
}

/**
 * Запрос к Sheets API. path — например `/<spreadsheetId>/values/...`.
 * Ошибки Google переводятся в понятные статусы, сырой ответ в клиент не уходит.
 */
export async function sheetsRequest(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    const token = await getAccessToken()
    const res = await fetch(`${SHEETS_API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (res.ok) return res.json()

    const detail = await res.text().catch(() => '')
    console.error('[googleSheets]', method, path.split('?')[0], res.status, detail.slice(0, 500))

    const who = serviceAccountEmail()
    if (res.status === 404) {
        throw createError({ statusCode: 404, statusMessage: 'Таблица или вкладка не найдена' })
    }
    if (res.status === 403) {
        throw createError({
            statusCode: 403,
            statusMessage: `Нет доступа к таблице. Откройте её для ${who} (роль «Редактор»)`,
        })
    }
    if (res.status === 429) {
        throw createError({ statusCode: 429, statusMessage: 'Слишком много запросов к Google Sheets, попробуйте позже' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Ошибка Google Sheets API' })
}

const SPREADSHEET_ID_RE = /^[a-zA-Z0-9_-]{20,200}$/

export function assertSpreadsheetId(value: unknown): string {
    if (typeof value !== 'string' || !SPREADSHEET_ID_RE.test(value)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный ID таблицы' })
    }
    return value
}

export function assertSheetTitle(value: unknown): string {
    if (typeof value !== 'string' || value.length < 1 || value.length > 100 || /[\u0000-\u001f]/.test(value)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректное название вкладки' })
    }
    return value
}

/** 'Лист 1' -> 'Лист 1' в кавычках, апострофы экранируются по правилам A1 */
export function quoteSheetTitle(title: string): string {
    return `'${title.replace(/'/g, "''")}'`
}

/** Допускается только диапазон одной вкладки: 'Имя'!A1 или 'Имя'!A1:C5 */
const A1_RANGE_RE = /^'(?:[^']|'')+'![A-Z]{1,3}\d{1,7}(?::[A-Z]{1,3}\d{1,7})?$/

export function assertA1Range(value: unknown): string {
    if (typeof value !== 'string' || value.length > 300 || !A1_RANGE_RE.test(value)) {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный диапазон' })
    }
    return value
}

/** Приводит значение ячейки к типу, который принимает Sheets: строка, число, логическое, или '' */
export function sanitizeCell(v: unknown): string | number | boolean {
    if (v === null || v === undefined) return ''
    if (typeof v === 'number') return Number.isFinite(v) ? v : ''
    if (typeof v === 'boolean') return v
    return String(v).slice(0, 50_000)
}
