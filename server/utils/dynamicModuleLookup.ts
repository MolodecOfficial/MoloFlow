import { isOid } from './modules'
import { tenantModels } from './tenantDb'

/** Модуль предприятия по fileName или _id из БД предприятия. Возвращает документ Mongoose (с save). */
export async function findDynamicModuleByKey(enterpriseId: string, key: string) {
    if (!enterpriseId || !key) return null
    const or: Record<string, unknown>[] = [{ fileName: key }]
    if (isOid(key)) or.push({ _id: key })
    return tenantModels(enterpriseId).DynamicModule.findOne({ $or: or })
}
