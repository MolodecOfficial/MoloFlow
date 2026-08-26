
// Единая точка резолва модуля по "ключу", который прилетает в роуте как
// :moduleId. Ключ может быть:
//   - настоящий Mongo _id  ("6a48f2b57085174b10cbb1c8")
//   - человекочитаемый fileName ("checkingAPI")
//
// Раньше каждый эндпоинт делал DynamicModule.findOne({ _id: moduleId, ... })
// напрямую — и падал с CastError (-> 500), как только moduleId был не похож
// на ObjectId. Теперь все эндпоинты дергают эту функцию вместо прямого findOne.
import mongoose from 'mongoose';
import { DynamicModule } from '~~/server/models/dynamicModules.model';

export async function findDynamicModuleByKey(enterpriseId: string, moduleKey: string) {
    const orConditions: Record<string, any>[] = [{ fileName: moduleKey }];
    if (mongoose.Types.ObjectId.isValid(moduleKey)) {
        orConditions.push({ _id: moduleKey });
    }
    return DynamicModule.findOne({ enterpriseId, $or: orConditions });
}