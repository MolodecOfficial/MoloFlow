import { ref, computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'

export const useEnterprise = () => {
    // Реактивное хранилище через VueUse
    const enterprise = useStorage('currentEnterprise', null, localStorage, {
        serializer: {
            read: (v: any) => v ? JSON.parse(v) : null,
            write: (v: any) => JSON.stringify(v)
        }
    })

    const token = useStorage('enterprise_token', null, localStorage)

    const enterpriseId = computed(() => {
        return enterprise.value?._id || enterprise.value?.id || null
    })

    const isLoggedIn = computed(() => !!token.value && !!enterpriseId.value)

    const login = (data: any) => {
        enterprise.value = data.enterprise
        token.value = data.token
    }

    const logout = () => {
        enterprise.value = null
        token.value = null
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