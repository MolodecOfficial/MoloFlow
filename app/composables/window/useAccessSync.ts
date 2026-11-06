
import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '~~/stores/appStore'

/**
 * Проверка прав отключена.
 * Предприятие работает на основании сохранённой локальной сессии.
 * Никаких запросов /me, SSE и периодического опроса.
 */
export function useAccessSync() {
    const appStore = useAppStore()

    const refreshNow = () => {
        appStore.loadEnterpriseFromStorage()
    }

    onMounted(() => {
        appStore.loadEnterpriseFromStorage()
    })

    return { refreshNow }
}
