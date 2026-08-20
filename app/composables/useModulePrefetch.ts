// composables/useModulePrefetch.ts
//
// Фоновый прогрев модулей. Идея: пользователь почти всегда сначала видит
// список модулей в меню, и только потом кликает по одному из них — это
// окно (обычно секунды, а то и минуты) можно использовать, чтобы
// подготовить (fetch + compile) модули заранее, вместо того чтобы делать
// это в момент клика, когда пользователь уже ждёт открытия окна.
//
// Это НЕ блокирует открытие: если пользователь кликнёт раньше, чем
// прогрев доберётся до нужного модуля, — fetchFullModuleData/compileModule
// просто отработают как обычно (см. дедупликацию in-flight в кэше).

import { useModuleService } from '~~/app/composables/useModuleService'
import { precompileModule } from '~~/app/composables/useModuleCompiler'

let prefetchInFlight = false

function idle(fn: () => void) {
    if (typeof (window as any).requestIdleCallback === 'function') {
        ;(window as any).requestIdleCallback(fn, { timeout: 2000 })
    } else {
        setTimeout(fn, 250)
    }
}

export function useModulePrefetch() {
    const { fetchFullModuleData } = useModuleService()

    /**
     * Прогревает vue-модули из списка меню в фоне, по одному, используя
     * простой in-browser планировщик (requestIdleCallback), чтобы не
     * конкурировать с основным потоком за CPU/сеть и не просаживать UI.
     *
     * @param modules  список модулей (как в dynamicModules сторе)
     * @param enterpriseId  id предприятия для API
     * @param priorityId  опционально — moduleId, который нужно прогреть
     *                    первым (например, тот, на который навели курсор)
     */
    async function prefetchModules(modules: any[], enterpriseId: string, priorityId?: string) {
        if (prefetchInFlight || !enterpriseId) return
        prefetchInFlight = true

        try {
            const vueModules = (modules || []).filter(m => m?._id && m.format === 'vue')
            if (priorityId) {
                vueModules.sort((a, b) => (a._id === priorityId ? -1 : b._id === priorityId ? 1 : 0))
            }

            for (const m of vueModules) {
                await new Promise<void>(resolve => idle(async () => {
                    try {
                        const data = await fetchFullModuleData(m._id, enterpriseId)
                        await precompileModule(m._id, data.code, data.files, data.dependencies, data.version)
                    } catch (e) {
                        // Фоновый прогрев не должен шуметь ошибками в UI —
                        // если что-то пошло не так, окно при открытии
                        // просто выполнит обычную загрузку и покажет ошибку там
                        console.warn(`[ModulePrefetch] Не удалось прогреть модуль ${m?.name}:`, e)
                    } finally {
                        resolve()
                    }
                }))
            }
        } finally {
            prefetchInFlight = false
        }
    }

    /**
     * Прогреть один конкретный модуль немедленно (без ожидания очереди) —
     * удобно вызывать на mouseenter/hover пункта меню, чтобы к моменту
     * фактического клика компиляция уже стартовала или завершилась.
     */
    async function prefetchOne(moduleId: string, enterpriseId: string) {
        if (!moduleId || !enterpriseId) return
        try {
            const data = await fetchFullModuleData(moduleId, enterpriseId)
            if (data.format === 'vue') {
                await precompileModule(moduleId, data.code, data.files, data.dependencies, data.version)
            }
        } catch (e) {
            console.warn(`[ModulePrefetch] Не удалось прогреть модуль ${moduleId}:`, e)
        }
    }

    return { prefetchModules, prefetchOne }
}