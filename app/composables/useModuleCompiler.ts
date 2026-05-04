import { ref, shallowRef, markRaw } from 'vue'
import * as Vue from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'
import * as babel from '@babel/standalone'

import { useNotifications } from '~~/app/composables/useNotifications'
import { useLogger } from '~~/app/composables/useLogger'
import { useWindowManager } from '~~/app/composables/useWindowManager'
import { useModulesStore } from '~~/stores/moduleStore'

const componentModules = import.meta.glob('~~/app/components/**/*.vue')
const { addLog } = useLogger('Внутренний компилятор')

// Глобальный кеш
const packageCache = new Map<string, any>()
const pendingPackagePromises = new Map<string, Promise<any>>()
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

function wrapWithGlobals(code: string, filename: string): string {
    return `
const __globals__ = (typeof window !== 'undefined' && window.__moduleGlobals__) || {};

const useLogger = __globals__.useLogger || (() => { console.warn('useLogger not available'); return { addLog: () => {} }; });
const useNotifications = __globals__.useNotifications || (() => { console.warn('useNotifications not available'); return { addNotification: () => {} }; });
const useWindowManager = __globals__.useWindowManager || (() => ({}));
const useModulesStore = __globals__.useModulesStore || (() => ({}));

${code}

if (typeof module !== 'undefined' && module.exports) {
    if (typeof exports !== 'undefined') {
        Object.assign(exports, module.exports);
    }
}
`
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

// 🔥 УНИВЕРСАЛЬНАЯ ЗАГРУЗКА ЛЮБОГО ПАКЕТА
async function loadNpmPackage(packageName: string, version: string): Promise<any> {
    const cacheKey = `${packageName}@${version}`

    if (packageCache.has(cacheKey)) {
        addLog('info', `Пакет ${cacheKey} взят из кеша`)
        return packageCache.get(cacheKey)
    }

    if (pendingPackagePromises.has(cacheKey)) {
        addLog('info', `Ожидаем загрузку ${cacheKey}...`)
        return pendingPackagePromises.get(cacheKey)
    }

    addLog('info', `Загружаем пакет ${cacheKey}...`)

    const loadPromise = (async () => {
        // Пробуем разные CDN в разном порядке для максимальной совместимости
        const cdnUrls = [
            // esm.sh - лучший для ESM
            `https://esm.sh/${packageName}${version !== 'latest' ? `@${version}` : ''}`,
            // Skypack - хорошая альтернатива
            `https://cdn.skypack.dev/${packageName}${version !== 'latest' ? `@${version}` : ''}`,
            // jsDelivr - пробуем разные пути
            `https://cdn.jsdelivr.net/npm/${packageName}${version !== 'latest' ? `@${version}` : ''}/+esm`,
            `https://cdn.jsdelivr.net/npm/${packageName}${version !== 'latest' ? `@${version}` : ''}/dist/index.esm.js`,
            `https://cdn.jsdelivr.net/npm/${packageName}${version !== 'latest' ? `@${version}` : ''}/index.js`,
            // Unpkg
            `https://unpkg.com/${packageName}${version !== 'latest' ? `@${version}` : ''}/dist/index.esm.js`,
            `https://unpkg.com/${packageName}${version !== 'latest' ? `@${version}` : ''}/index.js`,
        ]

        let lastError = null

        for (const url of cdnUrls) {
            try {
                addLog('info', `Пробуем: ${url.substring(0, 80)}...`)
                const module = await import(/* @vite-ignore */ url)
                addLog('success', `Пакет ${cacheKey} загружен`)
                return module
            } catch (e: any) {
                lastError = e
                // Не логгируем каждую ошибку, чтобы не засорять консоль
                continue
            }
        }

        // Если не загрузился через CDN, пробуем создать прокси через наш сервер
        addLog('info', `Пробуем загрузить через серверный прокси...`)
        try {
            const response = await $fetch('/api/npm/proxy', {
                method: 'POST',
                body: { packageName, version }
            })
            if (response.code) {
                // Создаём Blob URL из полученного кода
                const blob = new Blob([response.code], { type: 'application/javascript' })
                const url = URL.createObjectURL(blob)
                const module = await import(/* @vite-ignore */ url)
                URL.revokeObjectURL(url)
                addLog('success', `Пакет ${cacheKey} загружен через прокси`)
                return module
            }
        } catch (e: any) {
            lastError = e
        }

        throw new Error(`Не удалось загрузить пакет ${packageName}. Попробуйте другую версию или проверьте наличие ESM сборки.`)
    })()

    pendingPackagePromises.set(cacheKey, loadPromise)

    try {
        const module = await loadPromise
        packageCache.set(cacheKey, module)
        return module
    } finally {
        pendingPackagePromises.delete(cacheKey)
    }
}

export const useModuleCompiler = () => {
    return createCompiler()
}

function createCompiler() {
    const compiledComponent = shallowRef<any>(null)
    const compiling = ref(false)
    const compileError = ref<string | null>(null)
    const activeKey = ref(0)
    let debounceTimer: any = null

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

    const compileModule = async (code: string, filesList: any[] = [], dependencies: Record<string, string> = {}) => {
        if (!code?.trim()) {
            compileError.value = 'Нет кода'
            return
        }

        compiling.value = true
        compileError.value = null

        const startTime = performance.now()
        addLog('info', `Компиляция началась...`)

        try {
            const globalInjections = createGlobalInjections()
            if (typeof window !== 'undefined') {
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

                    // 1. Проверяем локальные файлы
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

                    if (url === 'dynamic.vue' || url === 'dynamic') {
                        throw new Error('Circular dependency: cannot import self')
                    }

                    // 2. Проверяем, npm ли это пакет
                    const isNpmPackage = !url.startsWith('.') &&
                        !url.startsWith('/') &&
                        !url.endsWith('.vue') &&
                        !url.endsWith('.js') &&
                        !url.endsWith('.ts') &&
                        !url.includes('?') &&
                        !url.includes('#')

                    if (isNpmPackage) {
                        let packageName: string
                        let subPath: string = ''

                        if (url.startsWith('@')) {
                            // Scoped package: @scope/name/sub/path
                            const parts = url.split('/')
                            packageName = `${parts[0]}/${parts[1]}`
                            subPath = parts.slice(2).join('/')
                        } else {
                            // Regular package: package-name/sub/path
                            const parts = url.split('/')
                            packageName = parts[0]
                            subPath = parts.slice(1).join('/')
                        }

                        addLog('info', `Запрос пакета: ${packageName}, подпуть: ${subPath || 'без подпути'}`)

                        if (dependencies[packageName]) {
                            const version = dependencies[packageName]

                            // Загружаем пакет
                            const module = await loadNpmPackage(packageName, version)

                            // Если есть подпуть, нужно получить вложенный экспорт
                            let exportedModule = module

                            if (subPath) {
                                // Пытаемся получить вложенный модуль
                                const subPathParts = subPath.split('/')
                                for (const part of subPathParts) {
                                    if (exportedModule && exportedModule[part]) {
                                        exportedModule = exportedModule[part]
                                    } else if (exportedModule && exportedModule.default && exportedModule.default[part]) {
                                        exportedModule = exportedModule.default[part]
                                    } else {
                                        addLog('warning', `Подпуть ${subPath} не найден в пакете ${packageName}`)
                                        break
                                    }
                                }
                            }

                            // Создаём код экспорта
                            const exports = Object.keys(exportedModule || module).filter(k => k !== 'default')
                            const hasDefault = (exportedModule || module).default !== undefined
                            const defaultExport = hasDefault ? (exportedModule || module).default : null

                            let exportCode = `
                const __exports__ = {};
                ${exports.map(key => `__exports__.${key} = ${JSON.stringify(exportedModule[key])};`).join('\n')}
                ${defaultExport ? `__exports__.default = ${JSON.stringify(defaultExport)};` : ''}
                module.exports = __exports__.default || __exports__;
                Object.assign(module.exports, __exports__);
            `
                            return exportCode
                        } else {
                            throw new Error(`Dependency not found: ${packageName}. Add it to module dependencies first.`)
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

            const endTime = performance.now()
            addLog('success', `Компиляция закончена за ${Math.round(endTime - startTime)}ms`)

        } catch (e: any) {
            addLog('error', `Ошибка компиляции: ${e.message}`)
            compileError.value = e.message || 'Ошибка компиляции модуля'
            compiledComponent.value = null
        } finally {
            compiling.value = false
        }
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
        reset,
        activeKey
    }
}