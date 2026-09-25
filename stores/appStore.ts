import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserRole, PermissionKey } from '~/types/permissions'
import { ROLE_DEFAULT_PERMISSIONS } from '~/types/permissions'

export interface UserSessionData {
    _id: string
    name: string
    phone?: string
    email?: string
    role?: string
}

export interface EnterpriseMemberInfo {
    userId: string
    name?: string
    phone?: string
    role: UserRole
    joinedAt?: string
}

export interface EnterpriseData {
    _id: string
    enterpriseName: string
    ownershipForm: string
    inn: string
    kpp?: string
    ogrn?: string
    director?: string
    members?: EnterpriseMemberInfo[]
    [key: string]: any
}

export const useAppStore = defineStore('app', () => {
    const enterpriseId = ref<string | null>(null)
    const enterpriseData = ref<EnterpriseData | null>(null)
    const currentUser = ref<UserSessionData | null>(null)
    const currentMemberRole = ref<UserRole | null>(null)

    const isEnterpriseLoaded = computed(() => !!enterpriseId.value && !!enterpriseData.value)
    const enterpriseName = computed(() => enterpriseData.value?.enterpriseName || enterpriseData.value?.name || 'Без названия')

    const currentUserPermissions = computed<PermissionKey[]>(() => {
        const role = currentMemberRole.value || (currentUser.value?.role as UserRole) || 'Пользователь'
        return ROLE_DEFAULT_PERMISSIONS[role] || []
    })

    const syncRoles = () => {
        if (!currentUser.value) return

        const currentUserId = String(currentUser.value._id)
        const members = enterpriseData.value?.members || []

        const member = members.find((m: any) => String(m.userId?._id || m.userId) === currentUserId)

        if (member?.role) {
            currentMemberRole.value = member.role as UserRole
        } else if (enterpriseData.value?.director && enterpriseData.value.director === currentUser.value.name) {
            currentMemberRole.value = 'Администратор'
        } else if (currentUser.value.role === 'Администратор') {
            currentMemberRole.value = 'Администратор'
        } else {
            currentMemberRole.value = (currentUser.value.role as UserRole) || 'Пользователь'
        }
    }

    const loadUserFromStorage = (): boolean => {
        if (typeof window === 'undefined') return false
        const raw = localStorage.getItem('user')
        if (!raw) return false
        try {
            currentUser.value = JSON.parse(raw)
            return true
        } catch {
            return false
        }
    }

    const loadEnterpriseFromStorage = (): boolean => {
        if (typeof window === 'undefined') return false
        loadUserFromStorage()

        const raw = localStorage.getItem('currentEnterprise')
        if (!raw) return false
        try {
            const data = JSON.parse(raw)
            enterpriseId.value = data._id || data.id || null
            enterpriseData.value = data
            syncRoles()
            return true
        } catch {
            return false
        }
    }

    const setEnterprise = (id: string, data?: any) => {
        enterpriseId.value = id
        enterpriseData.value = data ? { ...data, _id: id } : null
        if (typeof window !== 'undefined') {
            if (data) localStorage.setItem('currentEnterprise', JSON.stringify({ ...data, _id: id }))
            else localStorage.removeItem('currentEnterprise')
        }
        syncRoles()
    }

    const setUser = (user: UserSessionData) => {
        currentUser.value = user
        if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(user))
        }
        syncRoles()
    }

    const getEnterpriseId = (): string | null => {
        if (enterpriseId.value) return enterpriseId.value
        loadEnterpriseFromStorage()
        return enterpriseId.value
    }

    return {
        enterpriseId,
        enterpriseData,
        currentUser,
        currentMemberRole,
        isEnterpriseLoaded,
        enterpriseName,
        currentUserPermissions,
        loadEnterpriseFromStorage,
        loadUserFromStorage,
        setEnterprise,
        setUser,
        getEnterpriseId,
        syncRoles
    }
})