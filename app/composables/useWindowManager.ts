import { ref } from 'vue'
import type { WindowItem, WindowPosition, WindowSize, OpenWindowOptions } from '~/types/window'
import { getSystemWindow } from '~~/app/composables/systemWindows'

// Единое хранилище окон на всё приложение.
const windows = ref<WindowItem[]>([])
let zIndexCounter = 100
let cascadeStep = 0

const TOPBAR_OFFSET = 90
const CASCADE_STEP_X = 34
const CASCADE_STEP_Y = 28
const STORAGE_PREFIX = 'window_settings_'

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
    const getEnterpriseId = (): string | null => {
        try {
            const data = localStorage.getItem('currentEnterprise')
            if (data) return JSON.parse(data)?._id ?? null
        } catch (e) {}
        return null
    }

    /**
     * Загружает модуль из БД целиком (мета + code + files + dependencies).
     * Дергает GET /api/enterprises/:id/dynamicModules/:moduleId — тот самый
     * "полный" эндпоинт, который отдаёт всё одним запросом.
     */
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

    /**
     * Подгружает модуль из БД в уже созданное окно (асинхронно, после того
     * как окно отрисовалось со спиннером/лоадером в data.isLoading).
     */
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

            // Если заголовок ещё не задан явно (остался как moduleId/key) — берём имя модуля
            const win = windows.value.find(w => w.id === windowId)
            if (win && win.title === moduleId && module.name) {
                updateWindowTitle(windowId, module.name)
            }
        } catch (e: any) {
            console.error('[WindowManager] Не удалось загрузить модуль из БД:', e)
            updateWindowData(windowId, {
                isLoading: false,
                error: e?.data?.message || e?.message || 'Информация о модуле не найдена',
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
        } catch (e) {
            return null
        }
    }

    const saveWindowSettings = (key: string, settings: StoredWindowSettings) => {
        const enterpriseId = getEnterpriseId()
        if (!enterpriseId) return
        localStorage.setItem(`${STORAGE_PREFIX}${enterpriseId}_${key}`, JSON.stringify(settings))
    }

    /**
     * ЕДИНСТВЕННЫЙ способ открыть окно во всём приложении.
     *
     *   openWindow('login')                                    // системный экран (SYSTEM_WINDOWS)
     *   openWindow(moduleId)                                    // модуль из БД — code подтянется САМ, асинхронно
     *   openWindow(moduleId, { code, name })                    // модуль, для которого code уже есть на руках (превью в Creature)
     *   openWindow('preview:' + moduleId, { code, moduleName }) // окно превью, отдельное от самого модуля
     *
     * key — произвольная строка. Что рисовать по этому key, решает
     * WindowsContent.vue в момент рендера, а определяется это здесь:
     *   1) key есть в SYSTEM_WINDOWS               -> системный экран (login, creature и т.д.);
     *   2) явно передан data.code                  -> рисуем сразу, без похода в сеть
     *      (превью несохранённого модуля, DynamicModuleLoader.vue);
     *   3) иначе (не системный key, нет data.code)  -> key считается moduleId из БД:
     *      окно создаётся сразу с data.isLoading = true, а затем
     *      loadModuleIntoWindow() асинхронно тянет GET
     *      /api/enterprises/:id/dynamicModules/:moduleId и заполняет data.code.
     *      Если модуль не нашёлся — в data.error попадёт текст ошибки
     *      (WindowsContent.vue должен уметь отрисовать isLoading/error).
     *
     * Одинаковый key при повторном вызове не создаёт новое окно — оно
     * фокусируется, а data обновляется. Нужно всегда новое — options.forceNew.
     */
    const openWindow = (key: string, data?: any, options: OpenWindowOptions = {}): string => {
        const isModal = options.modal ?? getSystemWindow(key)?.modal ?? false

        if (!isModal && !options.forceNew) {
            const existing = windows.value.find(w => w.key === key && !w.isMinimized)
            if (existing) {
                if (data) existing.data = { ...(existing.data || {}), ...data, _updated: Date.now() }
                if (options.title) existing.title = options.title
                focusWindow(existing.id)
                return existing.id
            }
        }

        const sysDef = getSystemWindow(key)

        // options.fromDatabase — явный флаг для тех редких случаев, когда
        // автоопределения недостаточно (например: принудительно перезагрузить
        // модуль из БД, даже если code уже был передан). По умолчанию решаем
        // сами: если ключ НЕ системный и code не передан явно — значит key
        // это moduleId/fileName из БД, и модуль нужно подтянуть по API.
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
                ? { ...(data ?? {}), moduleId: key, isLoading: true, error: null }
                : (data ?? {}),
        }

        windows.value.push(newWindow)

        // Окно уже открыто и показывает лоадер — теперь идём в БД за содержимым.
        if (isDatabaseModule) {
            loadModuleIntoWindow(newWindow.id, key)
        }

        return newWindow.id
    }

    /**
     * Окно предпросмотра — например, в Creature.vue пользователь редактирует
     * ещё не сохранённый модуль и хочет посмотреть, как он выглядит, не
     * закрывая редактор. Это ДОЛЖНО быть отдельное окно от самого модуля
     * (иначе клик "Превью" просто фокусировал бы окно редактора вместо
     * открытия предпросмотра). Поэтому у окна превью свой ключ —
     * 'preview:' + ключ источника, и эта деталь спрятана здесь, а не
     * размазана по вызывающему коду.
     *
     *   openPreviewWindow(fileName, { code: currentCode, moduleName })
     */
    const openPreviewWindow = (sourceKey: string, data?: any, options?: OpenWindowOptions) => {
        return openWindow(`preview:${sourceKey}`, data, {
            size: { width: 600, height: 500, minWidth: 600, minHeight: 400 },
            ...options,
        })
    }

    const closeWindow = (id: string) => {
        const index = windows.value.findIndex(w => w.id === id)
        if (index !== -1) windows.value.splice(index, 1)
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
        if (win) win.data = { ...(win.data || {}), ...newData, _updated: Date.now() }
    }

    const updateWindowTitle = (id: string, title: string) => {
        const win = windows.value.find(w => w.id === id)
        if (win) win.title = title
    }

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
    }
}