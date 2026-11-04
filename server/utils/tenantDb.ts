// server/utils/tenantDb.ts
// Единая точка доступа к БД предприятия. Каждый раздел — своя коллекция с понятным именем.
import mongoose, { type Connection, type Model } from 'mongoose'
import { createError } from 'h3'
import { TENANT_MODELS, type TenantModelName } from '~~/server/models/tenantSchemas'

const DB_PREFIX = 'molo_ent_'
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i

// Имена коллекций внутри базы предприятия (molo_ent_<id>)
export const COLLECTION_NAMES: Partial<Record<TenantModelName, string>> = {
    DynamicModule: 'modules',
    Department: 'directory_departments',
    DirectoryItem: 'directory_items',
    DirectoryDefinition: 'directory_definitions',
    WorkspaceFolder: 'workspace_folders',
    WorkspaceDocument: 'workspace_documents',
    WorkspaceDocumentVersion: 'workspace_versions',
    Menu: 'menus'
}

// Схема с автоподстановкой enterpriseId: значение берётся из имени базы, а не из запроса.
// Поэтому создание записи без enterpriseId никогда не падает с ошибкой валидации.
const scopedSchema = (name: TenantModelName, enterpriseId: string) => {
    const schema: any = (TENANT_MODELS[name] as any).clone()
    if (schema.path('enterpriseId')) {
        schema.pre('validate', function (this: any) {
            if (!this.enterpriseId) this.enterpriseId = enterpriseId
        })
    }
    return schema
}

export const tenantDbName = (enterpriseId: string): string => {
    const id = String(enterpriseId ?? '').trim().toLowerCase()
    if (!OBJECT_ID_RE.test(id)) {
        throw createError({ statusCode: 400, message: 'Некорректный идентификатор предприятия' })
    }
    return DB_PREFIX + id
}

export const getTenantConnection = (enterpriseId: string): Connection =>
    mongoose.connection.useDb(tenantDbName(enterpriseId), { useCache: true })

export type TenantModels = { [K in TenantModelName]: Model<any> }

export const tenantModels = (enterpriseId: string): TenantModels => {
    const conn = getTenantConnection(enterpriseId)
    const registry = conn.models as Record<string, Model<any>>
    const out = {} as TenantModels
    for (const name of Object.keys(TENANT_MODELS) as TenantModelName[]) {
        out[name] = registry[name] ?? conn.model(name, scopedSchema(name, enterpriseId), COLLECTION_NAMES[name])
    }
    return out
}

export const dropTenantDb = async (enterpriseId: string): Promise<void> => {
    await getTenantConnection(enterpriseId).dropDatabase()
}
