// stores/moloMenuStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useEnterpriseModulesStore } from './enterpriseModulesStore'

const normalizeGroup = (g: any) => ({
    ...g,
    items: (g.items || []).map((item: any) => ({
        ...item,
        placeName: item.placeName || item.id,
        format: item.format || 'vue'
    }))
})

export const useMoloMenuStore = defineStore('moloMenu', () => {
    // ===== Статическое меню (группы menu/module из /api/menu) =====
    const menuGroups = ref<any[]>([])
    const staticModuleGroups = ref<any[]>([])
    const menuLoaded = ref(false)
    const menuLoading = ref(false)
    const menuRole = ref<string | null>(null)
    let menuLoadingPromise: Promise<void> | null = null

    // ===== Динамические модули предприятия =====
    // Больше НЕ хранятся отдельно — это просто "витрина" поверх
    // единого enterpriseModulesStore, чтобы не трогать интерфейс,
    // на который завязан MoloMenu.vue (storeToRefs(menuStore).dynamicModules).
    const sharedModules = useEnterpriseModulesStore()
    const dynamicModules = computed(() => sharedModules.modules)
    const dynamicModulesLoaded = computed(() => sharedModules.loaded)
    const dynamicModulesLoading = computed(() => sharedModules.loading)

    // ===== Меню =====
    const fetchMenu = async (role: string) => {
        const response: any = await $fetch('/api/menu', { params: { role, type: 'all' } })
        menuGroups.value = (response as any[]).filter(g => g?.type === 'menu').map(normalizeGroup)
        staticModuleGroups.value = (response as any[]).filter(g => g?.type === 'module')
    }

    const loadMenu = async (role: string, force = false): Promise<void> => {
        if (!force && menuLoaded.value && menuRole.value === role) return
        if (menuLoadingPromise) return menuLoadingPromise

        menuLoading.value = true
        menuLoadingPromise = (async () => {
            try {
                await fetchMenu(role)

                // Дефолтное меню создаём только если оно реально пустое,
                // и только один раз — без лишних повторных вызовов при следующих загрузках
                if (!menuGroups.value.length) {
                    await $fetch('/api/menu/init', { method: 'POST' })
                    await fetchMenu(role)
                }

                menuRole.value = role
                menuLoaded.value = true
            } catch (error) {
                console.error('Menu load error:', error)
            } finally {
                menuLoading.value = false
                menuLoadingPromise = null
            }
        })()

        return menuLoadingPromise
    }

    // ===== Динамические модули =====
    const loadDynamicModules = async (enterpriseId: string | null | undefined, force = false): Promise<void> => {
        await sharedModules.load(enterpriseId, force)
    }

    // ===== Инвалидация / сброс (например, при логине/логауте, событии modules-updated) =====
    const invalidateMenu = () => { menuLoaded.value = false }
    const invalidateDynamicModules = () => { sharedModules.invalidate() }

    const reset = () => {
        menuGroups.value = []
        staticModuleGroups.value = []
        menuLoaded.value = false
        menuRole.value = null

        sharedModules.reset()
    }

    return {
        menuGroups,
        staticModuleGroups,
        menuLoaded,
        menuLoading,

        dynamicModules,
        dynamicModulesLoaded,
        dynamicModulesLoading,

        loadMenu,
        loadDynamicModules,
        invalidateMenu,
        invalidateDynamicModules,
        reset,
    }
})