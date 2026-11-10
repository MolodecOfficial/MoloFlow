// server/utils/moloDb/sandboxApi.ts
//
// Объект db для серверных файлов модулей (песочница). Работает напрямую с ядром, без HTTP.
//
//   const msgs = db('botlog').collection('messages')     // или db('botlog').messages
//   await msgs.insert({ text: 'привет' })
//   const last = await msgs.find({ kind: 'text' }, { sort: '-createdAt', limit: 10 })
import { runDbOp } from './store'

type Call = (body: any) => Promise<any>

const strip = ({ success, ...rest }: any) => rest
const target = (t: any) => (typeof t === 'string' ? { id: t } : { filter: t ?? {} })

/** Единый набор методов коллекции — тот же, что в клиентском useMoloDb и в Python-клиенте. */
export function collectionApi(call: Call) {
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

export function createSandboxDb(enterpriseId: string, moduleId?: string) {
    return (dbName: string) => {
        const collection = (name: string) =>
            collectionApi((body) =>
                runDbOp({ enterpriseId, db: dbName, col: name, actor: { kind: 'module', id: moduleId } }, body)
            )
        return new Proxy({ collection } as Record<string, any>, {
            get: (t, prop: string) => (prop in t ? t[prop] : typeof prop === 'string' ? collection(prop) : undefined)
        })
    }
}