import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserRole, PermissionKey } from '~/types/permissions.ts'
import { ROLE_DEFAULT_PERMISSIONS } from '~/types/permissions'
import { buildAuthHeaders } from '~~/server/utils/authContext'

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

/** Ответ сервера GET /api/enterprises/:id/me */
interface AccessResponse {
    role: UserRole
    permissions?: PermissionKey[]
    user?: UserSessionData
    enterprise?: EnterpriseData
}

/**
 * ok            — права получены с сервера и применены
 * offline       — сервер недоступен, работаем по локальным данным
 * revoked       — доступ к предприятию отозван / предприятие не найдено
 * unauthorized  — сервер не смог определить пользователя
 * no-enterprise — предприятие не выбрано
 */
export type AccessRefreshResult = 'ok' | 'offline' | 'revoked' | 'unauthorized' | 'no-enterprise'

export const SESSION_FP_KEY = 'molo_session_fp'

/** Нужно, чтобы useStorage (VueUse) в той же вкладке заметил ручное удаление ключа */
function notifyStorageRemoved(key: string) {
    if (!import.meta.client) return
    try {
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: null, storageArea: localStorage }))
    } catch { /* noop */ }
}

export const useAppStore = defineStore('app', () => {
    const enterpriseId = ref<string | null>(null)
    const enterpriseData = ref<EnterpriseData | null>(null)
    const currentUser = ref<UserSessionData | null>(null)
    const currentMemberRole = ref<UserRole | null>(null)

    /** Роль, подтверждённая сервером. Имеет приоритет над любыми локальными догадками. */
    const serverRole = ref<UserRole | null>(null)
    /** Хотя бы одна попытка синхронизации прав с сервером завершилась (успехом или нет) */
    const sessionChecked = ref(false)
    const lastSyncAt = ref<number | null>(null)
    /** Причина последней неудачной синхронизации (для диагностики), null — всё хорошо */
    const accessError = ref<string | null>(null)

    const isEnterpriseLoaded = computed(() => !!enterpriseId.value && !!enterpriseData.value)
    const enterpriseName = computed(() => enterpriseData.value?.enterpriseName || enterpriseData.value?.name || 'Без названия')

    const currentUserPermissions = computed<PermissionKey[]>(() => {
        const role = currentMemberRole.value || (currentUser.value?.role as UserRole) || 'Пользователь'
        return ROLE_DEFAULT_PERMISSIONS[role] || []
    })

    const hasPermission = (permission: PermissionKey) => currentUserPermissions.value.includes(permission)

    /** Отпечаток сессии: пользователь + предприятие + роль */
    const sessionFingerprint = computed(
        () => `${currentUser.value?._id || ''}|${enterpriseId.value || ''}|${currentMemberRole.value || ''}`
    )

    /* ---------- локальный расчёт роли (запасной вариант, пока нет ответа сервера) ---------- */
    const syncRoles = () => {
        if (!currentUser.value) {
            currentMemberRole.value = serverRole.value
            return
        }

        if (serverRole.value) {
            currentMemberRole.value = serverRole.value
            return
        }

        const currentUserId = String(currentUser.value._id)
        const members = enterpriseData.value?.members || []
        const member = members.find((m: any) => String(m.userId?._id || m.userId) === currentUserId)

        const isDirector =
            !!enterpriseData.value?.director &&
            (enterpriseData.value.director === currentUser.value.name ||
                enterpriseData.value.director === currentUserId)

        // Тот же приоритет, что и на сервере (checkEnterpriseAccess)
        if (isDirector || currentUser.value.role === 'Администратор') {
            currentMemberRole.value = 'Администратор'
        } else if (member?.role) {
            currentMemberRole.value = member.role as UserRole
        } else {
            currentMemberRole.value = (currentUser.value.role as UserRole) || 'Пользователь'
        }
    }

    const loadUserFromStorage = (): boolean => {
        if (!import.meta.client) return false
        const raw = localStorage.getItem('user')
        if (!raw) {
            currentUser.value = null
            return false
        }
        try {
            const parsed = JSON.parse(raw)
            if (currentUser.value && String(currentUser.value._id) !== String(parsed?._id)) {
                serverRole.value = null
            }
            currentUser.value = parsed
            return true
        } catch {
            currentUser.value = null
            return false
        }
    }

    const loadEnterpriseFromStorage = (): boolean => {
        if (!import.meta.client) return false
        loadUserFromStorage()

        const raw = localStorage.getItem('currentEnterprise')
        if (!raw) {
            syncRoles()
            return false
        }
        try {
            const data = JSON.parse(raw)
            const newId = data._id || data.id || null
            if (newId !== enterpriseId.value) serverRole.value = null
            enterpriseId.value = newId
            enterpriseData.value = data
            syncRoles()
            return true
        } catch {
            return false
        }
    }

    const setEnterprise = (id: string, data?: any) => {
        if (id !== enterpriseId.value) serverRole.value = null
        enterpriseId.value = id
        enterpriseData.value = data ? { ...data, _id: id } : null
        if (import.meta.client) {
            if (data) localStorage.setItem('currentEnterprise', JSON.stringify({ ...data, _id: id }))
            else localStorage.removeItem('currentEnterprise')
        }
        syncRoles()
    }

    const setUser = (user: UserSessionData) => {
        if (currentUser.value && String(currentUser.value._id) !== String(user._id)) {
            serverRole.value = null
        }
        currentUser.value = user
        if (import.meta.client) {
            localStorage.setItem('user', JSON.stringify(user))
        }
        syncRoles()
    }

    /** Выход только из предприятия (пользователь остаётся) */
    const clearEnterprise = () => {
        enterpriseId.value = null
        enterpriseData.value = null
        serverRole.value = null
        sessionChecked.value = false
        syncRoles()

        if (import.meta.client) {
            localStorage.removeItem('currentEnterprise')
            localStorage.removeItem('enterprise_token')
            localStorage.removeItem(SESSION_FP_KEY)
            notifyStorageRemoved('enterprise_token')
        }
    }

    /** Полный выход */
    const clearSession = () => {
        enterpriseId.value = null
        enterpriseData.value = null
        currentUser.value = null
        currentMemberRole.value = null
        serverRole.value = null
        sessionChecked.value = false
        lastSyncAt.value = null

        if (import.meta.client) {
            for (const key of ['user', 'userId', 'token', 'currentEnterprise', 'enterprise_token', 'lastLoginType', SESSION_FP_KEY]) {
                localStorage.removeItem(key)
            }
            notifyStorageRemoved('enterprise_token')
        }
    }

    const getEnterpriseId = (): string | null => {
        if (enterpriseId.value) return enterpriseId.value
        loadEnterpriseFromStorage()
        return enterpriseId.value
    }

    /* ---------- синхронизация прав с сервером ---------- */
    const applyServerAccess = (res: AccessResponse) => {
        if (res.user?._id) {
            currentUser.value = { ...(currentUser.value || {}), ...res.user } as UserSessionData
            if (import.meta.client) localStorage.setItem('user', JSON.stringify(currentUser.value))
        }

        if (res.enterprise) {
            const id = String(res.enterprise._id || enterpriseId.value)
            enterpriseId.value = id
            enterpriseData.value = { ...res.enterprise, _id: id }
            if (import.meta.client) localStorage.setItem('currentEnterprise', JSON.stringify(enterpriseData.value))
        }

        serverRole.value = res.role || null
        syncRoles()
        lastSyncAt.value = Date.now()
    }

    let inflight: Promise<AccessRefreshResult> | null = null

    /**
     * Запрашивает у сервера актуальную роль/права/участников.
     * Если сервер говорит «доступа нет» — выходим из предприятия.
     */
    const refreshAccess = (force = false): Promise<AccessRefreshResult> => {
        if (inflight) {
            // force: запрос уже идёт, но он мог стартовать ДО смены роли — повторяем после него
            return force ? inflight.then(() => refreshAccess(false)) : inflight
        }

        inflight = (async (): Promise<AccessRefreshResult> => {
            const id = getEnterpriseId()
            if (!id) {
                sessionChecked.value = true
                return 'no-enterprise'
            }

            try {
                const res = await $fetch<AccessResponse>(`/api/enterprises/${id}/me`, {
                    headers: buildAuthHeaders(currentUser.value?._id),
                    timeout: 6000,
                    cache: 'no-store'
                })
                applyServerAccess(res)
                accessError.value = null
                return 'ok'
            } catch (e: any) {
                const code = e?.statusCode ?? e?.status ?? e?.response?.status
                accessError.value = `${code ?? 'нет связи'}: ${e?.data?.statusMessage || e?.statusMessage || e?.message || 'ошибка'}`
                console.warn('[appStore] Не удалось обновить права:', accessError.value)
                if (code === 401) return 'unauthorized'
                if (code === 403 || code === 404) {
                    clearEnterprise()
                    return 'revoked'
                }
                return 'offline'
            } finally {
                sessionChecked.value = true
            }
        })().finally(() => {
            inflight = null
        })

        return inflight
    }

    return {
        enterpriseId,
        enterpriseData,
        currentUser,
        currentMemberRole,
        serverRole,
        sessionChecked,
        lastSyncAt,
        accessError,
        sessionFingerprint,
        isEnterpriseLoaded,
        enterpriseName,
        currentUserPermissions,
        hasPermission,
        loadEnterpriseFromStorage,
        loadUserFromStorage,
        setEnterprise,
        setUser,
        clearEnterprise,
        clearSession,
        getEnterpriseId,
        syncRoles,
        refreshAccess
    }
})