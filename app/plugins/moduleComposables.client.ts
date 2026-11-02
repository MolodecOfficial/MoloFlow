import { setGlobalComposables, warmupComponentRegistry } from '~~/app/composables/compiler/useModuleCompiler'
import { useLogger } from '~~/app/composables/useLogger'
import { useNotifications } from '~~/app/composables/useNotifications'
import { useWindowManager } from '~~/app/composables/window/useWindowManager'
import { useAppStore } from '~~/stores/appStore'
import { useModulesStore } from '~~/stores/modulesStore'
import { useMoloDb, useMoloDbAdmin } from '~~/app/composables/useMoloDb'

export default defineNuxtPlugin(() => {
    setGlobalComposables({
        useLogger,
        useNotifications,
        useWindowManager,
        useAppStore,
        useMoloDb,
        useMoloDbAdmin,
        useModulesStore
    })

    // JS/TS-скрипты модулей вызывают useMoloDb как глобальную функцию
    ;(window as any).useMoloDb = useMoloDb

    // Прогрев .vue-компонентов в фоне, когда браузер свободен
    const warm = () => warmupComponentRegistry()
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(warm, { timeout: 3000 })
    } else {
        setTimeout(warm, 300)
    }
})
