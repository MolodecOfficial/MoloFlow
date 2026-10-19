// app/composables/useModuleService.ts
import { useModuleCache, type RawModuleData } from './useModuleCache'
import { useLogger } from '~/composables/useLogger'

export function useModuleService() {
    const { addLog } = useLogger('Сервис модулей')
    const cache = useModuleCache()

    async function fetchFullModuleData(
        moduleId: string,
        enterpriseId: string,
        options?: { force?: boolean }
    ): Promise<RawModuleData> {
        const force = options?.force ?? false

        // 1. Кэш свежий — отдаём мгновенно без сетевых запросов
        if (!force && cache.isRawFresh(moduleId)) {
            const cached = cache.getRaw(moduleId)
            if (cached?.data) {
                return cached.data
            }
        }

        // 2. Дедупликация параллельных запросов
        const existing = cache.getRaw(moduleId)
        if (!force && existing?.inFlight) {
            addLog('info', `Ожидание уже идущей загрузки модуля ${moduleId}`)
            return existing.inFlight
        }

        addLog('info', `Загрузка полного модуля ${moduleId}`)

        const loadPromise = (async (): Promise<RawModuleData> => {
            try {
                // Запрашиваем единый эндпоинт, который возвращает метаданные, файлы и зависимости разом
                const res: any = await $fetch(
                    `/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}`
                )

                const module = res?.module
                if (!module) {
                    throw new Error('Данные модуля не найдены на сервере')
                }

                const result: RawModuleData = {
                    _id: module._id || module.moduleId || moduleId,
                    name: module.name || 'Без названия',
                    fileName: module.fileName || '',
                    description: module.description || '',
                    format: module.format || 'vue',
                    version: module.version || 1,
                    isPublic: !!module.isPublic,
                    isOfficial: !!module.isOfficial,
                    tags: Array.isArray(module.tags) ? module.tags : [],
                    serverEntry: module.serverEntry || '',
                    composables: Array.isArray(module.composables) ? module.composables : [],
                    code: module.code || '',
                    files: Array.isArray(module.files) ? module.files : [],
                    dependencies: module.dependencies || {},
                    devDependencies: module.devDependencies || {}
                }

                cache.setRawData(moduleId, result)
                addLog('success', `Модуль загружен: ${result.name}`)
                return result
            } catch (error: any) {
                addLog('error', error?.message || 'Ошибка загрузки модуля')
                cache.invalidate(moduleId)
                throw error
            }
        })()

        cache.setRawInFlight(moduleId, loadPromise)
        return loadPromise
    }

    function prepareModuleForWindow(moduleData: any, customTitle?: string) {
        return {
            _id: moduleData._id,
            moduleId: moduleData._id,
            name: customTitle || moduleData.name,
            placeName: moduleData.placeName,
            format: moduleData.format,
            code: moduleData.code,
            files: moduleData.files,
            dependencies: moduleData.dependencies,
            devDependencies: moduleData.devDependencies
        }
    }

    function invalidateModule(moduleId: string) {
        cache.invalidate(moduleId)
    }

    return {
        fetchFullModuleData,
        prepareModuleForWindow,
        invalidateModule
    }
}