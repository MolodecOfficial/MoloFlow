import { ref, shallowRef } from 'vue'
import type { FileNode } from '~~/app/composables/monaco/filesystem'
import { getGlobalCatalog } from '~~/app/composables/monaco/globalCatalog'

export interface MonacoComposable {
    name: string
    path: string
    filePath: string
    imports: string[]
    // true — найден в глобальной библиотеке проекта (import.meta.glob),
    // false/undefined — найден в файлах текущего открытого модуля
    isGlobal?: boolean
}

export interface MonacoComponent {
    name: string
    path: string
    filePath: string
    props?: string[]
    isGlobal?: boolean
}

// ---------------------------------------------------------------
// SINGLETON STATE
// ---------------------------------------------------------------
// Это состояние объявлено на уровне модуля намеренно: useMonacoFiles
// должен быть глобальным composable, а не создавать новый набор
// ref'ов при каждом вызове.
// ---------------------------------------------------------------

const files = shallowRef<FileNode[]>([])

const composables = shallowRef<MonacoComposable[]>([])
const components = shallowRef<MonacoComponent[]>([])

const composablesMap = ref(new Map<string, MonacoComposable>())
const componentsMap = ref(new Map<string, MonacoComponent>())

export function useMonacoFiles() {
    // ---------------------------------------------------------
    // PATH
    // ---------------------------------------------------------

    function normalizePath(path: string): string {
        return String(path || '')
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/^\.\/+/, '')
            .replace(/^\/+/, '')
    }

    function removeExtension(path: string): string {
        return path.replace(/\.(vue|tsx?|jsx?|mjs|cjs)$/i, '')
    }

    function getExtension(path: string): string {
        const normalized = normalizePath(path)
        const match = normalized.match(/\.([^.\/]+)$/)
        return match ? match[1].toLowerCase() : ''
    }

    // ---------------------------------------------------------
    // COMPOSABLES
    // ---------------------------------------------------------

    function findComposablesInCode(code: string, filePath: string, isGlobal = false): MonacoComposable[] {
        if (!code || !filePath) {
            return []
        }

        const result: MonacoComposable[] = []
        const names = new Set<string>()
        const normalizedPath = normalizePath(filePath)

        // function useFoo() {}
        const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(use[A-Z][A-Za-z0-9_$]*)\s*\(([^)]*)\)/g
        let match: RegExpExecArray | null
        while ((match = functionRegex.exec(code))) {
            names.add(match[1])
        }

        // const useFoo = () => {}
        const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(use[A-Z][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g
        while ((match = arrowRegex.exec(code))) {
            names.add(match[1])
        }

        // const useFoo = param => {}
        const singleParamArrowRegex = /(?:export\s+)?(?:const|let|var)\s+(use[A-Z][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/g
        while ((match = singleParamArrowRegex.exec(code))) {
            names.add(match[1])
        }

        // const useFoo = function() {}
        const functionExpressionRegex = /(?:export\s+)?(?:const|let|var)\s+(use[A-Z][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g
        while ((match = functionExpressionRegex.exec(code))) {
            names.add(match[1])
        }

        // export { useFoo, useBar }
        const exportRegex = /\bexport\s*\{([^}]+)\}/g
        while ((match = exportRegex.exec(code))) {
            for (const item of match[1].split(',')) {
                const name = item.trim().split(/\s+as\s+/i)[0].trim()
                if (/^use[A-Z][A-Za-z0-9_$]*$/.test(name)) {
                    names.add(name)
                }
            }
        }

        for (const name of names) {
            let imports: string[] = []

            const parameterPatterns = [
                new RegExp(`(?:async\\s+)?function\\s+${escapeRegex(name)}\\s*\\(([^)]*)\\)`, 'm'),
                new RegExp(`(?:const|let|var)\\s+${escapeRegex(name)}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>`, 'm'),
                new RegExp(`(?:const|let|var)\\s+${escapeRegex(name)}\\s*=\\s*(?:async\\s+)?function\\s*\\(([^)]*)\\)`, 'm')
            ]

            for (const pattern of parameterPatterns) {
                const found = code.match(pattern)
                if (found) {
                    imports = found[1].split(',').map(v => v.trim()).filter(Boolean)
                    break
                }
            }

            result.push({
                name,
                path: removeExtension(normalizedPath),
                filePath: normalizedPath,
                imports,
                isGlobal
            })
        }

        return result
    }

    // ---------------------------------------------------------
    // COMPONENTS
    // ---------------------------------------------------------

    function findComponentsInCode(code: string, filePath: string, isGlobal = false): MonacoComponent[] {
        if (!code) {
            return []
        }

        const normalizedPath = normalizePath(filePath)

        if (getExtension(normalizedPath) !== 'vue') {
            return []
        }

        const result: MonacoComponent[] = []

        const fileName = normalizedPath.split('/').pop()?.replace(/\.vue$/i, '') || ''
        let componentName = fileName

        // defineOptions({ name: 'Foo' })
        const defineOptionsMatch = code.match(/defineOptions\s*\(\s*\{[\s\S]*?\bname\s*:\s*['"`]([^'"`]+)['"`]/)
        if (defineOptionsMatch) {
            componentName = defineOptionsMatch[1]
        }

        // export default { name: 'Foo' }
        const exportDefaultNameMatch = code.match(/export\s+default\s*\{[\s\S]*?\bname\s*:\s*['"`]([^'"`]+)['"`]/)
        if (exportDefaultNameMatch) {
            componentName = exportDefaultNameMatch[1]
        }

        const props = new Set<string>()

        // defineProps<{ ... }>()
        const genericPropsMatch = code.match(/defineProps\s*<\s*\{([\s\S]*?)\}\s*>/)
        if (genericPropsMatch) {
            extractPropsFromBlock(genericPropsMatch[1], props)
        }

        // defineProps({ ... })
        const objectPropsMatch = code.match(/defineProps\s*\(\s*\{([\s\S]*?)\}\s*\)/)
        if (objectPropsMatch) {
            extractPropsFromBlock(objectPropsMatch[1], props)
        }

        // defineProps(['foo', 'bar'])
        const arrayPropsMatch = code.match(/defineProps\s*\(\s*\[([\s\S]*?)\]\s*\)/)
        if (arrayPropsMatch) {
            const matches = arrayPropsMatch[1].match(/['"`]([^'"`]+)['"`]/g)
            if (matches) {
                for (const item of matches) {
                    props.add(item.replace(/^['"`]|['"`]$/g, ''))
                }
            }
        }

        // Options API: props: { foo: String }
        const optionsPropsMatch = code.match(/\bprops\s*:\s*\{([\s\S]*?)\}/)
        if (optionsPropsMatch) {
            extractPropsFromBlock(optionsPropsMatch[1], props)
        }

        // Options API: props: ['foo', 'bar']
        const optionsArrayPropsMatch = code.match(/\bprops\s*:\s*\[([\s\S]*?)\]/)
        if (optionsArrayPropsMatch) {
            const matches = optionsArrayPropsMatch[1].match(/['"`]([^'"`]+)['"`]/g)
            if (matches) {
                for (const item of matches) {
                    props.add(item.replace(/^['"`]|['"`]$/g, ''))
                }
            }
        }

        if (componentName) {
            result.push({
                name: componentName,
                path: removeExtension(normalizedPath),
                filePath: normalizedPath,
                props: props.size ? [...props].slice(0, 50) : undefined,
                isGlobal
            })
        }

        return result
    }

    function extractPropsFromBlock(block: string, props: Set<string>) {
        const typeRegex = /(?:^|[,;\n])\s*([A-Za-z_$][\w$-]*)\s*\??\s*:/g
        let match: RegExpExecArray | null
        while ((match = typeRegex.exec(block))) {
            props.add(match[1])
        }

        const runtimeRegex = /(?:^|[,;\n])\s*['"`]?([A-Za-z_$][\w$-]*)['"`]?\s*:/g
        while ((match = runtimeRegex.exec(block))) {
            props.add(match[1])
        }
    }

    // ---------------------------------------------------------
    // UPDATE
    // ---------------------------------------------------------

    function updateFiles(newFiles: FileNode[]) {
        const moduleFiles = Array.isArray(newFiles)
            ? newFiles.filter(
                file => file && typeof file.path === 'string' && typeof file.content === 'string'
            )
            : []

        // Каталог = файлы текущего модуля + глобальная библиотека проекта.
        // При совпадении пути побеждает версия из модуля — она "живая",
        // редактируется прямо сейчас, а версия из сборки может быть устаревшей.
        const modulePaths = new Set(moduleFiles.map(f => normalizePath(f.path)))
        const globalOnly = getGlobalCatalog().filter(f => !modulePaths.has(normalizePath(f.path)))
        const globalPathSet = new Set(globalOnly.map(f => normalizePath(f.path)))

        const allFiles = [...moduleFiles, ...globalOnly]
        files.value = allFiles

        const foundComposables: MonacoComposable[] = []
        const foundComponents: MonacoComponent[] = []

        const composablesByName = new Map<string, MonacoComposable>()
        const componentsByName = new Map<string, MonacoComponent>()

        for (const file of allFiles) {
            const path = normalizePath(file.path)
            const content = file.content || ''

            if (!path) {
                continue
            }

            const isGlobal = globalPathSet.has(path)
            const extension = getExtension(path)

            if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(extension)) {
                const found = findComposablesInCode(content, path, isGlobal)
                for (const item of found) {
                    foundComposables.push(item)
                    if (!composablesByName.has(item.name)) {
                        composablesByName.set(item.name, item)
                    }
                }
            }

            if (extension === 'vue') {
                const found = findComponentsInCode(content, path, isGlobal)
                for (const item of found) {
                    foundComponents.push(item)
                    if (!componentsByName.has(item.name)) {
                        componentsByName.set(item.name, item)
                    }
                }
            }
        }

        // Сначала — то, что относится к текущему модулю (наиболее вероятно нужно
        // прямо сейчас), затем остальная библиотека проекта, внутри групп — по алфавиту.
        const bySourceThenName = <T extends { name: string; isGlobal?: boolean }>(items: T[]) =>
            items.sort((a, b) => Number(!!a.isGlobal) - Number(!!b.isGlobal) || a.name.localeCompare(b.name))

        composables.value = bySourceThenName(dedupeByPathAndName(foundComposables))
        components.value = bySourceThenName(dedupeByPathAndName(foundComponents))

        composablesMap.value = composablesByName
        componentsMap.value = componentsByName


    }

    // ---------------------------------------------------------
    // IMPORTS
    // ---------------------------------------------------------

    function getComposableImport(name: string, fromFile?: string): string {
        const composable = composablesMap.value.get(name)
        if (!composable) {
            return `import { ${name} } from './${name}'`
        }
        const importPath = createImportPath(fromFile || '', composable.filePath)
        return `import { ${name} } from '${importPath}'`
    }

    function getComponentImport(name: string, fromFile?: string): string {
        const component = componentsMap.value.get(name)
        if (!component) {
            return `import ${name} from './${name}.vue'`
        }
        const importPath = createImportPath(fromFile || '', component.filePath)
        return `import ${name} from '${importPath}'`
    }

    function createImportPath(fromFile: string, targetFile: string): string {
        const target = removeExtension(normalizePath(targetFile))

        if (!fromFile) {
            return `./${target}`
        }

        const from = normalizePath(fromFile)
        const fromDirectory = from.split('/').slice(0, -1)
        const targetParts = target.split('/').filter(Boolean)

        let common = 0
        while (
            common < fromDirectory.length &&
            common < targetParts.length &&
            fromDirectory[common] === targetParts[common]
            ) {
            common++
        }

        const upCount = fromDirectory.length - common
        const result = [...Array(upCount).fill('..'), ...targetParts.slice(common)]

        let importPath = result.join('/')
        if (!importPath.startsWith('.')) {
            importPath = `./${importPath}`
        }

        return importPath
    }

    // ---------------------------------------------------------
    // UTILS
    // ---------------------------------------------------------

    function dedupeByPathAndName<T extends { name: string; filePath: string }>(items: T[]): T[] {
        const map = new Map<string, T>()
        for (const item of items) {
            const key = `${item.name}::${item.filePath}`
            if (!map.has(key)) {
                map.set(key, item)
            }
        }
        return [...map.values()]
    }

    function escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    // ---------------------------------------------------------
    // API
    // ---------------------------------------------------------

    return {
        files,
        composables,
        components,
        updateFiles,
        getComposableImport,
        getComponentImport,
        parseExports,
        findComposablesInCode,
        findComponentsInCode
    }
}

// -------------------------------------------------------------
// EXPORT PARSER (не завязан на состояние, чистая функция)
// -------------------------------------------------------------

export function parseExports(content: string): string[] {
    if (!content || content.length > 1_000_000) {
        return []
    }

    const result = new Set<string>()

    const functionRegex = /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g
    const variableRegex = /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g
    const classRegex = /\bexport\s+class\s+([A-Za-z_$][\w$]*)/g
    const namedExportRegex = /\bexport\s*\{([^}]+)\}/g

    let match: RegExpExecArray | null

    while ((match = functionRegex.exec(content))) {
        result.add(match[1])
    }
    while ((match = variableRegex.exec(content))) {
        result.add(match[1])
    }
    while ((match = classRegex.exec(content))) {
        result.add(match[1])
    }
    while ((match = namedExportRegex.exec(content))) {
        for (const item of match[1].split(',')) {
            const name = item.trim().split(/\s+as\s+/i)[0].trim()
            if (name && name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name)) {
                result.add(name)
            }
        }
    }

    return [...result]
}