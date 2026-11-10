import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { useAppStore } from '~~/stores/appStore'

/**
 * Единый источник правды по предприятию — appStore.
 * Здесь только токен (useStorage) и удобные обёртки login/logout,
 * которые синхронизируют store и оповещают приложение.
 */
export const useEnterprise = () => {
    const appStore = useAppStore()

    const token = useStorage<string | null>('enterprise_token', null, localStorage)

    // Раньше здесь была отдельная копия в useStorage — она устаревала при смене прав.
    const enterprise = computed(() => appStore.enterpriseData)

    const enterpriseId = computed(() => appStore.enterpriseId || enterprise.value?._id || enterprise.value?.id || null)

    const isLoggedIn = computed(() => !!token.value && !!enterpriseId.value)

    const login = (data: any) => {
        const id = data?.enterprise?._id || data?.enterprise?.id
        token.value = data.token
        if (id) appStore.setEnterprise(String(id), data.enterprise)
        window.dispatchEvent(new Event('enterprise-login'))
    }

    const logout = () => {
        token.value = null
        appStore.clearEnterprise()
        window.dispatchEvent(new Event('enterprise-logout'))
    }

    return {
        enterprise,
        token,
        enterpriseId,
        isLoggedIn,
        login,
        logout
    }
}