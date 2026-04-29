import { ref, shallowRef, markRaw } from 'vue'
import * as Vue from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'
import * as babel from '@babel/standalone'

import { useNotifications } from '~~/app/composables/useNotifications'
import { useLogger } from '~~/app/composables/useLogger'
import { useWindowManager } from '~~/app/composables/useWindowManager'
import { useModulesStore } from '~~/stores/moduleStore'

// Глобальная регистрация компонентов из папки components
const componentModules = import.meta.glob('~~/app/components/**/*.vue')
const { addLog } = useLogger('Внутренний компилятор')
// Кэш загруженных компонентов
let loadedComponents: Record<string, any> | null = null
let loadingPromise: Promise<Record<string, any>> | null = null

async function loadAllComponents() {
    if (loadedComponents) return loadedComponents
    if (loadingPromise) return loadingPromise

    loadingPromise = (async () => {
        const entries = await Promise.all(
            Object.entries(componentModules).map(async ([path, importer]) => {
                const name = path.split('/').pop()?.replace('.vue', '')
                if (!name) return null
                const mod = await importer()
                return [name, mod.default || mod]
            })
        )
        const result: Record<string, any> = {}
        for (const entry of entries) {
            if (entry) result[entry[0]] = entry[1]
        }
        loadedComponents = result
        return result
    })()

    return loadingPromise
}

let _instance: any = null

export const useModuleCompiler = () => {
    if (!_instance) _instance = createCompiler()
    return _instance
}

function normalizePath(p: string) {
    return p.replace(/^\.\//, '').replace(/\\/g, '/')
}

// Функция для конвертации ES модуля в CommonJS
function convertESModuleToCommonJS(code: string, filename: string): string {
    // Простая конвертация export const xxx = ... -> const xxx = ...; exports.xxx = xxx
    // Для сложных случаев используем Babel
    try {
        const result = babel.transform(code, {
            presets: ['es2015', 'typescript'],
            filename: filename,
            sourceType: 'module'
        })
        return result.code || code
    } catch (e) {
        // Fallback: ручная конвертация
        let converted = code

        // Заменяем export const name = value -> const name = value; exports.name = name
        converted = converted.replace(/export\s+const\s+(\w+)\s*=\s*([^;]+);?/g, (_, name, value) => {
            return `const ${name} = ${value}; exports.${name} = ${name};`
        })

        // Заменяем export function name() {} -> function name() {}; exports.name = name
        converted = converted.replace(/export\s+function\s+(\w+)\s*\(([^)]*)\)\s*{/g, (_, name, params) => {
            return `function ${name}(${params}) {; exports.${name} = ${name};`
        })

        // Заменяем export default value -> module.exports.default = value
        converted = converted.replace(/export\s+default\s+([^;]+);?/g, (_, value) => {
            return `module.exports.default = ${value};`
        })

        return converted
    }
}

function createCompiler() {
    const compiledComponent = shallowRef<any>(null)
    const compiling = ref(false)
    const compileError = ref<string | null>(null)
    const activeKey = ref(0)

    let debounceTimer: any = null

    const compileModule = async (code: string, filesList: any[] = []) => {
        if (!code?.trim()) {
            compileError.value = 'Нет кода'
            return
        }

        compiling.value = true
        compileError.value = null

        try {
            // Ждём загрузки всех компонентов
            const componentRegistry = await loadAllComponents()

            const files: Record<string, string> = {}
            files['dynamic.vue'] = code

            for (const file of filesList) {
                let filePath = normalizePath(file.path || file.name || '')
                let fileCode = file.code || ''

                if (!filePath.includes('.')) {
                    const ext = file.format || (file.name?.split('.').pop() || 'js')
                    filePath += `.${ext}`
                }

                // Если это JS или TS файл с ES модулями - конвертируем в CommonJS
                if (file.format === 'js' || file.format === 'ts' || filePath.endsWith('.js') || filePath.endsWith('.ts')) {
                    if (fileCode.includes('export') || fileCode.includes('import')) {
                        // addLog('warning', `Конвертирую ES модуль в CommonJS...: ${filePath}`)
                        fileCode = convertESModuleToCommonJS(fileCode, filePath)
                    }
                }

                files[filePath] = fileCode
                const baseName = filePath.split('/').pop()!
                files[baseName] = fileCode
                const withoutExt = filePath.replace(/\.(js|ts|vue)$/, '')
                files[withoutExt] = fileCode
                addLog('success', `Модуль сконвертирован в CommonJS: ${filePath}`)

            }

            // addLog('info', `Доступные файлы для модуля: ${Object.keys(files)}`)

            const options = {
                moduleCache: { vue: Vue },
                compiler,

                async getFile(url: string) {
                    url = normalizePath(url)

                    const variants = [
                        url,
                        `${url}.vue`,
                        `${url}.js`,
                        `${url}.ts`,
                        url.replace(/\.(js|ts|vue)$/, '')
                    ]

                    const name = url.split('/').pop()
                    if (name) variants.push(name)

                    for (const v of variants) {
                        if (files[v]) {
                            // addLog('info', `Найден файл для модуля: ${v}`)

                            return files[v]
                        }
                    }
                    // addLog('error', `Файл не найден: ${url}`)
                    throw new Error(`Файл не найден: ${url}`)
                },

                addStyle(css: string) {
                    let el = document.getElementById('dynamic-style')
                    if (!el) {
                        el = document.createElement('style')
                        el.id = 'dynamic-style'
                        document.head.appendChild(el)
                    }
                    el.textContent = css
                },

                getCompilerConfig: () => ({
                    compiler,
                    compilerConfig: {
                        sourceType: 'module',
                        babelParserPlugins: ['jsx', 'typescript']
                    }
                })
            }

            const mod = await loadModule('dynamic.vue', options)
            let component = mod.default || mod
            // addLog('success', `Модуль загружен, экспорты: ${Object.keys(mod)}`)

            // Подмешиваем реальные компоненты (не промисы!)
            component.components = {
                ...(component.components || {}),
                ...componentRegistry
            }

            const windowManager = useWindowManager()
            const moduleStore = useModulesStore()

            const injectedGlobals = {
                useNotifications: () => useNotifications(),
                useLogger: (s?: string) => useLogger(s),
                useWindowManager: () => windowManager,
                useModulesStore: () => moduleStore
            }

            const originalSetup = component.setup
            if (originalSetup) {
                component.setup = (props: any, ctx: any) => {
                    Object.assign(globalThis, injectedGlobals)
                    return originalSetup(props, ctx)
                }
            } else {
                Object.assign(globalThis, injectedGlobals)
            }

            activeKey.value++
            compiledComponent.value = markRaw(component)

        } catch (e: any) {
            // addLog('error', `Ошибка компилятора: ${e}`)
            compileError.value = e.message || 'Ошибка компиляции модуля'
            compiledComponent.value = null
        } finally {
            compiling.value = false
        }
    }

    const compileModuleDebounced = (code: string, files: any[] = [], delay = 300) => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => compileModule(code, files), delay)
    }

    const reset = () => {
        compiledComponent.value = null
        compileError.value = null
        activeKey.value++
    }

    return {
        compiledComponent,
        compiling,
        compileError,
        compileModule,
        compileModuleDebounced,
        reset,
        activeKey
    }
}