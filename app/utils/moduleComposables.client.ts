import { setGlobalComposables, warmupComponentRegistry } from '~~/app/composables/compiler/useModuleCompiler'
import { useLogger } from '~~/app/composables/useLogger'
import { useNotifications } from '~~/app/composables/useNotifications'
import { useWindowManager } from '~~/app/composables/useWindowManager'
import { useAppStore } from '~~/stores/appStore'

export default defineNuxtPlugin(() => {
    setGlobalComposables({
        useLogger,
        useNotifications,
        useWindowManager,
        useAppStore,
        useModulesStore: () => useModuleEditorStore?.()
    })

    // Тянем и разворачиваем ВСЕ .vue-компоненты проекта сразу при старте,
    // в фоне, отдельно от любого конкретного модуля — иначе этот налог
    // платит первый же открытый/прогретый модуль, а не приложение целиком.
    const warm = () => warmupComponentRegistry()
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(warm, { timeout: 3000 })
    } else {
        setTimeout(warm, 300)
    }
})