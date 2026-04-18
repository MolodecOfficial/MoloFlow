import { ref, shallowRef, markRaw } from 'vue'
import * as Vue from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'

// composables (реальные зависимости)
import { useNotifications } from '~~/app/composables/useNotifications'
import { useWindowManager } from '~~/app/composables/useWindowManager'
import { useModulesStore } from '~~/stores/moduleStore'

// авто-регистрация компонентов
const componentModules = import.meta.glob('~~/app/components/**/*.vue', {
    eager: true,
    import: 'default'
})

const componentRegistry: Record<string, any> = {}

for (const path in componentModules) {
    const name = path.split('/').pop()?.replace('.vue', '')
    if (name) {
        componentRegistry[name] = componentModules[path]
    }
}

// singleton
let _instance: ReturnType<typeof createCompiler> | null = null

export const useModuleCompiler = () => {
    if (!_instance) _instance = createCompiler()
    return _instance
}

function createCompiler() {
    const compiledComponent = shallowRef<any>(null)
    const compiling = ref(false)
    const compileError = ref<string | null>(null)

    let debounceTimer: any = null

    // ❌ ВАЖНО: никаких import внутри динамического кода
    const buildCode = (code: string) => code

    const compileModule = async (code: string) => {
        if (!code?.trim()) return

        compiling.value = true
        compileError.value = null

        try {
            const finalCode = buildCode(code)

            const files: Record<string, string> = {
                'dynamic.vue': finalCode + `\n//__${Date.now()}`
            }

            const options = {
                moduleCache: {
                    vue: Vue,
                },

                compiler,

                async getFile(url: string) {
                    if (files[url]) return files[url]
                    throw new Error(`Файл не найден: ${url}`)
                },

                addStyle(css: string) {
                    const id = 'dynamic-style'
                    let style = document.getElementById(id)

                    if (!style) {
                        style = document.createElement('style')
                        style.id = id
                        document.head.appendChild(style)
                    }

                    style.textContent = css
                },
            }

            const mod = await loadModule('dynamic.vue', options)
            let component = mod.default || mod

            // =========================
            // 🔥 CORE FIX: INJECTION
            // =========================

            const notifications = useNotifications()
            const windowManager = useWindowManager()
            const moduleStore = useModulesStore()

            const injectedGlobals = {
                useNotifications: () => notifications,
                useWindowManager: () => windowManager,
                useModulesStore: () => moduleStore
            }

            // делаем доступными в runtime
            Object.assign(globalThis, injectedGlobals)

            // =========================
            // components registry
            // =========================

            component.components = {
                ...(component.components || {}),
                ...componentRegistry
            }

            // =========================
            // safety wrapper setup
            // =========================

            const originalSetup = component.setup

            if (originalSetup) {
                component.setup = (props: any, ctx: any) => {
                    // обновляем runtime зависимости перед каждым запуском
                    Object.assign(globalThis, injectedGlobals)

                    return originalSetup(props, ctx)
                }
            }

            compiledComponent.value = markRaw(component)

        } catch (err: any) {
            console.error('compile error:', err)
            compileError.value = err?.message || 'Ошибка компиляции'
            compiledComponent.value = null
        } finally {
            compiling.value = false
        }
    }

    const compileModuleDebounced = (code: string, delay = 400) => {
        if (debounceTimer) clearTimeout(debounceTimer)

        debounceTimer = setTimeout(() => {
            compileModule(code)
        }, delay)
    }

    const clearCompiled = () => {
        compiledComponent.value = null
        compileError.value = null
    }

    return {
        compiledComponent,
        compiling,
        compileError,
        compileModule,
        compileModuleDebounced,
        clearCompiled
    }
}