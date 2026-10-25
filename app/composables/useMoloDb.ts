// app/composables/useMoloDb.ts
//
// Мини-базы MoloFlow на клиенте. В Vue-модулях и JS/TS-скриптах импортировать не нужно:
// useMoloDb и useMoloDbAdmin прокидываются глобально (см. moduleComposables.client.ts).
//
//   const db = useMoloDb('botlog')
//   const msgs = db.messages                      // то же, что db.collection('messages')
//
//   const item  = await msgs.insert({ text: 'привет' })
//   const list  = await msgs.find({ kind: 'text' }, { sort: '-createdAt', limit: 20 })
//   const page  = await msgs.page({}, { search: 'кот', limit: 25, skip: 0 })   // { items, total, limit, skip }
//   await msgs.update(item._id, { text: 'новый' })                             // по id
//   await msgs.update({ author: 'Max' }, {}, { inc: { views: 1 }, upsert: true })
//   await msgs.delete(item._id)
//
// Фильтры: {поле: значение} или операторы $eq $ne $gt $gte $lt $lte $in $nin $exists
// $contains $startsWith, а также $and / $or / $nor.
import { useAppStore } from '~~/stores/appStore'
import { buildAuthHeaders } from '~~/server/utils/authContext'

export class MoloDbClientError extends Error {
    status?: number
    constructor(message: string, status?: number) {
        super(message)
        this.name = 'MoloDbClientError'
        this.status = status
    }
}

function session() {
    const app: any = useAppStore()
    const enterpriseId = String(app.getEnterpriseId?.() || app.currentEnterprise?._id || app.enterpriseId || '')
    return { enterpriseId, headers: (): Record<string, string> => buildAuthHeaders(app.currentUser?._id) }
}

async function request<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
    const { enterpriseId, headers } = session()
    if (!enterpriseId) throw new MoloDbClientError('Предприятие не выбрано')
    try {
        return await $fetch<T>(`/api/enterprises/${enterpriseId}${path}`, {
            method: (opts.method || 'GET') as any,
            body: opts.body,
            headers: headers()
        })
    } catch (e: any) {
        throw new MoloDbClientError(e?.data?.message || e?.statusMessage || e?.message || 'Ошибка запроса', e?.statusCode || e?.status)
    }
}

const strip = ({ success, ...rest }: any) => rest
const target = (t: any) => (typeof t === 'string' ? { id: t } : { filter: t ?? {} })

function collectionApi(call: (body: any) => Promise<any>) {
    return {
        find: async (filter: any = {}, o: any = {}) => (await call({ op: 'find', filter, ...o, withTotal: false })).items,
        page: async (filter: any = {}, o: any = {}) => strip(await call({ op: 'find', filter, ...o })),
        findOne: async (filter: any = {}, o: any = {}) => (await call({ op: 'findOne', filter, ...o })).item,
        get: async (id: string) => (await call({ op: 'get', id })).item,
        count: async (filter: any = {}) => (await call({ op: 'count', filter })).count,
        insert: async (doc: any) => (await call({ op: 'insert', doc })).item,
        insertMany: async (docs: any[]) => (await call({ op: 'insertMany', docs })).items,
        update: async (t: any, patch: any = {}, o: any = {}) => strip(await call({ op: 'update', ...target(t), patch, ...o })),
        delete: async (t: any, o: any = {}) => strip(await call({ op: 'delete', ...target(t), ...o })),
        clear: async () => strip(await call({ op: 'delete', filter: {}, many: true, all: true }))
    }
}

export function useMoloDb(dbName: string) {
    const collection = (name: string) =>
        collectionApi((body) => request(`/moloDb/${dbName}/${name}`, { method: 'POST', body }))
    return new Proxy({ collection } as Record<string, any>, {
        get: (t, prop: string) => (prop in t ? t[prop] : typeof prop === 'string' ? collection(prop) : undefined)
    })
}

export function useMoloDbAdmin() {
    return {
        enterpriseId: () => session().enterpriseId,
        list: () => request<{ databases: any[]; limits: Record<string, number> }>('/moloDb'),
        createDb: (def: any) => request('/moloDb', { method: 'POST', body: def }),
        updateDb: (name: string, def: any, opts: { confirmDelete?: boolean } = {}) =>
            request(`/moloDb/${name}`, { method: 'PUT', body: { ...def, confirmDelete: opts.confirmDelete === true } }),
        deleteDb: (name: string) => request(`/moloDb/${name}?confirm=true`, { method: 'DELETE' }),
        data: (db: string, col: string, body: any) => request(`/moloDb/${db}/${col}`, { method: 'POST', body }),

        // Пересборка системных справочников из БД предприятия
        syncEnterpriseData: () => request<{ success: boolean; message: string }>('/sync', { method: 'POST' }),

        endpoints: {
            list: async () => {
                const res = await request<{ endpoints: any[] }>('/moloEndpoints')
                return Array.isArray(res?.endpoints) ? res.endpoints : []
            },
            save: async (ep: any) => (await request<{ endpoint: any }>('/moloEndpoints', { method: 'POST', body: ep }))?.endpoint,
            remove: (id: string) => request(`/moloEndpoints/${id}`, { method: 'DELETE' })
        },
        modules: async () => {
            const res: any = await request('/dynamicModules?minimal=1')
            return (res.modules || []).filter((m: any) => m.format === 'js' || m.format === 'ts')
        },
        moduleFiles: async (moduleId: string) => {
            const res: any = await request(`/dynamicModules/${moduleId}/files`)
            return (res.files || []).filter((f: any) => f.isServerFile)
        },
        endpointUrl: (slug: string) => `${location.origin}/api/x/${session().enterpriseId}/${slug}`
    }
}