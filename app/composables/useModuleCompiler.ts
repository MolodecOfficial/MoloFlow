import { ref, shallowRef, markRaw } from 'vue'
import * as Vue from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'

// компоненты
import MoloInput from '~/components/MoloInput.vue'
import MoloSelect from '~/components/MoloSelect.vue'

// composables
import { useNotifications } from '~~/app/composables/useNotifications'
import { useWindowManager } from '~/composables/useWindowManager'

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

    // ГЛОБАЛЬНАЯ ИНЪЕКЦИЯ
    const injectGlobals = () => {
        const g = window as any

        Object.assign(g, Vue)

        const notifications = useNotifications()
        const windowManager = useWindowManager()

        // теперь это НЕ функции, а готовые объекты
        g.useNotifications = () => notifications
        g.useWindowManager = () => windowManager

        g.MoloInput = MoloInput
        g.MoloSelect = MoloSelect
    }

    const compileModule = async (code: string) => {
        if (!code?.trim()) return

        compiling.value = true
        compileError.value = null

        try {
            injectGlobals()

            // 🔥 ВИРТУАЛЬНЫЙ ФАЙЛ
            const files: Record<string, string> = {
                'dynamic.vue': code + `\n//__${Date.now()}`
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
                    const old = document.getElementById('dynamic-style')
                    if (old) old.remove()

                    const style = document.createElement('style')
                    style.id = 'dynamic-style'
                    style.textContent = css
                    document.head.appendChild(style)
                },
            }

            const mod = await loadModule('dynamic.vue', options)

            let component = mod.default || mod

            component.components = {
                ...(component.components || {}),
                MoloInput,
                MoloSelect
            }

            compiledComponent.value = markRaw(component)

        } catch (err: any) {
            console.error('compile error:', err)
            compileError.value = err.message || 'Ошибка'
            compiledComponent.value = null
        } finally {
            compiling.value = false
        }
    }

    const compileModuleDebounced = (code: string, delay = 500) => {
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