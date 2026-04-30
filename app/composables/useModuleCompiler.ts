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

// Кэш загруженных компонентов (глобальный, его можно оставить общим)
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

function normalizePath(p: string) {
    return p.replace(/^\.\//, '').replace(/\\/g, '/')
}

// Функция для оборачивания JS/TS кода с инъекцией глобалов
function wrapWithGlobals(code: string, filename: string): string {
    const wrapped = `
// Обёртка для доступа к глобалам
const __globals__ = (typeof window !== 'undefined' && window.__moduleGlobals__) || {};

// Проксируем функции через глобалы
const useLogger = __globals__.useLogger || (() => { console.warn('useLogger not available'); return { addLog: () => {} }; });
const useNotifications = __globals__.useNotifications || (() => { console.warn('useNotifications not available'); return { addNotification: () => {} }; });
const useWindowManager = __globals__.useWindowManager || (() => ({}));
const useModulesStore = __globals__.useModulesStore || (() => ({}));

// Оригинальный код
${code}

// Экспортируем всё, что было в module.exports
if (typeof module !== 'undefined' && module.exports) {
    if (typeof exports !== 'undefined') {
        Object.assign(exports, module.exports);
    }
}
`
    return wrapped
}

function convertESModuleToCommonJS(code: string, filename: string): string {
    try {
        const result = babel.transform(code, {
            presets: ['es2015', 'typescript'],
            filename: filename,
            sourceType: 'module'
        })
        return result.code || code
    } catch (e) {
        let converted = code
        converted = converted.replace(/export\s+const\s+(\w+)\s*=\s*([^;]+);?/g, (_, name, value) => {
            return `const ${name} = ${value}; exports.${name} = ${name};`
        })
        converted = converted.replace(/export\s+function\s+(\w+)\s*\(([^)]*)\)\s*{/g, (_, name, params) => {
            return `function ${name}(${params}) {; exports.${name} = ${name};`
        })
        converted = converted.replace(/export\s+default\s+([^;]+);?/g, (_, value) => {
            return `module.exports.default = ${value};`
        })
        return converted
    }
}

// 🔥 ГЛАВНОЕ: убираем синглтон, теперь каждый вызов useModuleCompiler создаёт новый экземпляр
export const useModuleCompiler = () => {
    return createCompiler() // ← больше нет синглтона
}

function createCompiler() {
    // Каждый экземпляр имеет свои реактивные переменные
    const compiledComponent = shallowRef<any>(null)
    const compiling = ref(false)
    const compileError = ref<string | null>(null)
    const activeKey = ref(0)

    let debounceTimer: any = null
    let instanceId = Math.random().toString(36).substring(7) // уникальный ID для отладки

    // Создаём глобалы для инъекции в JS/TS файлы
    const createGlobalInjections = () => {
        const windowManager = useWindowManager()
        const moduleStore = useModulesStore()

        return {
            useLogger: (s?: string) => useLogger(s),
            useNotifications: (s?: string) => useNotifications(s),
            useWindowManager: () => windowManager,
            useModulesStore: () => moduleStore
        }
    }

    const compileModule = async (code: string, filesList: any[] = []) => {
        if (!code?.trim()) {
            compileError.value = 'Нет кода'
            return
        }

        compiling.value = true
        compileError.value = null

        addLog('info', `Компилятор начал компиляцию файла...`)

        try {
            // Инжектим глобалы в window для доступа из JS/TS модулей
            const globalInjections = createGlobalInjections()
            if (typeof window !== 'undefined') {
                // Используем уникальный ключ для каждого модуля? Нет, лучше единый объект
                (window as any).__moduleGlobals__ = globalInjections
            }

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

                if (file.format === 'js' || file.format === 'ts' || filePath.endsWith('.js') || filePath.endsWith('.ts')) {
                    let processedCode = fileCode

                    if (fileCode.includes('export') || fileCode.includes('import')) {
                        processedCode = convertESModuleToCommonJS(fileCode, filePath)
                    }

                    processedCode = wrapWithGlobals(processedCode, filePath)
                    fileCode = processedCode
                }

                files[filePath] = fileCode
                const baseName = filePath.split('/').pop()!
                files[baseName] = fileCode
                const withoutExt = filePath.replace(/\.(js|ts|vue)$/, '')
                files[withoutExt] = fileCode
            }

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
                            return files[v]
                        }
                    }
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

            component.components = {
                ...(component.components || {}),
                ...componentRegistry
            }

            const originalSetup = component.setup
            if (originalSetup) {
                component.setup = (props: any, ctx: any) => {
                    Object.assign(globalThis, globalInjections)
                    return originalSetup(props, ctx)
                }
            } else {
                Object.assign(globalThis, globalInjections)
            }

            activeKey.value++
            compiledComponent.value = markRaw(component)

            addLog('success', `Компиляция закончена`)

        } catch (e: any) {
            addLog('error', `Ошибка компилятора - ${e}`)
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
        addLog('warning', 'Перезагрузка компилятора')
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