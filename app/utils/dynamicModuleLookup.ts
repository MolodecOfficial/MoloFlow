import mongoose from 'mongoose'
import { DynamicModule } from '~~/server/models/dynamicModules.model'

/** Находит модуль предприятия по fileName или по _id. Возвращает документ Mongoose (у него есть save). */
export async function findDynamicModuleByKey(enterpriseId: string, key: string) {
    if (!enterpriseId || !key) return null
    const or: Record<string, any>[] = [{ fileName: key }]
    if (mongoose.Types.ObjectId.isValid(key)) or.push({ _id: key })
    return DynamicModule.findOne({ enterpriseId, $or: or })
}