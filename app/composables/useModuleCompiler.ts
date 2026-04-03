import { ref, shallowRef, markRaw, nextTick } from 'vue'
import * as Vue from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'

import MoloInput from '~/components/MoloInput.vue'
import MoloSelect from '~/components/MoloSelect.vue'

let _instance: ReturnType<typeof createCompiler> | null = null

export const useModuleCompiler = () => {
    if (!_instance) {
        _instance = createCompiler()
    }
    return _instance
}

function createCompiler() {
    const compiledComponent = shallowRef<any>(null)
    const compiling = ref(false)
    const compileError = ref<string | null>(null)

    let componentVersion = 0
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    // ГЛОБАЛЬНЫЕ КОМПОНЕНТЫ
    const globalComponents = {
        MoloInput,
        MoloSelect
    }

    const compileModule = async (code: string) => {
        if (!code?.trim()) return

        compiling.value = true
        compileError.value = null

        try {
            componentVersion++

            const uniqueCode =
                code + `\n// __VERSION__: ${componentVersion}_${Date.now()}`

            const files: Record<string, string> = {
                'dynamic.vue': uniqueCode
            }

            const options = {
                moduleCache: { vue: Vue },
                compiler,
                async getFile(url: string) {
                    if (files[url]) return files[url]
                    throw new Error(`Файл не найден: ${url}`)
                },
                addStyle(css: string) {
                    const existingStyle = document.getElementById('dynamic-style')
                    if (existingStyle) existingStyle.remove()

                    const style = document.createElement('style')
                    style.id = 'dynamic-style'
                    style.textContent = css
                    document.head.appendChild(style)
                }
            }

            const module = await loadModule('dynamic.vue', options)

            let component = module.default || module

            // ВОТ ГЛАВНОЕ — ИНЖЕКЦИЯ КОМПОНЕНТОВ
            component = {
                ...component,
                components: {
                    ...(component.components || {}),
                    ...globalComponents
                }
            }

            // 🔥 форс обновления
            compiledComponent.value = null
            await nextTick()

            compiledComponent.value = markRaw(component)

        } catch (err: any) {
            console.error('Compilation error:', err)
            compileError.value = err.message || 'Ошибка компиляции'
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

        const existingStyle = document.getElementById('dynamic-style')
        if (existingStyle) existingStyle.remove()
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