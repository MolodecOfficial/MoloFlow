import { ref, watch } from 'vue'
import type { WindowItem, WindowPosition, WindowSize, OpenWindowOptions } from '~/types/window'
import { getSystemWindow } from './systemWindows'
import { usePinnedItems } from './usePinnedItems'
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, type PermissionKey, type UserRole } from '~/types/permissions'
import { useAppStore } from '~~/stores/appStore'
import { useNotifications } from '~/composables/useNotifications'

const windows = ref<WindowItem[]>([])
let zIndexCounter = 100
let cascadeStep = 0

const TOPBAR_OFFSET = 90
const CASCADE_STEP_X = 34
const CASCADE_STEP_Y = 28
const STORAGE_PREFIX = 'window_settings_'

const dataCache = new Map<string, string>()

const { findByWindowKey, syncDataByWindowKey } = usePinnedItems()

const PIN_ONLY_FIELDS = ['html', 'dragId', 'type', 'sourcePath']

function sanitizePinData(pinData?: Record<string, any>) {
    if (!pinData) return {}
    const clone = { ...pinData }
    PIN_ONLY_FIELDS.forEach((f) => delete clone[f])
    return clone
}

interface StoredWindowSettings {
    size: { width: number; height: number }
    position: WindowPosition
    isMaximized?: boolean
}

const getViewport = () => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
})

const clampToViewport = (pos: WindowPosition, size: { width: number; height: number }) => {
    const { width: vw, height: vh } = getViewport()
    const maxX = Math.max(16, vw - size.width - 16)
    const maxY = Math.max(TOPBAR_OFFSET, vh - size.height - 16)
    return {
        x: Math.min(Math.max(16, pos.x), maxX),
        y: Math.min(Math.max(TOPBAR_OFFSET, pos.y), maxY),
    }
}

const getCascadePosition = (width: number, height: number) => {
    const { width: vw, height: vh } = getViewport()
    const maxSteps = Math.max(
        1,
        Math.floor((vw - width - 32) / CASCADE_STEP_X),
        Math.floor((vh - height - TOPBAR_OFFSET - 32) / CASCADE_STEP_Y)
    )
    const step = cascadeStep % maxSteps
    cascadeStep++
    return clampToViewport(
        { x: 80 + step * CASCADE_STEP_X, y: TOPBAR_OFFSET + step * CASCADE_STEP_Y },
        { width, height }
    )
}

export function useWindowManager() {
    const { findByWindowKey, syncDataByWindowKey, pinnedItems, unpin } = usePinnedItems()
    const store = useAppStore()
    const { addNotification } = useNotifications('Оконный менеджер')

    const getEnterpriseId = (): string | null => {
        try {
            const data = localStorage.getItem('currentEnterprise')
            if (data) return JSON.parse(data)?._id ?? null
        } catch {}
        return null
    }

    const resolveCurrentRole = (): UserRole => {
        if (store.currentMemberRole) return store.currentMemberRole as UserRole

        if (typeof window !== 'undefined') {
            try {
                const rawUser = localStorage.getItem('user')
                const rawEnt = localStorage.getItem('currentEnterprise')
                if (rawUser && rawEnt) {
                    const u = JSON.parse(rawUser)
                    const ent = JSON.parse(rawEnt)

                    if (u.role === 'Администратор' || ent.director === u.name) return 'Администратор'

                    if (ent.members && Array.isArray(ent.members)) {
                        const m = ent.members.find((item: any) =>
                            String(item.userId?._id || item.userId) === String(u._id)
                        )
                        if (m?.role) return m.role as UserRole
                    }
                }
                if (rawUser) {
                    const u = JSON.parse(rawUser)
                    if (u.role) return u.role as UserRole
                }
            } catch {}
        }

        return 'Программист'
    }

    const hasAccess = (requiredPermission?: PermissionKey): boolean => {
        if (!requiredPermission) return true

        const role = resolveCurrentRole()
        if (role === 'Администратор') return true

        const permissions = ROLE_DEFAULT_PERMISSIONS[role] || []
        return permissions.includes(requiredPermission)
    }

    const fetchModuleFromDatabase = async (moduleId: string) => {
        const enterpriseId = getEnterpriseId()
        if (!enterpriseId) {
            throw new Error('Не найден enterpriseId текущего предприятия')
        }

        const response = await $fetch<{ success: boolean; module: any }>(
            `/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}`
        )

        if (!response?.success || !response.module) {
            throw new Error('Модуль не найден')
        }

        return response.module
    }

    const loadModuleIntoWindow = async (windowId: string, moduleId: string) => {
        try {
            const module = await fetchModuleFromDatabase(moduleId)

            updateWindowData(windowId, {
                code: module.code,
                name: module.name,
                format: module.format,
                files: module.files,
                dependencies: module.dependencies,
                devDependencies: module.devDependencies,
                isLoading: false,
                error: null,
            })

            const win = windows.value.find(w => w.id === windowId)
            if (win && win.title === moduleId && module.name) {
                updateWindowTitle(windowId, module.name)
            }
        } catch (e: any) {
            console.error('[WindowManager] Ошибка загрузки модуля:', e)
            updateWindowData(windowId, {
                isLoading: false,
                error: e?.data?.message || e?.message || 'Модуль не найден',
            })
        }
    }

    const loadWindowSettings = (key: string): StoredWindowSettings | null => {
        const enterpriseId = getEnterpriseId()
        if (!enterpriseId) return null
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${enterpriseId}_${key}`)
        if (!stored) return null
        try {
            return JSON.parse(stored)
        } catch {
            return null
        }
    }

    const saveWindowSettings = (key: string, settings: StoredWindowSettings) => {
        const enterpriseId = getEnterpriseId()
        if (!enterpriseId) return
        localStorage.setItem(`${STORAGE_PREFIX}${enterpriseId}_${key}`, JSON.stringify(settings))
    }

    const openWindow = (key: string, data?: any, options: OpenWindowOptions = {}): string => {
        const sysDef = getSystemWindow(key)

        if (sysDef?.requiredPermission && !hasAccess(sysDef.requiredPermission)) {
            addNotification('warning', `Доступ ограничен: для открытия «${sysDef.title}» требуются повышенные права`)
            return ''
        }

        const isModal = options.modal ?? sysDef?.modal ?? false
        let linkedPinData: Record<string, any> | undefined

        if (!isModal && !options.forceNew) {
            const existing = windows.value.find(w => w.key === key && !w.isMinimized)
            if (existing) {
                if (data) existing.data = { ...(existing.data || {}), ...data, _updated: Date.now() }
                if (options.title) existing.title = options.title
                focusWindow(existing.id)
                return existing.id
            }

            const linkedPin = findByWindowKey(key)
            if (linkedPin) {
                linkedPinData = sanitizePinData(linkedPin.data)
            }
        }

        const isDatabaseModule = options.fromDatabase ?? (!sysDef && !data?.code)
        const savedSettings = !isModal ? loadWindowSettings(key) : null

        const defaultSize: WindowSize = {
            width: options.size?.width ?? sysDef?.size?.width ?? 800,
            height: options.size?.height ?? sysDef?.size?.height ?? 600,
            minWidth: options.size?.minWidth ?? sysDef?.size?.minWidth ?? 400,
            minHeight: options.size?.minHeight ?? sysDef?.size?.minHeight ?? 300,
        }

        let initialSize: WindowSize = { ...defaultSize }
        let initialPosition = getCascadePosition(initialSize.width, initialSize.height)
        let isMaximized = false

        if (savedSettings) {
            initialSize = {
                ...defaultSize,
                width: savedSettings.size.width,
                height: savedSettings.size.height,
            }
            initialPosition = clampToViewport(savedSettings.position, initialSize)
            isMaximized = savedSettings.isMaximized || false
        }

        const title =
            options.title ||
            sysDef?.title ||
            data?.name ||
            data?.moduleName ||
            key

        const mergedData = { ...(linkedPinData ?? {}), ...(data ?? {}) }

        const newWindow: WindowItem = {
            id: `window_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            key,
            title,
            zIndex: ++zIndexCounter,
            isMinimized: false,
            isModal,
            position: initialPosition,
            size: { ...initialSize, isMaximized },
            data: isDatabaseModule
                ? { ...mergedData, moduleId: key, isLoading: true, error: null }
                : mergedData,
        }

        windows.value.push(newWindow)

        if (isDatabaseModule) {
            loadModuleIntoWindow(newWindow.id, key)
        }

        return newWindow.id
    }

    const openPreviewWindow = (sourceKey: string, data?: any, options?: OpenWindowOptions) => {
        return openWindow(`preview:${sourceKey}`, data, {
            size: { width: 600, height: 500, minWidth: 600, minHeight: 400 },
            ...options,
        })
    }

    const closeWindow = (id: string) => {
        const index = windows.value.findIndex(w => w.id === id)
        if (index === -1) return

        const win = windows.value[index]
        windows.value.splice(index, 1)

        if (win?.key) {
            pinnedItems.value
                .filter(p => p.windowKey === win.key && p.closeWithWindow)
                .forEach(p => unpin(p.id))
        }
    }

    const focusWindow = (id: string) => {
        const win = windows.value.find(w => w.id === id)
        if (win) {
            if (win.isMinimized) win.isMinimized = false
            win.zIndex = ++zIndexCounter
        }
    }

    const minimizeWindow = (id: string) => {
        const win = windows.value.find(w => w.id === id)
        if (win) win.isMinimized = true
    }

    const persistIfNeeded = (win: WindowItem) => {
        if (!win.isModal) {
            saveWindowSettings(win.key, {
                size: { width: win.size.width, height: win.size.height },
                position: win.position,
                isMaximized: win.size.isMaximized,
            })
        }
    }

    const moveWindow = (id: string, newPosition: WindowPosition) => {
        const win = windows.value.find(w => w.id === id)
        if (win) {
            win.position = newPosition
            persistIfNeeded(win)
        }
    }

    const resizeWindow = (id: string, newSize: { width: number; height: number }) => {
        const win = windows.value.find(w => w.id === id)
        if (win) {
            win.size.width = Math.max(win.size.minWidth || 300, newSize.width)
            win.size.height = Math.max(win.size.minHeight || 200, newSize.height)
            persistIfNeeded(win)
        }
    }

    const maximizeWindow = (id: string) => {
        const win = windows.value.find(w => w.id === id)
        if (!win) return

        win.size.isMaximized = !win.size.isMaximized
        if (win.size.isMaximized) {
            win.previousSize = { width: win.size.width, height: win.size.height }
            win.previousPosition = { ...win.position }
            win.zIndex = 9999
        } else {
            if (win.previousSize) {
                win.size.width = win.previousSize.width
                win.size.height = win.previousSize.height
            }
            if (win.previousPosition) win.position = win.previousPosition
            win.zIndex = ++zIndexCounter
        }
        persistIfNeeded(win)
    }

    const updateWindowData = (id: string, newData: any) => {
        const win = windows.value.find(w => w.id === id)
        if (win) {
            win.data = { ...(win.data || {}), ...newData, _updated: Date.now() }
        }
    }

    const updateWindowTitle = (id: string, title: string) => {
        const win = windows.value.find(w => w.id === id)
        if (win) win.title = title
    }

    watch(windows, () => {
        windows.value.forEach(win => {
            if (!win.key) return
            const current = JSON.stringify(win.data)
            const cached = dataCache.get(win.id)
            if (cached !== current) {
                dataCache.set(win.id, current)
                syncDataByWindowKey(win.key, win.data || {})
            }
        })
    }, { deep: true })

    return {
        windows,
        openWindow,
        openPreviewWindow,
        closeWindow,
        focusWindow,
        minimizeWindow,
        moveWindow,
        resizeWindow,
        maximizeWindow,
        updateWindowData,
        updateWindowTitle,
        hasAccess,
    }
}