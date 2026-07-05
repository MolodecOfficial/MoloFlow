// composables/monaco/intelliSense.ts
import type * as monaco from 'monaco-editor'
import { VirtualFileSystem } from './virtualFS'

export function registerIntelliSense(
    monaco: typeof monaco,
    fs: VirtualFileSystem
) {
    // 1. Провайдер для TypeScript/JavaScript импортов
    monaco.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems: (model, position) => {
            return getImportCompletions(monaco, fs, model, position)
        }
    })

    monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: (model, position) => {
            return getImportCompletions(monaco, fs, model, position)
        }
    })

    // 2. Провайдер для Vue компонентов
    monaco.languages.registerCompletionItemProvider('html', {
        provideCompletionItems: (model, position) => {
            return getVueComponentCompletions(monaco, fs, model, position)
        }
    })

    // 3. Провайдер для путей
    monaco.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems: (model, position) => {
            return getPathCompletions(monaco, fs, model, position)
        }
    })

    monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: (model, position) => {
            return getPathCompletions(monaco, fs, model, position)
        }
    })

    // 4. Провайдер для символов (переменные, функции)
    monaco.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems: (model, position) => {
            return getSymbolCompletions(monaco, fs, model, position)
        }
    })
}

// Получение подсказок для импортов
function getImportCompletions(
    monaco: typeof monaco,
    fs: VirtualFileSystem,
    model: monaco.editor.ITextModel,
    position: monaco.Position
): monaco.languages.ProviderResult<monaco.languages.CompletionList> {

    const word = model.getWordUntilPosition(position)
    const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
    }

    const currentLine = model.getLineContent(position.lineNumber)
    const isImport = currentLine.includes('import') || currentLine.includes('from')

    if (!isImport) {
        return { suggestions: [] }
    }

    const suggestions: monaco.languages.CompletionItem[] = []
    const files = fs.listFiles()

    files.forEach(file => {
        const path = file.path
        const ext = path.split('.').pop() || ''
        const name = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || path

        // Vue файлы
        if (ext === 'vue') {
            suggestions.push({
                label: `'./${name}'`,
                kind: monaco.languages.CompletionItemKind.File,
                documentation: `📁 Vue component: ${path}`,
                detail: 'Import Vue component',
                insertText: `'./${name}'`,
                range: range,
                sortText: '0'
            })

            // Имя компонента для импорта
            suggestions.push({
                label: name,
                kind: monaco.languages.CompletionItemKind.Class,
                documentation: `🧩 Vue Component: ${path}`,
                detail: `import ${name} from './${name}'`,
                insertText: `${name}`,
                range: range,
                sortText: '1'
            })
        }

        // TS/JS файлы
        if (ext === 'ts' || ext === 'js') {
            suggestions.push({
                label: `'./${name}'`,
                kind: monaco.languages.CompletionItemKind.File,
                documentation: `📁 ${path}`,
                detail: `Import from ${path}`,
                insertText: `'./${name}'`,
                range: range,
                sortText: '2'
            })
        }
    })

    return { suggestions }
}

// Подсказки для Vue компонентов
function getVueComponentCompletions(
    monaco: typeof monaco,
    fs: VirtualFileSystem,
    model: monaco.editor.ITextModel,
    position: monaco.Position
): monaco.languages.ProviderResult<monaco.languages.CompletionList> {

    const word = model.getWordUntilPosition(position)
    const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
    }

    const suggestions: monaco.languages.CompletionItem[] = []
    const files = fs.listFiles()

    files.forEach(file => {
        if (file.path.endsWith('.vue')) {
            const name = file.path.split('/').pop()?.replace('.vue', '') || ''

            suggestions.push({
                label: name,
                kind: monaco.languages.CompletionItemKind.Class,
                documentation: {
                    value: `🧩 Vue Component\n📁 ${file.path}\n\n${file.content?.slice(0, 200) || 'No preview'}`,
                    isTrusted: true
                },
                detail: `Component from ${file.path}`,
                insertText: `<${name} />`,
                range: range,
                sortText: '0'
            })
        }
    })

    return { suggestions }
}

// Подсказки для путей
function getPathCompletions(
    monaco: typeof monaco,
    fs: VirtualFileSystem,
    model: monaco.editor.ITextModel,
    position: monaco.Position
): monaco.languages.ProviderResult<monaco.languages.CompletionList> {

    const word = model.getWordUntilPosition(position)
    const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
    }

    const currentLine = model.getLineContent(position.lineNumber)
    const isPath = currentLine.includes('"') || currentLine.includes("'")

    if (!isPath) {
        return { suggestions: [] }
    }

    const suggestions: monaco.languages.CompletionItem[] = []
    const paths = fs.getPaths()

    paths.forEach(path => {
        suggestions.push({
            label: `'${path}'`,
            kind: monaco.languages.CompletionItemKind.File,
            documentation: `📁 File: ${path}`,
            insertText: `'${path}'`,
            range: range,
            sortText: '0'
        })
    })

    return { suggestions }
}

// Подсказки для символов (переменные, функции из других файлов)
function getSymbolCompletions(
    monaco: typeof monaco,
    fs: VirtualFileSystem,
    model: monaco.editor.ITextModel,
    position: monaco.Position
): monaco.languages.ProviderResult<monaco.languages.CompletionList> {

    const suggestions: monaco.languages.CompletionItem[] = []
    const files = fs.listFiles()

    files.forEach(file => {
        const exports = parseExports(file.content, file.path)

        exports.forEach(exp => {
            suggestions.push({
                label: exp.name,
                kind: exp.type === 'function'
                    ? monaco.languages.CompletionItemKind.Function
                    : monaco.languages.CompletionItemKind.Variable,
                documentation: `📁 ${file.path}\n${exp.description || ''}`,
                detail: `from ${file.path}`,
                insertText: exp.name,
                sortText: '0'
            })
        })
    })

    return { suggestions }
}

// Парсинг экспортов из файла
function parseExports(content: string, path: string): Array<{ name: string, type: string, description?: string }> {
    const exports: Array<{ name: string, type: string, description?: string }> = []

    if (!content) return exports

    const funcRegex = /export\s+function\s+(\w+)/g
    let match
    while ((match = funcRegex.exec(content)) !== null) {
        exports.push({ name: match[1], type: 'function', description: `Function from ${path}` })
    }

    const constRegex = /export\s+const\s+(\w+)\s*=/g
    while ((match = constRegex.exec(content)) !== null) {
        exports.push({ name: match[1], type: 'variable', description: `Const from ${path}` })
    }

    const defaultRegex = /export\s+default\s+(\w+)/g
    while ((match = defaultRegex.exec(content)) !== null) {
        exports.push({ name: match[1], type: 'default', description: `Default export from ${path}` })
    }

    const namedRegex = /export\s*\{\s*([^}]*)\s*\}/g
    while ((match = namedRegex.exec(content)) !== null) {
        const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim())
        names.forEach(name => {
            if (name) {
                exports.push({ name, type: 'variable', description: `Named export from ${path}` })
            }
        })
    }

    return exports
}