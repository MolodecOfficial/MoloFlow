// composables/useModuleCompiler.ts
import { ref, shallowRef, markRaw } from 'vue'
import * as Vue from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'

// Глобальные инжекции
const injections = {
    useLogger: (...args: any[]) => (window as any).useLogger?.(...args),
    useNotifications: (...args: any[]) => (window as any).useNotifications?.(...args),
    useWindowManager: (...args: any[]) => (window as any).useWindowManager?.(...args),
    useModulesStore: (...args: any[]) => (window as any).useModulesStore?.(...args),
}

const componentModules = import.meta.glob('~/components/**/*.vue')
let loadedComponents: Record<string, any> | null = null

async function loadAllComponents() {
    if (loadedComponents) return loadedComponents
    const result: Record<string, any> = {}
    for (const [path, importer] of Object.entries(componentModules)) {
        const name = path.split('/').pop()?.replace('.vue', '')
        if (!name) continue
        const mod: any = await importer()
        result[name] = mod.default || mod
    }
    loadedComponents = result
    return result
}

function getVirtualModule(url: string): string | null {
    const normalized = url.replace(/^[@~]+\//, '').replace(/\\/g, '/')
    if (normalized === 'composables/useLogger') return `export const useLogger = window.__injections.useLogger`
    if (normalized === 'composables/useNotifications') return `export const useNotifications = window.__injections.useNotifications`
    if (normalized === 'composables/useWindowManager') return `export const useWindowManager = window.__injections.useWindowManager`
    if (normalized === 'stores/moduleStore') return `export const useModulesStore = window.__injections.useModulesStore`
    return null
}

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
        if (!code || !String(code).trim()) {
            compileError.value = 'Нет кода'
            compiledComponent.value = null
            return
        }

        compiling.value = true
        compileError.value = null

        try {
            if (typeof window !== 'undefined') {
                (window as any).__injections = injections
            }

            const registry = await loadAllComponents()

            const files: Record<string, string> = {
                'dynamic.vue': code,
            }

            // Собираем JS/TS модули и добавляем их как .vue файлы
            for (const file of filesList || []) {
                if (file.isServerFile) continue
                let filePath = (file.path || file.name || '').replace(/^\.\//, '').replace(/\\/g, '/')
                if (!filePath) continue
                if (!filePath.includes('.')) filePath += '.' + (file.format || 'vue')

                const content = file.code || ''

                // Для JS/TS файлов оборачиваем в Vue SFC
                if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
                    // Сохраняем как есть
                    files[filePath] = content
                    // И как .vue обёртку
                    const vuePath = filePath.replace(/\.(js|ts)$/, '.vue')
                    files[vuePath] = `<script setup>\n${content.replace(/export\s+/g, '')}\n</script>\n<template><div></div></template>`
                } else {
                    files[filePath] = content
                }

                // Короткое имя
                const shortName = filePath.split('/').pop()!
                files[shortName] = content
            }

            const options: any = {
                moduleCache: { vue: Vue },
                async getFile(url: string) {
                    let normalized = url.replace(/^[@~]+\//, '').replace(/\\/g, '/')

                    // Виртуальные модули
                    const virtual = getVirtualModule(normalized)
                    if (virtual) return virtual

                    // Пытаемся найти файл
                    const variants = [
                        normalized,
                        normalized + '.vue',
                        normalized + '.js',
                        normalized + '.ts',
                        normalized.replace(/\.(js|ts)$/, '.vue'),
                        normalized.split('/').pop() || '',
                    ]

                    for (const variant of variants) {
                        if (files[variant]) {
                            return files[variant]
                        }
                    }

                    // Заглушка для пакетов
                    const packageName = normalized.startsWith('@')
                        ? normalized.split('/').slice(0, 2).join('/')
                        : normalized.split('/')[0]
                    if (packageName && dependencies[packageName]) {
                        return `export default {};`
                    }

                    throw new Error('Файл не найден: ' + normalized)
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
                compiler,
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

    return { compiledComponent, compiling, compileError, compileModule, reset, activeKey }
}