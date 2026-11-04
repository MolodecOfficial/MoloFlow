// server/utils/moduleLookup.ts
// Модули предприятия живут в БД предприятия (molo_ent_<id>, коллекция modules),
// а НЕ в глобальной коллекции. Всегда ищем через tenantModels(enterpriseId).
import { ModuleCatalog } from '~~/server/models/moduleCatalog.model'
import { tenantModels } from '~~/server/utils/tenantDb'

const OID_RE = /^[a-f0-9]{24}$/i

/** Предприятие модуля: сначала из глобального каталога, иначе из подсказки запроса. */
export async function enterpriseOfModule(moduleId: string, hint?: string | null): Promise<string | null> {
    if (!OID_RE.test(String(moduleId))) return null
    const cat: any = await ModuleCatalog.findById(moduleId).lean()
    const id = cat?.enterpriseId || hint
    return id ? String(id) : null
}

/** Документ модуля из БД предприятия (или null). */
export async function loadModule(moduleId: string, enterpriseId: string, opts: { lean?: boolean } = {}): Promise<any> {
    if (!OID_RE.test(String(moduleId)) || !enterpriseId) return null
    const query = tenantModels(enterpriseId).DynamicModule.findById(moduleId)
    return opts.lean ? query.lean() : query
}
