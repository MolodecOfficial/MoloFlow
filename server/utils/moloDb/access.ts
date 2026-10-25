// server/utils/moloDb/access.ts
//
// Кто и что может делать с базами:
//   • участник предприятия (сессия MoloFlow)  — читает и пишет данные, роли ограничивают отдельные коллекции;
//   • разработчик (право MODULES_DEV)           — ещё и меняет структуру баз и эндпоинты;
//   • модуль / Python-бот                       — по токену x-molo-db-token, только данные своего предприятия.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createError, getHeader, type H3Event } from 'h3'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '~/types/permissions'
import type { DbActor } from './store'
import { tenantModels } from '~~/server/utils/tenantDb'

const TOKEN_ID_RE = /^[a-f0-9]{24}$/i

export type DbNeed = 'data' | 'schema'
export interface ResolvedActor extends DbActor {
    name?: string
}

// ── токены модулей ─────────────────────────────────────────────

let secretPromise: Promise<string> | null = null

/** Ключ подписи хранится в самой MongoDB и создаётся при первом обращении — настраивать ничего не нужно. */
async function signingSecret(): Promise<string> {
    if (secretPromise) return secretPromise
    secretPromise = (async () => {
        const { default: mongoose } = await import('mongoose')
        const db = mongoose.connection.db
        if (!db) throw createError({ statusCode: 503, message: 'MongoDB ещё не подключена' })
        const col: any = db.collection('molo_settings')
        await col.updateOne({ _id: 'moloDbTokenSecret' }, { $setOnInsert: { value: randomBytes(32).toString('hex') } }, { upsert: true })
        const doc = await col.findOne({ _id: 'moloDbTokenSecret' })
        return String(doc.value)
    })().catch((e) => {
        secretPromise = null
        throw e
    })
    return secretPromise
}

const sign = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex')

export async function issueModuleToken(enterpriseId: string, moduleId: string): Promise<string> {
    const payload = `${enterpriseId}.${moduleId}`
    return `${payload}.${sign(await signingSecret(), payload)}`
}

const activeCache = new Map<string, { at: number; ok: boolean }>()

async function verifyModuleToken(token: string): Promise<{ enterpriseId: string; moduleId: string } | null> {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [enterpriseId, moduleId, sig] = parts
    if (!TOKEN_ID_RE.test(enterpriseId) || !TOKEN_ID_RE.test(moduleId)) return null

    const expected = sign(await signingSecret(), `${enterpriseId}.${moduleId}`)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null

    // Токен действует, пока модуль существует и включён (результат кэшируется на 30 секунд)
    const key = `${enterpriseId}:${moduleId}`
    const hit = activeCache.get(key)
    if (hit && Date.now() - hit.at < 30_000) return hit.ok ? { enterpriseId, moduleId } : null
    const ok = !!(await tenantModels(enterpriseId).DynamicModule.exists({ _id: moduleId, isActive: true }))
    activeCache.set(key, { at: Date.now(), ok })
    return ok ? { enterpriseId, moduleId } : null
}

// ── определение актора ─────────────────────────────────────────

export async function resolveActor(event: H3Event, enterpriseId: string, need: DbNeed = 'data'): Promise<ResolvedActor> {
    const token = getHeader(event, 'x-molo-db-token')
    if (token) {
        if (need === 'schema') {
            throw createError({ statusCode: 403, message: 'Токен модуля не даёт права менять структуру баз' })
        }
        const info = await verifyModuleToken(token)
        if (!info || info.enterpriseId !== enterpriseId) {
            throw createError({ statusCode: 401, message: 'Недействительный токен модуля' })
        }
        return { kind: 'module', id: info.moduleId }
    }

    const { effectiveRole, userId, user } = await checkEnterpriseAccess(event, enterpriseId)
    if (need === 'schema') {
        const privileged = effectiveRole === 'Администратор' || effectiveRole === 'Управляющий'
        const permissions = ROLE_DEFAULT_PERMISSIONS[effectiveRole] || []
        if (!privileged && !permissions.includes(PERMISSIONS.MODULES_DEV)) {
            throw createError({ statusCode: 403, message: 'Недостаточно прав: требуется роль администратора/управляющего или разрешение на разработку модулей' })
        }
    }
    return { kind: 'user', id: userId, role: effectiveRole, name: user?.name }
}

/** Превращает ошибки ядра баз в HTTP-ошибки (message без statusMessage — там нельзя кириллицу). */
export function toHttpError(e: any) {
    if (e?.name === 'MoloDbError') return createError({ statusCode: e.statusCode || 400, message: e.message })
    if (e?.statusCode) return e
    console.error('[MoloDB]', e)
    return createError({ statusCode: 500, message: e?.message || 'Ошибка MoloDB' })
}