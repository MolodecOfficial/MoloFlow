// composables/useModuleCompiler.ts
import * as Vue from 'vue'
import { markRaw, ref, shallowRef } from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'
import * as Babel from '@babel/standalone'
import presetTypeScript from '@babel/preset-typescript'

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

function parseCompilationError(error: any, code?: string): {
    message: string;
    stack: string;
    line: number | null;
    column: number | null;
    fileName: string;
    codeContext: string;
} {
    const message = error?.message || 'Compilation failed'
    const stack = error?.stack || ''

    let line: number | null = null
    let column: number | null = null
    let fileName = 'dynamic.vue'

    // 1. Парсим ошибку vue/compiler-sfc
    const sfcMatch = message.match(/\((\d+):(\d+)\)/)
    if (sfcMatch) {
        line = parseInt(sfcMatch[1])
        column = parseInt(sfcMatch[2])
    }

    // 2. Парсим ошибку Babel
    if (!line) {
        const babelMatch = message.match(/\((\d+):(\d+)\)/)
        if (babelMatch) {
            line = parseInt(babelMatch[1])
            column = parseInt(babelMatch[2])
        }
    }

    // 3. Парсим ошибку из стека
    if (!line) {
        const stackLineMatch = stack.match(/:(\d+):(\d+)/)
        if (stackLineMatch) {
            line = parseInt(stackLineMatch[1])
            column = parseInt(stackLineMatch[2])
        }
    }

    // 4. Парсим TypeScript ошибки
    if (!line) {
        const tsMatch = message.match(/line\s+(\d+)/i)
        if (tsMatch) {
            line = parseInt(tsMatch[1])
        }
    }

    // 5. Извлекаем имя файла
    const fileMatch = message.match(/at\s+([^\s]+\.vue)/)
    if (fileMatch) {
        fileName = fileMatch[1]
    }

    if (!fileMatch && stack) {
        const stackFileMatch = stack.match(/at\s+([^\s]+\.vue)/)
        if (stackFileMatch) {
            fileName = stackFileMatch[1]
        }
    }

    // 6. Извлекаем контекст кода
    let codeContext = ''
    if (line && code) {
        const lines = code.split('\n')
        const start = Math.max(0, line - 5)
        const end = Math.min(lines.length, line + 3)
        const maxLineNum = String(end).length

        codeContext = lines.slice(start, end).map((l, i) => {
            const num = start + i + 1
            const isErrorLine = num === line
            const marker = isErrorLine ? '▶' : ' '
            const lineNum = String(num).padStart(maxLineNum, ' ')
            return `${marker} ${lineNum} │ ${l}`
        }).join('\n')

        // Добавляем указатель на ошибку ТОЛЬКО если есть column
        if (column) {
            const lineContent = lines[line - 1] || ''
            // Ограничиваем column длиной строки
            const safeColumn = Math.min(column - 1, lineContent.length)
            const prefixLen = maxLineNum + 4
            const pointerLine = ' '.repeat(prefixLen + safeColumn) + '^'
            codeContext += '\n' + pointerLine
        }
    }

    // 7. Формируем понятное сообщение
    let cleanMessage = message
    if (cleanMessage.includes('at ')) {
        cleanMessage = cleanMessage.split('at ')[0].trim()
    }
    cleanMessage = cleanMessage.replace(/\(\d+:\d+\)/, '').trim()

    return {
        message: cleanMessage || message,
        stack,
        line,
        column,
        fileName,
        codeContext
    }
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
    'stores/appStore': ['useAppStore']
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
// 🔥 ТРАНСПИЛЯЦИЯ TypeScript в JavaScript для SFC
// ======================================================
function transpileTypeScriptSFC(code: string): string {
    try {
        // Транспилируем TypeScript в JavaScript
        const result = Babel.transform(code, {
            presets: [
                [presetTypeScript, {
                    allExtensions: true,
                    isTSX: false,
                    allowNamespaces: true,
                    allowDeclareFields: true
                }]
            ],
            filename: 'script.ts',
            configFile: false,
            babelrc: false,
            parserOpts: {
                plugins: ['typescript', 'jsx']
            }
        })
        return result?.code || code
    } catch (e: any) {
        console.warn('[ModuleCompiler] TypeScript transpilation error:', e.message)
        // Возвращаем исходный код, если транспиляция не удалась
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
        // Транспилируем TypeScript если это .vue файл с TS
        let processedCode = code
        if (fileName.endsWith('.vue') && code.includes('lang="ts"')) {
            // Извлекаем script с type="ts" и транспилируем
            const scriptRegex = /<script[^>]*lang="ts"[^>]*>([\s\S]*?)<\/script>/
            const match = code.match(scriptRegex)
            if (match) {
                const transpiled = transpileTypeScriptSFC(match[1])
                processedCode = code.replace(scriptRegex, `<script setup>\n${transpiled}\n</script>`)
            }
        }

        const files: Record<string, string> = {
            [fileName]: processedCode
        }

        const options: any = {
            moduleCache: { vue: Vue },
            compiler,
            async getFile(url: any) {
                const normalized = normalizePath(typeof url === 'string' ? url : url?.url || '')
                if (files[normalized]) return files[normalized]
                throw new Error(`File not found: ${normalized}`)
            },
            addStyle() {},
        }

        const mod: any = await loadModule(fileName, options)
        return markRaw(mod.default || mod)
    } catch (e) {
        console.warn('[ModuleCompiler] Failed to compile Vue component:', e)
        return null
    }
}

// ======================================================
// 🔥 КЛЮЧЕВОЕ: Обработка JS/TS модулей - СОХРАНЯЕМ ЭКСПОРТЫ
// ======================================================
function processJSModule(code: string, isTypeScript: boolean): string {
    // Транспилируем TS если нужно
    if (isTypeScript) {
        code = transpileTypeScriptSFC(code)
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

        const fileData = findFileData(importPath, localFiles)
        if (fileData) {
            const compiled = await compileVueComponentFromSource(
                fileData.code,
                importPath.replace(/^\.\//, ''),
                moduleId
            )
            if (compiled) {
                dynamicComponents[importName] = compiled
                processedCode = processedCode.replace(fullMatch, `/* Component ${importName} registered */`)
            } else {
                processedCode = processedCode.replace(fullMatch, `/* FAILED: ${importName} */`)
            }
        } else {
            processedCode = processedCode.replace(fullMatch, `/* NOT FOUND: ${importPath} */`)
        }
    }

    // 2. Именованный импорт из JS/TS: import { x, y } from './file.ts'
    const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+\.(?:ts|js))['"]\s*;?/g
    const namedMatches = [...processedCode.matchAll(namedImportRegex)]

    for (const match of namedMatches) {
        const [fullMatch, names, importPath] = match

        const fileData = findFileData(importPath, localFiles)
        if (fileData) {
            const isTypeScript = importPath.endsWith('.ts')
            const processedCode2 = processJSModule(fileData.code, isTypeScript)

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
        } else {
            processedCode = processedCode.replace(fullMatch, `/* NOT FOUND: ${importPath} */`)
        }
    }

    // 3. Default импорт из JS/TS: import X from './file.ts'
    const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+\.(?:ts|js))['"]\s*;?/g
    const defaultMatches = [...processedCode.matchAll(defaultImportRegex)]

    for (const match of defaultMatches) {
        const [fullMatch, importName, importPath] = match

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
        } else {
            processedCode = processedCode.replace(fullMatch, `/* NOT FOUND: ${importPath} */`)
        }
    }

    return { inlinedCode: processedCode, dynamicComponents }
}

// ======================================================
// 🔥 ОСНОВНАЯ ФУНКЦИЯ: Подготовка SFC с поддержкой TypeScript
// ======================================================
async function prepareSFC(
    code: string,
    localFiles: Map<string, any>,
    moduleId: string
): Promise<{ sfc: string, dynamicComponents: Record<string, any> }> {

    // Проверяем наличие TypeScript в script
    let processedCode = code

    // Если есть script с lang="ts", транспилируем его
    const tsScriptRegex = /<script[^>]*lang="ts"[^>]*>([\s\S]*?)<\/script>/
    const tsMatch = processedCode.match(tsScriptRegex)
    if (tsMatch) {
        const transpiled = transpileTypeScriptSFC(tsMatch[1])
        processedCode = processedCode.replace(tsScriptRegex, `<script setup>\n${transpiled}\n</script>`)
    }

    if (processedCode.includes('<script')) {
        const scriptRegex = /<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/
        const scriptMatch = processedCode.match(scriptRegex)

        if (scriptMatch) {
            const scriptContent = scriptMatch[1]
            const { inlinedCode, dynamicComponents } = await processImports(scriptContent, localFiles, moduleId)

            const declarations = globalComposables
                ? Object.keys(globalComposables).map(name => `var ${name} = window.__moduleComposables?.${name}`).join('\n')
                : ''

            const result = processedCode.replace(scriptRegex, `<script setup>\n${declarations}\n\n${inlinedCode}\n</script>`)

            return { sfc: result, dynamicComponents }
        }
    }

    return { sfc: processedCode, dynamicComponents: {} }
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
    const compileErrorDetails = ref<any>(null) // <-- ДОБАВЛЯЕМ
    const activeKey = ref(0)
    const lastModuleId = ref<string | null>(null)
    let styleManager: ReturnType<typeof createStyleManager> | null = null

    async function compileModule(
        code: string,
        filesList: any[] = [],
        dependencies: Record<string, string> = {},
        moduleId?: string
    ) {
        compileError.value = null
        compileErrorDetails.value = null
        compiledComponent.value = null

        if (!code?.trim()) {
            compileError.value = 'No code provided'
            compileErrorDetails.value = {
                message: 'No code provided',
                stack: '',
                line: null,
                column: null,
                fileName: 'dynamic.vue',
                codeContext: ''
            }
            return
        }

        if (!globalComposables) {
            compileError.value = 'Composables not initialized'
            compileErrorDetails.value = {
                message: 'Composables not initialized',
                stack: '',
                line: null,
                column: null,
                fileName: 'dynamic.vue',
                codeContext: ''
            }
            return
        }

        compiling.value = true
        const id = moduleId || 'anon'

        const TIMEOUT_MS = 15000
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    const timeoutError = new Error(`Compilation timeout after ${TIMEOUT_MS}ms`)
                    timeoutError.name = 'TimeoutError'
                    reject(timeoutError)
                }, TIMEOUT_MS)
            })

            const compilePromise = (async () => {
                if (lastModuleId.value && lastModuleId.value !== id) {
                    reset()
                }
                lastModuleId.value = id

                const registry = await loadAllComponents()
                ;(window as any).__moduleComposables = globalComposables
                styleManager = createStyleManager(id)

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

                const { sfc, dynamicComponents } = await prepareSFC(code, localFiles, id)

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

                const mod: any = await loadModule('dynamic.vue', options)
                const component = markRaw(mod.default || mod)

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
                compileError.value = null
                compileErrorDetails.value = null
            })()

            await Promise.race([compilePromise, timeoutPromise])

        } catch (e: any) {
            console.error('[ModuleCompiler] Error:', e)

            // Используем функцию парсинга ошибок
            const parsed = parseCompilationError(e, code)

            compileError.value = parsed.message
            compileErrorDetails.value = parsed
            compiledComponent.value = null
            styleManager?.removeStyle()
        } finally {
            compiling.value = false
            if (timeoutId) clearTimeout(timeoutId)
        }
    }

    function reset() {
        compiledComponent.value = null
        compileError.value = null
        compileErrorDetails.value = null
        activeKey.value++
        lastModuleId.value = null
        styleManager?.removeStyle()
    }

    return {
        compiledComponent,
        compiling,
        compileError,
        compileErrorDetails, // <-- ЭКСПОРТИРУЕМ
        compileModule,
        reset,
        activeKey,
    }
}