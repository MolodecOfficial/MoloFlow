// stores/enterpriseModulesStore.ts
//
// ЕДИНСТВЕННЫЙ источник правды для "лёгкого" списка динамических модулей
// предприятия (id/name/fileName/format/version/isActive, БЕЗ code/files).
//
// Раньше этот же список независимо грузили и кэшировали:
//   - moloMenuStore.dynamicModules   (для "Мои модули" в меню)
//   - moduleEditorStore.modules      (для выпадающего списка в редакторе)
//   - moduleStore.modules            (мёртвый дубликат, нигде не читался)
// Три копии одного и того же запроса, три независимых кэша, три места
// для одного и того же бага. Теперь все три просто ссылаются сюда.
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEnterpriseModulesStore = defineStore('enterpriseModules', () => {
    const modules = ref<any[]>([])
    const loaded = ref(false)
    const loading = ref(false)
    const loadedEnterpriseId = ref<string | null>(null)
    let loadingPromise: Promise<void> | null = null

    const load = async (enterpriseId: string | null | undefined, force = false): Promise<void> => {
        if (!enterpriseId) {
            modules.value = []
            loaded.value = false
            loadedEnterpriseId.value = null
            return
        }

        if (!force && loaded.value && loadedEnterpriseId.value === enterpriseId) return
        if (loadingPromise) return loadingPromise

        loading.value = true
        loadingPromise = (async () => {
            try {
                const response: any = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules`, {
                    params: { minimal: '1' }
                })
                modules.value = response.modules || []
                loadedEnterpriseId.value = enterpriseId
                loaded.value = true
            } catch (error) {
                console.error('[enterpriseModulesStore] load error:', error)
                modules.value = []
            } finally {
                loading.value = false
                loadingPromise = null
            }
        })()

        return loadingPromise
    }

    // Вызывай после создания/сохранения/удаления модуля — сбросит кэш,
    // следующий load() (с любой стороны — меню, редактор) перезагрузит
    // список, и ОБА места увидят изменения одновременно.
    const invalidate = () => {
        loaded.value = false
    }

    const reset = () => {
        modules.value = []
        loaded.value = false
        loadedEnterpriseId.value = null
    }

    return {
        modules,
        loaded,
        loading,
        load,
        invalidate,
        reset,
    }
})