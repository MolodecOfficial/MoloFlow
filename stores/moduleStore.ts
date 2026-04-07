import { defineStore } from 'pinia'

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

    return {
        modules,
        loading,
        enterpriseId,
        setEnterprise,
        fetchModules,
        getById,
        getByFileName
    }
})