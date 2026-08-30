import { ref, watch, type Ref } from 'vue'

function getEnterpriseId(): string {
    try {
        const data = localStorage.getItem('currentEnterprise')
        if (data) return JSON.parse(data)?._id ?? 'default'
    } catch {}
    return 'default'
}

// Один и тот же принцип, что и в useWindowManager (window_settings_{enterpriseId}_{key}) —
// теперь применяем его к содержимому виджетов, а не только к геометрии окна.
export function usePersistentState<T>(key: string, defaultValue: T): Ref<T> {
    const storageKey = `devtools_${getEnterpriseId()}_${key}`

    let initial = defaultValue
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(storageKey)
            if (raw !== null) initial = JSON.parse(raw)
        } catch {}
    }

    const state = ref<T>(initial) as Ref<T>

    watch(state, (val) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(val))
        } catch (e) {
            console.warn('[usePersistentState] Не удалось сохранить', storageKey, e)
        }
    }, { deep: true })

    return state
}