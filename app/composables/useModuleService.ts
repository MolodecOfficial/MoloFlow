import { useModuleCache, type RawModuleData } from '~~/app/composables/useModuleCache'

export function useModuleService() {

    const { addLog } = useLogger('Сервис модулей')
    const cache = useModuleCache()

    /**
     * Полная загрузка модуля
     *
     * Загружает:
     * - metadata
     * - main code
     * - files
     * - dependencies
     * - devDependencies
     *
     * Теперь с кэшем: повторный вызов для того же moduleId в пределах
     * TTL не бьёт по сети вообще, а параллельные вызовы (например, окно
     * открывают дважды кликом, или окно открывается сразу после
     * фонового прогрева) переиспользуют один и тот же запрос вместо N.
     */
    async function fetchFullModuleData(
        moduleId: string,
        enterpriseId: string,
        options?: { force?: boolean }
    ): Promise<RawModuleData> {

        const force = options?.force ?? false

        // 1. Кэш свежий — отдаём мгновенно, без единого fetch
        if (!force && cache.isRawFresh(moduleId)) {
            const cached = cache.getRaw(moduleId)
            if (cached?.data) {
                addLog('info', `Модуль ${moduleId} взят из кэша`)
                return cached.data
            }
        }

        // 2. Запрос уже летит (например, фоновый прогрев ещё не завершился,
        //    а пользователь уже кликнул на модуль) — ждём тот же промис,
        //    а не запускаем второй параллельный набор fetch'ей
        const existing = cache.getRaw(moduleId)
        if (!force && existing?.inFlight) {
            addLog('info', `Ожидание уже идущей загрузки модуля ${moduleId}`)
            return existing.inFlight
        }

        addLog('info', `Загрузка полного модуля ${moduleId}`)

        const loadPromise = (async (): Promise<RawModuleData> => {
            try {

                // ===========================
                // 1. METADATA
                // ===========================

                const meta: any = await $fetch(
                    `/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}`
                )

                if (!meta?.module) {
                    throw new Error('Metadata module not found')
                }

                const module = meta.module

                // ===========================
                // 2. FILES + MAIN CODE + 3. DEPENDENCIES
                // Идут параллельно — раньше шли последовательно,
                // это тоже часть "долго грузится"
                // ===========================

                const [filesResponse, deps]: [any, any] = await Promise.all([
                    $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`),
                    $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/dependencies`)
                ])

                const result: RawModuleData = {

                    // META
                    _id: module._id,
                    name: module.name,
                    fileName: module.fileName,
                    description: module.description,
                    format: module.format,
                    version: module.version,
                    isPublic: module.isPublic,
                    isOfficial: module.isOfficial,
                    tags: module.tags || [],
                    serverEntry: module.serverEntry || '',
                    composables: module.composables || [],

                    // CODE
                    code: filesResponse.mainFile?.code || '',

                    // FILES
                    files: filesResponse.files || [],

                    // DEPENDENCIES
                    dependencies: deps.dependencies || {},
                    devDependencies: deps.devDependencies || {}
                }

                cache.setRawData(moduleId, result)

                addLog('success', `Модуль загружен: ${result.name}`)

                return result

            } catch (error: any) {

                addLog('error', error.message)
                // Не оставляем "битый" in-flight промис в кэше —
                // иначе все, кто ждал, тоже упадут молча в будущем
                cache.invalidate(moduleId)
                throw error
            }
        })()

        cache.setRawInFlight(moduleId, loadPromise)

        return loadPromise
    }

    function prepareModuleForWindow(
        moduleData: any,
        customTitle?: string
    ) {
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

    /**
     * Инвалидация кэша конкретного модуля.
     * Обязательно вызывать после сохранения модуля в редакторе —
     * иначе автор будет видеть старую скомпилированную версию.
     */
    function invalidateModule(moduleId: string) {
        cache.invalidate(moduleId)
    }

    return {
        fetchFullModuleData,
        prepareModuleForWindow,
        invalidateModule
    }
}