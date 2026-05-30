// composables/useModuleCompiler.ts
import * as Vue from 'vue'
import { markRaw, ref, shallowRef } from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'
import * as Babel from '@babel/standalone'

// ======================================================
// Загрузка всех компонентов проекта (MoloInput, …)
// ======================================================
const componentModules = import.meta.glob('~/components/**/*.vue')
let loadedComponents: Record<string, any> | null = null

async function loadAllComponents() {
    if (loadedComponents) return loadedComponents
    const result: Record<string, any> = {}
    for (const [path, importer] of Object.entries(componentModules)) {
        const name = path.split('/').pop()?.replace('.vue', '')
        if (!name) continue
        try {
            const mod: any = await importer()
            result[name] = mod.default || mod
        } catch (e) {
            console.warn(`[ModuleCompiler] Failed to load component: ${name}`)
        }
    }
    loadedComponents = result
    return result
}

// ======================================================
// Глобальные composables (будут установлены извне)
// ======================================================
let globalComposables: Record<string, Function> | null = null

export function setGlobalComposables(composables: Record<string, Function>) {
    globalComposables = composables
}

// ======================================================
// Виртуальные модули
// ======================================================
function getVirtualModule(url: string): string | null {
    const normalized = url.replace(/^[@~]+\//, '').replace(/\\/g, '/')
    if (!globalComposables) return null

    const map: Record<string, string> = {
        'composables/useLogger': `export const useLogger = globalComposables.useLogger`,
        'composables/useNotifications': `export const useNotifications = globalComposables.useNotifications`,
        'composables/useWindowManager': `export const useWindowManager = globalComposables.useWindowManager`,
        'stores/moduleStore': `export const useModulesStore = globalComposables.useModulesStore`,
    }

    return map[normalized] || null
}

// ======================================================
// Глобальные объявления, вставляемые в <script setup>
// ======================================================
const GLOBAL_DECLARATIONS = `
// Автоматически предоставленные composables
var useLogger = window.__moduleComposables?.useLogger
var useNotifications = window.__moduleComposables?.useNotifications
var useWindowManager = window.__moduleComposables?.useWindowManager
var useModulesStore = window.__moduleComposables?.useModulesStore
`.trim()

// ======================================================
// TS → JS
// ======================================================
function transpileTypeScript(code: string): string {
    try {
        const result = Babel.transform(code, {
            presets: [['typescript', { allExtensions: true }]],
            filename: 'module.ts',
            configFile: false,
            babelrc: false,
        })
        return result.code || code
    } catch (e) {
        console.warn('[ModuleCompiler] TS transpile failed:', e)
        return code
    }
}

// ======================================================
// Очистка локального файла (убираем import/export)
// ======================================================
function cleanModuleCode(code: string): string {
    return code
        .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
        .replace(/import\s+['"].*?['"];?\s*/g, '')
        .replace(/export\s+default\s+/g, '')
        .replace(/export\s*\{[^}]*\}/g, '')
        .replace(/export\s+(const|let|var|function|class|async\s+function)\s+/g, '$1 ')
        .trim()
    // больше не заменяем composables – они будут доступны через глобальные переменные
}

// ======================================================
// Встраивание локальных файлов
// ======================================================
function inlineLocalFiles(mainCode: string, localFiles: Map<string, string>) {
    return mainCode.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"](\.\/[^'"]+)['"];?\s*/g,
        (match, imports, path) => {
            const cleanPath = path.replace(/^\.\//, '')
            let code =
                localFiles.get(cleanPath) ||
                localFiles.get(cleanPath + '.js') ||
                localFiles.get(cleanPath + '.ts') ||
                localFiles.get(cleanPath + '.vue')
            if (!code) {
                for (const [key, value] of localFiles) {
                    if (key.replace(/\.(js|ts|vue)$/, '') === cleanPath) {
                        code = value
                        break
                    }
                }
            }
            if (!code) return match
            return `\n// INLINED: ${path}\n${code}\n`
        }
    )
}

// ======================================================
// COMPOSABLE
// ======================================================
export const useModuleCompiler = () => {
    const compiledComponent = shallowRef<any>(null)
    const compiling = ref(false)
    const compileError = ref<string | null>(null)
    const activeKey = ref(0)

    async function compileModule(
        code: string,
        filesList: any[] = [],
        dependencies: Record<string, string> = {},
        moduleId?: string
    ) {
        if (!code?.trim()) {
            compileError.value = 'Нет кода'
            compiledComponent.value = null
            return
        }

        if (!globalComposables) {
            compileError.value = 'Composables не установлены. Вызовите setGlobalComposables()'
            compiledComponent.value = null
            return
        }

        compiling.value = true
        compileError.value = null

        try {
            const registry = await loadAllComponents()

                // Сохраняем реальные composables в window, чтобы виртуальные модули и GLOBAL_DECLARATIONS их видели
            ;(window as any).__moduleComposables = globalComposables

            const localFiles = new Map<string, string>()

            for (const file of filesList || []) {
                if (file.isServerFile) continue

                let filePath = (file.path || file.name || '')
                    .replace(/^\.\//, '')
                    .replace(/\\/g, '/')
                if (!filePath) continue
                if (!filePath.includes('.')) {
                    filePath += '.' + (file.format || 'vue')
                }

                let fileCode = file.code || ''

                if (filePath.endsWith('.ts')) {
                    fileCode = transpileTypeScript(fileCode)
                }

                if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
                    fileCode = cleanModuleCode(fileCode)
                }

                localFiles.set(filePath, fileCode)
                const shortName = filePath.split('/').pop()!
                localFiles.set(shortName, fileCode)
                const withoutExt = filePath.replace(/\.(js|ts|vue)$/, '')
                localFiles.set(withoutExt, fileCode)
            }

            let mainCode = code.trimStart()
            const isSFC = mainCode.startsWith('<') || mainCode.includes('<script')

            if (!isSFC) {
                mainCode = inlineLocalFiles(mainCode, localFiles)
                mainCode = `<script setup>\n${GLOBAL_DECLARATIONS}\n\n${mainCode}\n</script>\n<template><div></div></template>`
            } else {
                mainCode = mainCode.replace(
                    /<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/,
                    (match, scriptContent) => {
                        const inlined = inlineLocalFiles(scriptContent, localFiles)
                        return `<script setup>\n${GLOBAL_DECLARATIONS}\n\n${inlined}\n</script>`
                    }
                )
            }

            const files: Record<string, string> = { 'dynamic.vue': mainCode }

            const options: any = {
                moduleCache: { vue: Vue },
                compiler,
                async getFile(url: any) {
                    if (typeof url !== 'string') url = url?.url || String(url)
                    const normalized = url
                        .replace(/^[@~]+\//, '')
                        .replace(/^\.\//, '')
                        .replace(/\\/g, '/')
                        .split('?')[0]

                    const virtual = getVirtualModule(normalized)
                    if (virtual) {
                        // Передаём globalComposables в область видимости виртуального модуля
                        return `const globalComposables = window.__moduleComposables;\n${virtual}`
                    }

                    if (files[normalized]) return files[normalized]
                    if (files[normalized + '.vue']) return files[normalized + '.vue']

                    const pkg = normalized.split('/')[0]
                    if (dependencies[pkg]) return `export default {}`

                    throw new Error('[ModuleCompiler] Module not found: ' + normalized)
                },
                addStyle(textContent: string) {
                    const id = 'dynamic-module-style-' + (moduleId || 'default')
                    let style = document.getElementById(id) as HTMLStyleElement | null
                    if (!style) {
                        style = document.createElement('style')
                        style.id = id
                        document.head.appendChild(style)
                    }
                    style.textContent = textContent
                },
            }

            const mod: any = await loadModule('dynamic.vue', options)
            const component = mod.default || mod

            component.components = {
                ...(component.components || {}),
                ...registry,
            }

            component.props = {
                ...(component.props || {}),
                moduleId: { type: String, default: moduleId || '' },
            }

            compiledComponent.value = markRaw(component)
            activeKey.value++
        } catch (e: any) {
            console.error('[ModuleCompiler ERROR]', e)
            compileError.value = e?.message || 'Ошибка компиляции'
            compiledComponent.value = null
        } finally {
            compiling.value = false
        }
    }

    function reset() {
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
        activeKey,
    }
}