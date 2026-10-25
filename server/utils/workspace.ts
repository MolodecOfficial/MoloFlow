import { versionModel } from './workspaceCollections'
import { createError, getQuery, getRouterParam, readBody, type H3Event } from 'h3'
import type { Types } from 'mongoose'
import { tenantModels } from './tenantDb'

export const DOC_TYPES = ['excel', 'word', 'pdf', 'primary', 'image'] as const
export type DocType = typeof DOC_TYPES[number]
export type DocData = Record<string, any> | string

export const MAX_CONTENT_BYTES = 15 * 1024 * 1024
export const MAX_VERSIONS = 20
export const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000
const MAX_SEARCH_CHARS = 500_000
const OID_RE = /^[a-f\d]{24}$/i

export const httpError = (statusCode: number, message: string) => createError({ statusCode, message })

/**
 * Возвращает id предприятия из ?enterpriseId=. Без 'default': невалидный id → 400.
 * ВАЖНО: это только валидация формата. Права проверяет resolveActor() в каждом эндпоинте.
 */
export function getEnterpriseId(event: H3Event): string {
    const raw = getQuery(event).enterpriseId
    const value = Array.isArray(raw) ? raw[0] : raw
    const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (!OID_RE.test(id)) throw httpError(400, 'Некорректный enterpriseId')
    return id
}

export function parseObjectId(value: unknown, label = 'id'): string {
    if (typeof value !== 'string' || !OID_RE.test(value)) throw httpError(400, `Некорректный ${label}`)
    return value.toLowerCase()
}

export async function readJsonBody(event: H3Event): Promise<Record<string, any>> {
    const body = await readBody(event)
    if (body === undefined || body === null || body === '') return {}
    if (typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Тело запроса должно быть JSON-объектом')
    return body as Record<string, any>
}

export const getRouteId = (event: H3Event, param = 'id') => parseObjectId(getRouterParam(event, param), param)

export function parseName(value: unknown): string {
    const name = typeof value === 'string' ? value.trim() : ''
    if (!name) throw httpError(400, 'Название не может быть пустым')
    return name.slice(0, 200)
}

export function parseType(value: unknown): DocType {
    if (!DOC_TYPES.includes(value as DocType)) throw httpError(400, 'Неизвестный тип документа')
    return value as DocType
}

export function parseDate(value: unknown): Date {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? new Date(n) : new Date()
}

/** null / '' → корень; иначе папка должна существовать в БД этого предприятия */
export async function resolveFolderId(enterpriseId: string, value: unknown): Promise<string | null> {
    if (value === null || value === undefined || value === '') return null
    const id = parseObjectId(value, 'folderId')
    const { WorkspaceFolder } = tenantModels(enterpriseId)
    if (!(await WorkspaceFolder.exists({ _id: id }))) throw httpError(404, 'Папка не найдена')
    return id
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* ───────── Содержимое ───────── */
export function encodeData(type: DocType, data: unknown): string {
    if (type === 'word' || type === 'pdf' || type === 'image') {
        if (data !== undefined && data !== null && typeof data !== 'string') {
            throw httpError(400, `Для ${type} data должно быть строкой`)
        }
        return (data as string | undefined | null) ?? ''
    }
    if (data === undefined || data === null) return '{}'
    if (typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'Для таблицы data должно быть объектом')
    return JSON.stringify(data)
}

export function decodeData(type: DocType, content: string): DocData {
    if (type === 'word' || type === 'pdf' || type === 'image') return content || ''
    try {
        const parsed = JSON.parse(content || '{}')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
        return {}
    }
}

export function assertContentSize(content: string) {
    if (Buffer.byteLength(content) > MAX_CONTENT_BYTES) {
        throw httpError(413, 'Документ слишком большой (максимум 15 МБ). Уменьшите размер вставленных изображений')
    }
}

export const contentSize = (content: string) => Buffer.byteLength(content)

export function extractSearchText(type: DocType, content: string): string {
    if (type === 'pdf' || type === 'image') return ''
    let text = ''
    if (type === 'word') {
        text = content
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
    } else {
        try {
            const snapshot = JSON.parse(content || '{}')
            const parts: string[] = []
            for (const sheet of Object.values<any>(snapshot?.sheets || {})) {
                if (sheet?.name) parts.push(String(sheet.name))
                for (const row of Object.values<any>(sheet?.cellData || {})) {
                    for (const cell of Object.values<any>(row || {})) {
                        const v = cell?.v
                        if (v !== undefined && v !== null && v !== '') parts.push(String(v))
                    }
                }
            }
            text = parts.join(' ')
        } catch {
            text = ''
        }
    }
    return text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_SEARCH_CHARS)
}

/* ───────── Сериализация ───────── */
const ms = (d: Date | string | number) => new Date(d).getTime()

export function serializeFolder(f: any) {
    return {
        id: String(f._id),
        name: f.name as string,
        parentId: f.parentId ? String(f.parentId) : null,
        createdAt: ms(f.createdAt),
        updatedAt: ms(f.updatedAt)
    }
}

export function serializeDocument(d: any) {
    return {
        id: String(d._id),
        folderId: d.folderId ? String(d.folderId) : null,
        name: d.name as string,
        type: d.type as DocType,
        size: (d.size ?? 0) as number,
        createdAt: ms(d.createdAt),
        updatedAt: ms(d.updatedAt)
    }
}

export function serializeVersion(v: any) {
    return {
        id: String(v._id),
        createdAt: ms(v.createdAt),
        comment: (v.comment ?? '') as string,
        size: (v.size ?? 0) as number
    }
}

/* ───────── Версии ───────── */
type SnapshotSource = { _id: Types.ObjectId | string; enterpriseId: string; content: string }

export async function createSnapshot(doc: SnapshotSource, comment: string) {
    const WorkspaceDocumentVersion = versionModel(doc.enterpriseId, doc._id)
    const version = await WorkspaceDocumentVersion.create({
        documentId: doc._id,
        enterpriseId: doc.enterpriseId,
        content: doc.content,
        size: contentSize(doc.content),
        comment: comment.slice(0, 200)
    })
    const stale = await WorkspaceDocumentVersion.find({ documentId: doc._id })
        .sort({ createdAt: -1 })
        .skip(MAX_VERSIONS)
        .select('_id')
        .lean()
    if (stale.length) {
        await WorkspaceDocumentVersion.deleteMany({ _id: { $in: stale.map((v: any) => v._id) } })
    }
    return version
}

/** Вызывается ПЕРЕД перезаписью content: сохраняет старое состояние, если давно не сохраняли */
export async function maybeAutoSnapshot(doc: SnapshotSource) {
    if (!doc.content || doc.content === '{}') return
    const WorkspaceDocumentVersion = versionModel(doc.enterpriseId, doc._id)
    const last: any = await WorkspaceDocumentVersion.findOne({ documentId: doc._id })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean()
    if (last && Date.now() - ms(last.createdAt) < AUTO_SNAPSHOT_INTERVAL_MS) return
    await createSnapshot(doc, 'Автосохранение')
}
