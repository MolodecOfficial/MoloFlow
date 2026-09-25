import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAppStore } from './appStore'

export const useMenuStore = defineStore('menu', () => {
    const appStore = useAppStore()

    const menuGroups = ref<any[]>([])
    const menuLoaded = ref(false)
    const menuLoading = ref(false)

    const locations = ref<any[]>([])
    const tree = ref<any[]>([])
    const selectedGroupId = ref<string>('')
    const selectedParentId = ref<string | null>(null)

    const loadMenu = async (role = 'Администратор', force = false) => {
        if (!force && menuLoaded.value) return
        menuLoading.value = true
        try {
            const enterpriseId = appStore.getEnterpriseId()
            const data: any = await $fetch('/api/menu', {
                query: {
                    role,
                    enterpriseId: enterpriseId || undefined
                }
            })
            menuGroups.value = data.groups || []
            menuLoaded.value = true
        } catch (e) {
            console.error('[MenuStore] Ошибка загрузки меню:', e)
            menuGroups.value = []
        } finally {
            menuLoading.value = false
        }
    }

    const loadLocations = async (enterpriseId?: string) => {
        const entId = enterpriseId || appStore.getEnterpriseId()
        if (!entId) {
            locations.value = []
            return
        }

        let currentUserId = ''
        try {
            const rawUser = localStorage.getItem('user')
            if (rawUser) {
                currentUserId = JSON.parse(rawUser)?._id || ''
            }
        } catch {}

        try {
            const data: any = await $fetch('/api/menu/location', {
                query: {
                    enterpriseId: entId,
                    userId: currentUserId || undefined
                }
            })
            locations.value = data.locations || []
        } catch (e) {
            console.error('[MenuStore] Ошибка загрузки локаций меню:', e)
            locations.value = []
        }
    }

    const loadTree = async (enterpriseId?: string) => {
        const entId = enterpriseId || appStore.getEnterpriseId()
        try {
            const data: any = await $fetch('/api/menu', {
                query: { enterpriseId: entId || undefined }
            })
            tree.value = data.groups || []
        } catch (e) {
            console.error('[MenuStore] Ошибка загрузки дерева меню:', e)
            tree.value = []
        }
    }

    const addModuleToMenu = async (
        module: any,
        groupId: string,
        parentId: string | null,
        enterpriseId: string
    ) => {
        await $fetch('/api/menu/module', {
            method: 'POST',
            body: {
                enterpriseId,
                groupId,
                parentId,
                module: {
                    _id: module._id,
                    name: module.name,
                    fileName: module.fileName,
                    format: module.format,
                    requiredRole: module.requiredRole || []
                }
            }
        })
        await loadMenu(appStore.currentMemberRole || 'Администратор', true)
    }

    const invalidate = () => {
        menuLoaded.value = false
    }

    return {
        menuGroups,
        menuLoaded,
        menuLoading,
        locations,
        tree,
        selectedGroupId,
        selectedParentId,
        loadMenu,
        loadLocations,
        loadTree,
        addModuleToMenu,
        invalidate
    }
})