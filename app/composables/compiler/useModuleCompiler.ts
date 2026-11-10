
import * as Vue from 'vue'
import { markRaw, ref, shallowRef } from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'
import * as Babel from '@babel/standalone'
import presetTypeScript from '@babel/preset-typescript'
import { useModuleCache, makeModuleSignature, type CompiledResult } from './useModuleCache'

type ComposableFunction = (...args: any[]) => any

// Зарезервированные HTML-теги, которые НЕЛЬЗЯ регистрировать как глобальные компоненты во Vue
const RESERVED_HTML_TAGS = new Set([
    'html', 'body', 'base', 'head', 'link', 'meta', 'style', 'title',
    'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hgroup', 'nav', 'section', 'div', 'dd', 'dl', 'dt', 'figcaption', 'figure', 'picture',
    'hr', 'img', 'li', 'main', 'ol', 'p', 'pre', 'ul', 'a', 'b', 'abbr', 'bdi', 'bdo', 'br',
    'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 'rp', 'rt', 'rtc', 'ruby',
    's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'area',
    'audio', 'map', 'track', 'video', 'embed', 'object', 'param', 'source', 'canvas', 'script',
    'noscript', 'del', 'ins', 'caption', 'col', 'colgroup', 'table', 'thead', 'tbody', 'td',
    'th', 'tr', 'button', 'datalist', 'fieldset', 'form', 'input', 'label', 'legend', 'meter',
    'optgroup', 'option', 'output', 'progress', 'select', 'textarea', 'details', 'dialog',
    'menu', 'summary', 'template'
])

// Кэш внешних загруженных npm-библиотек из CDN
const externalModulesCache = new Map<string, any>()

// ======================================================
// Загрузка компонентов проекта с защитой от зарезервированных тегов
// ======================================================
const componentModules = import.meta.glob('~/components/**/*.vue')
let loadedComponents: Record<string, any> | null = null

async function loadAllComponents(): Promise<Record<string, any>> {
    if (loadedComponents) return loadedComponents
    const result: Record<string, any> = {}
    const entries = Object.entries(componentModules)
    const promises = entries.map(async ([path, importer]) => {
        try {
            const rawName = path.split('/').pop()?.replace('.vue', '')
            if (!rawName) return
            const mod: any = await importer()
            const component = mod.default || mod

            const pascalName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
            const lowerName = rawName.toLowerCase()

            result[pascalName] = component
            if (!RESERVED_HTML_TAGS.has(lowerName)) {
                result[lowerName] = component
            }
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

    const sfcMatch = message.match(/\((\d+):(\d+)\)/)
    if (sfcMatch) {
        line = parseInt(sfcMatch[1])
        column = parseInt(sfcMatch[2])
    }

    if (!line) {
        const babelMatch = message.match(/\((\d+):(\d+)\)/)
        if (babelMatch) {
            line = parseInt(babelMatch[1])
            column = parseInt(babelMatch[2])
        }
    }

    if (!line) {
        const stackLineMatch = stack.match(/:(\d+):(\d+)/)
        if (stackLineMatch) {
            line = parseInt(stackLineMatch[1])
            column = parseInt(stackLineMatch[2])
        }
    }

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

        if (column) {
            const lineContent = lines[line - 1] || ''
            const safeColumn = Math.min(column - 1, lineContent.length)
            const prefixLen = maxLineNum + 4
            const pointerLine = ' '.repeat(prefixLen + safeColumn) + '^'
            codeContext += '\n' + pointerLine
        }
    }

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

let globalComposables: Record<string, ComposableFunction> | null = null

export function setGlobalComposables(composables: Record<string, ComposableFunction>) {
    globalComposables = composables
    ;(window as any).__moduleComposables = composables
}

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

// Загрузка реальных npm зависимостей через ESM CDN
async function loadExternalPackage(pkgName: string, version = 'latest'): Promise<any> {
    const cleanVersion = version && version !== '*' ? version : 'latest'
    const cacheKey = `${pkgName}@${cleanVersion}`
    if (externalModulesCache.has(cacheKey)) {
        return externalModulesCache.get(cacheKey)
    }

    try {
        const cdnUrl = `https://esm.sh/${pkgName}${cleanVersion !== 'latest' ? `@${cleanVersion}` : ''}?bundle`
        const mod: any = await import(/* @vite-ignore */ cdnUrl)

        let resolved = mod
        if (mod && mod.__esModule && mod.default !== undefined) {
            resolved = mod.default
        } else if (mod && mod.default !== undefined && (typeof mod.default === 'function' || Object.keys(mod).length === 1)) {
            resolved = mod.default
        }

        externalModulesCache.set(cacheKey, resolved)
        externalModulesCache.set(pkgName, resolved)
        return resolved
    } catch (e: any) {
        console.error(`[ModuleCompiler] Не удалось загрузить зависимость "${pkgName}":`, e)
        throw new Error(`Не удалось загрузить npm-пакет «${pkgName}». Проверьте интернет или имя пакета в зависимостях.`)
    }
}

function transpileTypeScriptSFC(code: string): string {
    try {
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
        return code
    }
}

// Получает реальное определение компонента из результата vue3-sfc-loader.
// В разных версиях загрузчика результат может быть модулем, Promise,
// defineAsyncComponent-обёрткой или объектом с внутренним promise.
async function extractComponentDefinition(raw: any): Promise<any> {
    let target = raw
    const visited = new Set<any>()

    for (let i = 0; i < 12 && target; i++) {
        if ((typeof target !== 'object' && typeof target !== 'function') || visited.has(target)) break
        visited.add(target)

        if (typeof target.then === 'function') {
            target = await target
            continue
        }

        // Vue defineAsyncComponent exposes __asyncLoader and may already
        // contain a resolved component in __asyncResolved.
        if (target.__asyncResolved) {
            target = target.__asyncResolved
            continue
        }
        if (typeof target.__asyncLoader === 'function') {
            target = await target.__asyncLoader()
            continue
        }

        // vue3-sfc-loader versions may expose their pending module as `promise`.
        if (target.promise && typeof target.promise.then === 'function') {
            target = await target.promise
            continue
        }

        // ES module namespace.
        if (target.default && target.default !== target) {
            target = target.default
            continue
        }

        break
    }

    return target
}

function isVueComponentDefinition(value: any): boolean {
    if (typeof value === 'function') return true
    if (!value || typeof value !== 'object') return false
    return Boolean(
        value.render || value.setup || value.template || value.__asyncLoader ||
        value.__asyncResolved || value.ssrRender
    )
}

function normalizeLocalPath(path: string): string {
    const parts: string[] = []
    for (const part of normalizePath(path).split('/')) {
        if (!part || part === '.') continue
        if (part === '..') parts.pop()
        else parts.push(part)
    }
    return parts.join('/')
}

function resolveLocalFile(importPath: string, importerPath: string, localFiles: Map<string, any>): any | null {
    const raw = importPath.replace(/\\/g, '/')
    const importerDir = importerPath.includes('/') ? importerPath.slice(0, importerPath.lastIndexOf('/')) : ''
    const base = raw.startsWith('.') ? normalizeLocalPath(`${importerDir}/${raw}`) : normalizeLocalPath(raw)
    const candidates = [base]
    if (!/\.(vue|ts|js)$/i.test(base)) {
        candidates.push(`${base}.vue`, `${base}.ts`, `${base}.js`, `${base}/index.vue`, `${base}/index.ts`, `${base}/index.js`)
    }
    for (const candidate of candidates) {
        if (localFiles.has(candidate)) return localFiles.get(candidate)
    }
    // Compatibility fallback for older modules that imported by basename.
    const basename = base.split('/').pop() || base
    const matches = [...localFiles.entries()].filter(([key]) => key === basename || key.endsWith(`/${basename}`))
    return matches.length === 1 ? matches[0][1] : null
}

async function compileVueComponentFromSource(
    code: string,
    fileName: string,
    moduleId: string,
    dependencies: Record<string, string> = {},
    onStyle?: (css: string) => void,
    localFiles?: Map<string, any>
): Promise<any> {
    try {
        let processedCode = code
        if (fileName.endsWith('.vue') && code.includes('lang="ts"')) {
            const scriptRegex = /<script[^>]*lang="ts"[^>]*>([\s\S]*?)<\/script>/
            const match = code.match(scriptRegex)
            if (match) {
                const transpiled = transpileTypeScriptSFC(match[1])
                processedCode = code.replace(scriptRegex, `<script setup>\n${transpiled}\n</script>`)
            }
        }

        const normalizedFileName = normalizeLocalPath(fileName)
        const files: Record<string, string> = { [normalizedFileName]: processedCode }
        for (const [path, data] of localFiles || []) {
            if (data?.code != null) files[normalizeLocalPath(path)] = data.code
        }

        const options: any = {
            moduleCache: { vue: Vue },
            compiler,
            async getFile(url: any) {
                const requested = normalizePath(typeof url === 'string' ? url : url?.url || '')
                const normalized = normalizeLocalPath(requested)
                if (files[normalized] != null) return files[normalized]
                const resolved = resolveLocalFile(requested, normalizedFileName, localFiles || new Map())
                if (resolved?.code != null) return resolved.code
                throw new Error(`Локальный файл «${requested}» не найден (импорт из «${normalizedFileName}»).` )
            },
            async handleModule(type: string, getContentData: any, path: string) {
                const pkg = path.split('/')[0]
                if (dependencies[pkg] || externalModulesCache.has(pkg)) {
                    return await loadExternalPackage(pkg, dependencies[pkg])
                }
            },
            addStyle(textContent: string) {
                onStyle?.(textContent)
            },
        }

        const rawMod = await loadModule(normalizedFileName, options)
        const component = await extractComponentDefinition(rawMod)
        if (!isVueComponentDefinition(component)) {
            throw new Error(`Файл «${normalizedFileName}» загружен, но не содержит корректного Vue-компонента (render/setup/template).`)
        }
        return markRaw(component)
    } catch (e: any) {
        console.error(`[ModuleCompiler] Ошибка компиляции ${fileName}:`, e)
        throw new Error(`Не удалось скомпилировать «${fileName}»: ${e?.message || String(e)}`)
    }
}

function processJSModule(code: string, isTypeScript: boolean): string {
    if (isTypeScript) {
        code = transpileTypeScriptSFC(code)
    }

    code = code.replace(/import\s+.*?from\s*['"].*?['"]\s*;?/g, '')
    code = code.replace(/import\s*['"].*?['"]\s*;?/g, '')

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

function findFileData(importPath: string, localFiles: Map<string, any>): any | null {
    const resolved = resolveLocalFile(importPath, 'dynamic.vue', localFiles)
    if (resolved) return resolved

    const cleanPath = normalizeLocalPath(importPath)
    if (localFiles.has(cleanPath)) return localFiles.get(cleanPath)
    return null
}

async function processImports(
    scriptContent: string,
    localFiles: Map<string, any>,
    moduleId: string,
    dependencies: Record<string, string> = {},
    onStyle?: (css: string) => void
): Promise<{ inlinedCode: string, dynamicComponents: Record<string, any> }> {

    const dynamicComponents: Record<string, any> = {}
    let processedCode = scriptContent

    const vueImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]\s*;?/g
    const vueMatches = [...processedCode.matchAll(vueImportRegex)]

    for (const match of vueMatches) {
        const [fullMatch, importName, importPath] = match

        const fileData = findFileData(importPath, localFiles)
        if (fileData) {
            const compiled = await compileVueComponentFromSource(
                fileData.code,
                importPath.replace(/^\.\//, ''),
                moduleId,
                dependencies,
                onStyle,
                localFiles
            )
            if (compiled) {
                dynamicComponents[importName] = compiled
                processedCode = processedCode.replace(fullMatch, `/* Component ${importName} registered */`)
            } else {
                throw new Error(`Не удалось загрузить компонент «${importPath}» (импорт ${importName}).`)
            }
        } else {
            throw new Error(`Не найден локальный компонент «${importPath}» (импорт ${importName}). Проверьте путь и наличие файла в модуле.`)
        }
    }

    const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"](\.[^'"]+\.(?:ts|js))['"]\s*;?/g
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
            throw new Error(`Не найден локальный файл «${importPath}». Проверьте путь и наличие файла в модуле.`)
        }
    }

    const defaultImportRegex = /import\s+(\w+)\s+from\s+['"](\.[^'"]+\.(?:ts|js))['"]\s*;?/g
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
            throw new Error(`Не найден локальный файл «${importPath}». Проверьте путь и наличие файла в модуле.`)
        }
    }

    return { inlinedCode: processedCode, dynamicComponents }
}

async function prepareSFC(
    code: string,
    localFiles: Map<string, any>,
    moduleId: string,
    dependencies: Record<string, string> = {},
    onStyle?: (css: string) => void
): Promise<{ sfc: string, dynamicComponents: Record<string, any> }> {

    let processedCode = code

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
            const { inlinedCode, dynamicComponents } = await processImports(scriptContent, localFiles, moduleId, dependencies, onStyle)

            const declarations = globalComposables
                ? Object.keys(globalComposables).map(name => `var ${name} = window.__moduleComposables?.${name}`).join('\n')
                : ''

            const result = processedCode.replace(scriptRegex, `<script setup>\n${declarations}\n\n${inlinedCode}\n</script>`)

            return { sfc: result, dynamicComponents }
        }
    }

    return { sfc: processedCode, dynamicComponents: {} }
}

const cache = useModuleCache()

function applyStyleToDom(moduleId: string, css: string) {
    if (!import.meta.client) return
    const styleId = `dynamic-module-style-${moduleId}`
    let el = document.getElementById(styleId) as HTMLStyleElement | null
    if (!el) {
        el = document.createElement('style')
        el.id = styleId
        el.setAttribute('data-module-id', moduleId)
        document.head.appendChild(el)
    }
    el.textContent = css
}

function removeStyleFromDomIfUnused(moduleId: string) {
    if (cache.hasActiveInstances(moduleId)) return
    if (!import.meta.client) return
    const styleId = `dynamic-module-style-${moduleId}`
    const el = document.getElementById(styleId)
    if (el) el.remove()
}

// ======================================================
// ЯДРО КОМПИЛЯЦИИ
// ======================================================
async function runCompilation(
    code: string,
    filesList: any[],
    dependencies: Record<string, string>,
    moduleId: string,
    signature: string
): Promise<CompiledResult> {

    const registry = await loadAllComponents()
    ;(window as any).__moduleComposables = globalComposables

    const safeDeps: Record<string, string> = {}
    if (dependencies instanceof Map) {
        dependencies.forEach((v, k) => { safeDeps[k] = v })
    } else if (dependencies && typeof dependencies === 'object') {
        Object.assign(safeDeps, dependencies)
    }

    const moduleCacheEntries: Record<string, any> = { vue: Vue }
    const depPromises = Object.entries(safeDeps).map(async ([pkg, ver]) => {
        try {
            const loaded = await loadExternalPackage(pkg, ver)
            moduleCacheEntries[pkg] = loaded
        } catch (err) {
            console.warn(`[ModuleCompiler] Ошибка предзагрузки пакета ${pkg}:`, err)
        }
    })
    await Promise.allSettled(depPromises)

    let cssParts: string[] = []
    const onStyle = (css: string) => {
        if (css) cssParts.push(css)
    }

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

    const { sfc, dynamicComponents } = await prepareSFC(code, localFiles, moduleId, safeDeps, onStyle)

    const files: Record<string, string> = { 'dynamic.vue': sfc }

    const options: any = {
        moduleCache: moduleCacheEntries,
        compiler,
        async getFile(url: any) {
            const normalized = normalizePath(typeof url === 'string' ? url : url?.url || '')
            const virtual = getVirtualModule(normalized)
            if (virtual) return virtual
            if (files[normalized] != null) return files[normalized]

            const localFile = resolveLocalFile(normalized, 'dynamic.vue', localFiles)
            if (localFile?.code != null) return localFile.code

            const pkg = normalized.split('/')[0]
            if (moduleCacheEntries[pkg] || safeDeps[pkg] || externalModulesCache.has(pkg)) {
                return ''
            }
            throw new Error(`Module not found: ${normalized}`)
        },
        async handleModule(
            type: string,
            getContentData: any,
            path: any
        ) {
            const requestPath = String(path)
            const normalized = normalizePath(requestPath)

            // Vue-файлы должны обрабатываться самим vue3-sfc-loader.
            // Не пытаемся загружать dynamic.vue через CDN.
            if (
                type === '.vue' ||
                normalized.endsWith('.vue')
            ) {
                return undefined
            }

            // Локальные импорты тоже оставляем загрузчику.
            if (
                normalized.startsWith('./') ||
                normalized.startsWith('../') ||
                normalized.startsWith('/')
            ) {
                return undefined
            }

            // Поддержка обычных и scoped npm-пакетов:
            // dayjs
            // lodash
            // @vueuse/core
            const segments = normalized.split('/').filter(Boolean)

            const pkg = normalized.startsWith('@')
                ? segments.slice(0, 2).join('/')
                : segments[0]

            if (!pkg) return undefined

            // Уже загруженная зависимость.
            if (
                Object.prototype.hasOwnProperty.call(
                    moduleCacheEntries,
                    pkg
                )
            ) {
                return moduleCacheEntries[pkg]
            }

            // Зависимость указана в настройках модуля
            // либо уже загружалась ранее.
            if (
                safeDeps[pkg] ||
                externalModulesCache.has(pkg)
            ) {
                const loaded = await loadExternalPackage(
                    pkg,
                    safeDeps[pkg] || 'latest'
                )

                moduleCacheEntries[pkg] = loaded
                return loaded
            }

            // Неизвестные типы файлов оставляем
            // стандартному обработчику vue3-sfc-loader.
            return undefined
        },
        addStyle(textContent: string) {
            onStyle(textContent)
        },
    }

    // Загружаем и полностью разрешаем асинхронные обёртки загрузчика.
    const rawModule = await loadModule('dynamic.vue', options)

    const wrapperPromise = rawModule?.promise

    const resolvedComponent = await extractComponentDefinition(rawModule)

    if (!isVueComponentDefinition(resolvedComponent)) {
        const received = resolvedComponent && typeof resolvedComponent === 'object'
            ? Object.keys(resolvedComponent).join(', ')
            : typeof resolvedComponent
        throw new Error(`Загрузчик вернул некорректный Vue-компонент. Получено: ${received || 'пустое значение'}. Проверьте импорты и template.`)
    }

    // Не мутируем объект, который мог быть разделён кэшем vue3-sfc-loader.
    const component: any = typeof resolvedComponent === 'function'
        ? resolvedComponent
        : { ...resolvedComponent }
    component.components = {
        ...(resolvedComponent.components || {}),
        ...registry,
        ...dynamicComponents,
    }
    component.props = {
        ...(resolvedComponent.props || {}),
        moduleId: { type: String, default: moduleId },
    }

    return {
        component: markRaw(component),
        dynamicComponents,
        css: cssParts.join('\n'),
        signature
    }
}

export async function precompileModule(
    moduleId: string,
    code: string,
    filesList: any[] = [],
    dependencies: Record<string, string> = {},
    version?: number | string
): Promise<void> {
    if (!globalComposables) return
    if (!code?.trim()) return

    const signature = makeModuleSignature(code, filesList, dependencies, version)

    if (cache.isCompiledFresh(moduleId, signature)) return

    const existing = cache.getCompiled(moduleId)
    if (existing?.inFlight && existing.inFlightSignature === signature) {
        await existing.inFlight.catch(() => {})
        return
    }

    const promise = runCompilation(code, filesList, dependencies, moduleId, signature)
    cache.setCompiledInFlight(moduleId, promise, signature)

    try {
        const result = await promise
        if (cache.isDesiredSignature(moduleId, signature)) {
            cache.setCompiledResult(moduleId, result)
        }
    } catch (e) {
        console.warn(`[ModuleCompiler] Фоновая компиляция модуля ${moduleId} не удалась:`, e)
    }
}

export async function warmupComponentRegistry() {
    return loadAllComponents()
}

// ======================================================
// ОСНОВНОЙ COMPOSABLE
// ======================================================
export const useModuleCompiler = () => {
    const compiledComponent = shallowRef<any>(null)
    const compiling = ref(false)
    const compileError = ref<string | null>(null)
    const compileErrorDetails = ref<any>(null)
    const activeKey = ref(0)
    const lastModuleId = ref<string | null>(null)
    let instanceAcquiredFor: string | null = null

    async function compileModule(
        code: string,
        filesList: any[] = [],
        dependencies: Record<string, string> = {},
        moduleId?: string,
        version?: number | string
    ) {
        compileError.value = null
        compileErrorDetails.value = null
        compiledComponent.value = null

        if (!code?.trim()) {
            compileError.value = 'No code provided'
            compileErrorDetails.value = {
                message: 'No code provided', stack: '', line: null, column: null,
                fileName: 'dynamic.vue', codeContext: ''
            }
            return
        }

        if (!globalComposables) {
            compileError.value = 'Composables not initialized'
            compileErrorDetails.value = {
                message: 'Composables not initialized', stack: '', line: null, column: null,
                fileName: 'dynamic.vue', codeContext: ''
            }
            return
        }

        const id = moduleId || 'anon'
        const signature = makeModuleSignature(code, filesList, dependencies, version)

        cache.setDesiredSignature(id, signature)

        if (lastModuleId.value && lastModuleId.value !== id) {
            releaseCurrentInstance()
        }
        lastModuleId.value = id

        if (instanceAcquiredFor !== id) {
            cache.acquireInstance(id)
            instanceAcquiredFor = id
        }

        if (cache.isCompiledFresh(id, signature)) {
            const cached = cache.getCompiled(id)!
            compiledComponent.value = cached.component
            applyStyleToDom(id, cached.css)
            activeKey.value++
            compiling.value = false
            return
        }

        compiling.value = true

        const TIMEOUT_MS = 25000
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    const timeoutError = new Error(`Compilation timeout after ${TIMEOUT_MS}ms`)
                    timeoutError.name = 'TimeoutError'
                    reject(timeoutError)
                }, TIMEOUT_MS)
            })

            const existing = cache.getCompiled(id)
            const compilePromise = (existing?.inFlight && existing.inFlightSignature === signature)
                ? existing.inFlight
                : (() => {
                    const p = runCompilation(code, filesList, dependencies, id, signature)
                    cache.setCompiledInFlight(id, p, signature)
                    return p
                })()

            const result = await Promise.race([compilePromise, timeoutPromise]) as CompiledResult

            if (!cache.isDesiredSignature(id, signature)) {
                return
            }

            cache.setCompiledResult(id, result)

            compiledComponent.value = result.component
            applyStyleToDom(id, result.css)
            activeKey.value++
            compileError.value = null
            compileErrorDetails.value = null

        } catch (e: any) {
            if (!cache.isDesiredSignature(id, signature)) {
                return
            }

            console.error('[ModuleCompiler] Error:', e)

            const parsed = parseCompilationError(e, code)

            compileError.value = parsed.message
            compileErrorDetails.value = parsed
            compiledComponent.value = null
        } finally {
            if (cache.isDesiredSignature(id, signature)) {
                compiling.value = false
            }
            if (timeoutId) clearTimeout(timeoutId)
        }
    }

    function releaseCurrentInstance() {
        if (instanceAcquiredFor) {
            cache.releaseInstance(instanceAcquiredFor)
            removeStyleFromDomIfUnused(instanceAcquiredFor)
            instanceAcquiredFor = null
        }
    }

    function reset() {
        compiledComponent.value = null
        compileError.value = null
        compileErrorDetails.value = null
        activeKey.value++
        lastModuleId.value = null
        releaseCurrentInstance()
    }

    function dispose() {
        releaseCurrentInstance()
    }

    return {
        compiledComponent,
        compiling,
        compileError,
        compileErrorDetails,
        compileModule,
        reset,
        dispose,
        activeKey,
    }
}
