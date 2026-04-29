import { defineStore } from 'pinia'
import { ref } from 'vue'  // 👈 Добавьте этот импорт

export const useModulesStore = defineStore('modules', () => {
    const modules = ref<any[]>([])
    const loading = ref(false)
    const enterpriseId = ref<string | null>(null)

    const setEnterprise = (id: string) => {
        enterpriseId.value = id
    }

    const fetchModules = async () => {
        if (!enterpriseId.value) return

        loading.value = true

        try {
            const res = await $fetch(
                `/api/enterprises/${enterpriseId.value}/dynamicModules`
            )

            modules.value = res.modules || []
        } catch (e) {
            console.error('Ошибка загрузки модулей', e)
            modules.value = []
        } finally {
            loading.value = false
        }
    }

    const getById = (id: string) => {
        return modules.value.find(m => m._id === id)
    }

    const getByFileName = (fileName: string) => {
        return modules.value.find(m => m.fileName === fileName)
    }

    const getModuleName = (identifier: string | { id?: string; fileName?: string; name?: string }) => {
        let module = null

        if (typeof identifier === 'string') {
            module = getById(identifier) || getByFileName(identifier)
        } else {
            if (identifier.id) module = getById(identifier.id)
            if (!module && identifier.fileName) module = getByFileName(identifier.fileName)
            if (!module && identifier.name) {
                module = modules.value.find(m => m.name === identifier.name)
            }
        }

        return module?.name || 'Модуль'
    }

    return {
        modules,
        loading,
        enterpriseId,
        setEnterprise,
        fetchModules,
        getById,
        getByFileName,
        getModuleName
    }
})