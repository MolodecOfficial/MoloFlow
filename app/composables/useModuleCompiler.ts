// composables/useModuleCompiler.ts
import * as Vue from 'vue'
import { markRaw, ref, shallowRef } from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'
import * as Babel from '@babel/standalone'

// ======================================================
// Типы
// ======================================================
type ComposableFunction = (...args: any[]) => any

// ======================================================
// Загрузка компонентов проекта
// ======================================================
const componentModules = import.meta.glob('~/components/**/*.vue')
let loadedComponents: Record<string, any> | null = null

async function loadAllComponents(): Promise<Record<string, any>> {
    if (loadedComponents) return loadedComponents
    const result: Record<string, any> = {}
    const entries = Object.entries(componentModules)
    const promises = entries.map(async ([path, importer]) => {
        try {
            const name = path.split('/').pop()?.replace('.vue', '')
            if (!name) return
            const mod: any = await importer()
            const component = mod.default || mod
            result[name] = component
            result[name.toLowerCase()] = component
            const pascalName = name.charAt(0).toUpperCase() + name.slice(1)
            if (pascalName !== name) result[pascalName] = component
            const camelName = name.charAt(0).toLowerCase() + name.slice(1)
            if (camelName !== name) result[camelName] = component
        } catch (e) {
            console.warn(`[ModuleCompiler] Failed to load component: ${path}`, e)
        }
    })
    await Promise.allSettled(promises)
    loadedComponents = result
    return result
}

// ======================================================
// Глобальные composables
// ======================================================
let globalComposables: Record<string, ComposableFunction> | null = null

export function setGlobalComposables(composables: Record<string, ComposableFunction>) {
    globalComposables = composables
    ;(window as any).__moduleComposables = composables
}

// ======================================================
// Виртуальные модули
// ======================================================
const VIRTUAL_MODULES: Record<string, string[]> = {
    'composables/useLogger': ['useLogger'],
    'composables/useNotifications': ['useNotifications'],
    'composables/useWindowManager': ['useWindowManager'],
    'stores/moduleStore': ['useModulesStore'],
}

function getVirtualModule(url: string): string | null {
    const normalized = normalizePath(url)
    if (VIRTUAL_MODULES[normalized]) {
        const exports = VIRTUAL_MODULES[normalized]
        const lines = exports.map(exp =>
            `export const ${exp} = window.__moduleComposables?.${exp}`
        )
        return lines.join('\n')
    }
    return null
}

function normalizePath(path: string): string {
    return path.replace(/^[@~]+\//, '').replace(/^\.\//, '').replace(/\\/g, '/').replace(/\/+/g, '/').split('?')[0].trim()
}

// ======================================================
// TS → JS
// ======================================================
function transpileTypeScript(code: string): string {
    try {
        const result = Babel.transform(code, {
            presets: [['typescript', { allExtensions: true, isTSX: false }]],
            filename: 'file.ts',
            configFile: false,
            babelrc: false,
        })
        return result?.code || code
    } catch (e: any) {
        console.warn('[ModuleCompiler] TS transpile warning:', e.message)
        return code
    }
}

// ======================================================
// 🔥 КЛЮЧЕВОЕ: Компиляция Vue компонента через vue3-sfc-loader
// ======================================================
async function compileVueComponentFromSource(
    code: string,
    fileName: string,
    moduleId: string
): Promise<any> {
    try {
        const files: Record<string, string> = {
            [fileName]: code
        }

        const options: any = {
            moduleCache: { vue: Vue },
            compiler,
            async getFile(url: any) {
                const normalized = normalizePath(typeof url === 'string' ? url : url?.url || '')
                if (files[normalized]) return files[normalized]
                throw new Error(`File not found: ${normalized}`)
            },
            addStyle() {}, // Стили уже обрабатываются основным модулем
        }

        const mod: any = await loadModule(fileName, options)
        return markRaw(mod.default || mod)
    } catch (e) {
        console.error(`[ModuleCompiler] Failed to compile Vue component ${fileName}:`, e)
        return null
    }
}

// ======================================================
// 🔥 КЛЮЧЕВОЕ: Обработка JS/TS модулей - СОХРАНЯЕМ ЭКСПОРТЫ
// ======================================================
function processJSModule(code: string, isTypeScript: boolean): string {
    // Транспилируем TS если нужно
    if (isTypeScript) {
        code = transpileTypeScript(code)
    }

    // Убираем import-ы
    code = code.replace(/import\s+.*?from\s*['"].*?['"]\s*;?/g, '')
    code = code.replace(/import\s*['"].*?['"]\s*;?/g, '')

    // Заменяем export на присваивание в exports
    code = code.replace(/export\s+default\s+/g, 'module.exports.default = ')
    code = code.replace(/export\s+function\s+(\w+)/g, 'exports.$1 = function')
    code = code.replace(/export\s+const\s+(\w+)\s*=/g, 'exports.$1 =')
    code = code.replace(/export\s+let\s+(\w+)\s*=/g, 'exports.$1 =')
    code = code.replace(/export\s+var\s+(\w+)\s*=/g, 'exports.$1 =')
    code = code.replace(/export\s+class\s+(\w+)/g, 'exports.$1 = class')
    code = code.replace(/export\s+async\s+function\s+(\w+)/g, 'exports.$1 = async function')
    code = code.replace(/export\s*\{([^}]*)\}/g, (match, names) => {
        const exports = names.split(',').map((n: string) => {
            const parts = n.trim().split(/\s+as\s+/)
            const original = parts[0].trim()
            const alias = parts[1]?.trim() || original
            return `exports.${alias} = ${original};`
        })
        return exports.join('\n')
    })

    return code
}

// ======================================================
// 🔥 ПОИСК ФАЙЛОВ
// ======================================================
function findFileData(importPath: string, localFiles: Map<string, any>): any | null {
    // Очищаем путь
    let cleanPath = importPath
        .replace(/^\.\//, '')
        .replace(/^\.\.\//, '')
        .replace(/\\/g, '/')
        .trim()

    // Убираем возможные расширения для поиска
    const extensions = ['.vue', '.ts', '.js']
    const hasExtension = extensions.some(ext => cleanPath.endsWith(ext))

    // Прямой поиск
    if (localFiles.has(cleanPath)) return localFiles.get(cleanPath)

    // Поиск с разными расширениями
    if (!hasExtension) {
        for (const ext of extensions) {
            if (localFiles.has(cleanPath + ext)) return localFiles.get(cleanPath + ext)
        }
    }

    // Поиск по имени файла
    const fileName = cleanPath.split('/').pop() || cleanPath
    const fileNameWithoutExt = fileName.replace(/\.(vue|ts|js)$/, '')

    for (const [key, value] of localFiles) {
        const keyFileName = key.split('/').pop() || key
        const keyWithoutExt = keyFileName.replace(/\.(vue|ts|js)$/, '')

        if (keyFileName === fileName || keyWithoutExt === fileNameWithoutExt) {
            return value
        }

        if (key.endsWith('/' + fileName) || key.endsWith('/' + fileNameWithoutExt)) {
            return value
        }
    }

    return null
}

// ======================================================
// 🔥 ГЛАВНАЯ ФУНКЦИЯ: Обработка импортов в script
// ======================================================
async function processImports(
    scriptContent: string,
    localFiles: Map<string, any>,
    moduleId: string
): Promise<{ inlinedCode: string, dynamicComponents: Record<string, any> }> {

    const dynamicComponents: Record<string, any> = {}
    let processedCode = scriptContent

    // 1. Импорт Vue компонентов: import X from './file.vue'
    const vueImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]\s*;?/g
    const vueMatches = [...processedCode.matchAll(vueImportRegex)]

    for (const match of vueMatches) {
        const [fullMatch, importName, importPath] = match
        console.log(`[ModuleCompiler] 🔵 Compiling Vue component: ${importName} from ${importPath}`)

        const fileData = findFileData(importPath, localFiles)
        if (fileData) {
            const compiled = await compileVueComponentFromSource(
                fileData.code,
                importPath.replace(/^\.\//, ''),
                moduleId
            )
            if (compiled) {
                dynamicComponents[importName] = compiled
                // Заменяем import на комментарий
                processedCode = processedCode.replace(fullMatch, `/* Component ${importName} registered */`)
                console.log(`[ModuleCompiler] ✅ Vue component compiled: ${importName}`)
            } else {
                processedCode = processedCode.replace(fullMatch, `/* FAILED: ${importName} */`)
            }
        } else {
            console.warn(`[ModuleCompiler] ❌ Vue component not found: ${importPath}`)
            processedCode = processedCode.replace(fullMatch, `/* NOT FOUND: ${importPath} */`)
        }
    }

    // 2. Именованный импорт из JS/TS: import { x, y } from './file.ts'
    const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+\.(?:ts|js))['"]\s*;?/g
    const namedMatches = [...processedCode.matchAll(namedImportRegex)]

    for (const match of namedMatches) {
        const [fullMatch, names, importPath] = match
        console.log(`[ModuleCompiler] 🟡 Inlining named imports: {${names}} from ${importPath}`)

        const fileData = findFileData(importPath, localFiles)
        if (fileData) {
            const isTypeScript = importPath.endsWith('.ts')
            const processedCode2 = processJSModule(fileData.code, isTypeScript)

            // Извлекаем имена
            const cleanNames = names.split(',').map((n: string) => n.trim()).filter(Boolean)
            const destructured = cleanNames.join(', ')

            const replacement = `
/* INLINED: ${importPath} */
const {${destructured}} = (function() {
  const exports = {};
  ${processedCode2}
  return exports;
})();
`
            processedCode = processedCode.replace(fullMatch, replacement)
            console.log(`[ModuleCompiler] ✅ Inlined: ${importPath}`)
        } else {
            console.warn(`[ModuleCompiler] ❌ Module not found: ${importPath}`)
            processedCode = processedCode.replace(fullMatch, `/* NOT FOUND: ${importPath} */`)
        }
    }

    // 3. Default импорт из JS/TS: import X from './file.ts'
    const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+\.(?:ts|js))['"]\s*;?/g
    const defaultMatches = [...processedCode.matchAll(defaultImportRegex)]

    for (const match of defaultMatches) {
        const [fullMatch, importName, importPath] = match
        console.log(`[ModuleCompiler] 🟢 Inlining default import: ${importName} from ${importPath}`)

        const fileData = findFileData(importPath, localFiles)
        if (fileData) {
            const isTypeScript = importPath.endsWith('.ts')
            const processedCode2 = processJSModule(fileData.code, isTypeScript)

            const replacement = `
/* INLINED: ${importPath} */
const ${importName} = (function() {
  const exports = {};
  const module = { exports };
  ${processedCode2}
  return module.exports.default || module.exports || exports;
})();
`
            processedCode = processedCode.replace(fullMatch, replacement)
            console.log(`[ModuleCompiler] ✅ Inlined: ${importPath}`)
        } else {
            console.warn(`[ModuleCompiler] ❌ Module not found: ${importPath}`)
            processedCode = processedCode.replace(fullMatch, `/* NOT FOUND: ${importPath} */`)
        }
    }

    return { inlinedCode: processedCode, dynamicComponents }
}

// ======================================================
// Подготовка SFC
// ======================================================
async function prepareSFC(
    code: string,
    localFiles: Map<string, any>,
    moduleId: string
): Promise<{ sfc: string, dynamicComponents: Record<string, any> }> {

    if (code.includes('<script')) {
        const scriptRegex = /<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/
        const scriptMatch = code.match(scriptRegex)

        if (scriptMatch) {
            const scriptContent = scriptMatch[1]
            const { inlinedCode, dynamicComponents } = await processImports(scriptContent, localFiles, moduleId)

            const declarations = globalComposables
                ? Object.keys(globalComposables).map(name => `var ${name} = window.__moduleComposables?.${name}`).join('\n')
                : ''

            const result = code.replace(scriptRegex, `<script setup>\n${declarations}\n\n${inlinedCode}\n</script>`)

            return { sfc: result, dynamicComponents }
        }
    }

    return { sfc: code, dynamicComponents: {} }
}

// ======================================================
// Стили
// ======================================================
function createStyleManager(moduleId: string) {
    const styleId = `dynamic-module-style-${moduleId}`
    return {
        addStyle(textContent: string) {
            if (typeof document === 'undefined') return
            let el = document.getElementById(styleId) as HTMLStyleElement
            if (!el) {
                el = document.createElement('style')
                el.id = styleId
                el.setAttribute('data-module-id', moduleId)
                document.head.appendChild(el)
            }
            el.textContent = textContent
        },
        removeStyle() {
            const el = document.getElementById(styleId)
            if (el) el.remove()
        }
    }
}

// ======================================================
// ОСНОВНОЙ COMPOSABLE
// ======================================================
export const useModuleCompiler = () => {
    const compiledComponent = shallowRef<any>(null)
    const compiling = ref(false)
    const compileError = ref<string | null>(null)
    const activeKey = ref(0)
    const lastModuleId = ref<string | null>(null)
    let styleManager: ReturnType<typeof createStyleManager> | null = null

    async function compileModule(
        code: string,
        filesList: any[] = [],
        dependencies: Record<string, string> = {},
        moduleId?: string
    ) {
        if (!code?.trim()) {
            compileError.value = 'No code provided'
            compiledComponent.value = null
            return
        }

        if (!globalComposables) {
            compileError.value = 'Composables not initialized'
            compiledComponent.value = null
            return
        }

        compiling.value = true
        compileError.value = null
        const id = moduleId || 'anon'

        if (lastModuleId.value && lastModuleId.value !== id) {
            reset()
        }
        lastModuleId.value = id

        try {
            const registry = await loadAllComponents()
            ;(window as any).__moduleComposables = globalComposables
            styleManager = createStyleManager(id)

            // Подготавливаем локальные файлы
            const localFiles = new Map<string, any>()

            for (const file of filesList || []) {
                if (file.isServerFile) continue

                let filePath = file.path || `${file.name}.${file.format || 'vue'}`
                filePath = normalizePath(filePath)
                if (!filePath) continue

                if (!filePath.match(/\.(vue|js|ts)$/)) {
                    filePath += '.' + (file.format || 'vue')
                }

                const fileCode = file.code || ''

                localFiles.set(filePath, { code: fileCode, path: filePath, format: file.format })

                const fileName = filePath.split('/').pop() || filePath
                localFiles.set(fileName, { code: fileCode, path: filePath, format: file.format })

                const withoutExt = filePath.replace(/\.(vue|js|ts)$/, '')
                localFiles.set(withoutExt, { code: fileCode, path: filePath, format: file.format })
            }

            // Подготавливаем SFC
            const { sfc, dynamicComponents } = await prepareSFC(code, localFiles, id)

            // Файловая система для vue3-sfc-loader
            const files: Record<string, string> = { 'dynamic.vue': sfc }

            const options: any = {
                moduleCache: { vue: Vue },
                compiler,
                async getFile(url: any) {
                    const normalized = normalizePath(typeof url === 'string' ? url : url?.url || '')

                    const virtual = getVirtualModule(normalized)
                    if (virtual) return virtual

                    if (files[normalized]) return files[normalized]

                    const pkg = normalized.split('/')[0]
                    if (dependencies[pkg]) return `export default {}`

                    throw new Error(`Module not found: ${normalized}`)
                },
                addStyle(textContent: string) {
                    styleManager?.addStyle(textContent)
                },
            }

            // Компилируем
            const mod: any = await loadModule('dynamic.vue', options)
            const component = markRaw(mod.default || mod)

            // Регистрируем ВСЕ компоненты
            component.components = {
                ...(component.components || {}),
                ...registry,
                ...dynamicComponents,
            }

            component.props = {
                ...(component.props || {}),
                moduleId: { type: String, default: id },
            }

            compiledComponent.value = component
            activeKey.value++

            console.log(`[ModuleCompiler] ✅ Compiled: ${id}, components:`, Object.keys(dynamicComponents))

        } catch (e: any) {
            console.error('[ModuleCompiler] Error:', e)
            compileError.value = e?.message || 'Compilation failed'
            compiledComponent.value = null
            styleManager?.removeStyle()
        } finally {
            compiling.value = false
        }
    }

    function reset() {
        compiledComponent.value = null
        compileError.value = null
        activeKey.value++
        lastModuleId.value = null
        styleManager?.removeStyle()
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