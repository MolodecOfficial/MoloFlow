// composables/monaco/intelliSense.ts
import type * as monaco from 'monaco-editor'
import { VirtualFileSystem } from './virtualFS'

// Языки для которых регистрируем подсказки
const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'html', 'vue']

export function registerIntelliSense(
    monaco: typeof monaco,
    fs: VirtualFileSystem
) {
    // Регистрируем для каждого языка
    for (const lang of SUPPORTED_LANGUAGES) {
        monaco.languages.registerCompletionItemProvider(lang, {
            provideCompletionItems: (model, position) => {
                return getCompletions(monaco, fs, model, position, lang)
            }
        })
    }

    // Регистрируем Hover провайдер
    for (const lang of SUPPORTED_LANGUAGES) {
        monaco.languages.registerHoverProvider(lang, {
            provideHover: (model, position) => {
                return getHoverInfo(monaco, fs, model, position)
            }
        })
    }
}

function getCompletions(
    monaco: typeof monaco,
    fs: VirtualFileSystem,
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    language: string
): monaco.languages.ProviderResult<monaco.languages.CompletionList> {

    const word = model.getWordUntilPosition(position)
    const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
    }

    const suggestions: monaco.languages.CompletionItem[] = []
    const currentLine = model.getLineContent(position.lineNumber)
    const text = model.getValue()

    // Определяем контекст
    const isImport = currentLine.includes('import') || currentLine.includes('from')
    const isRequire = currentLine.includes('require')
    const isPath = currentLine.includes('"') || currentLine.includes("'")
    const isInHtml = language === 'html' || language === 'vue'

    // Получаем все файлы из VFS
    const files = fs.listFiles()

    // 1. Подсказки для импортов (файлы)
    if (isImport || isRequire) {
        for (const file of files) {
            const path = file.path
            const name = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || path
            const ext = path.split('.').pop()?.toLowerCase() || ''

            // Vue компоненты
            if (ext === 'vue') {
                suggestions.push({
                    label: `'./${name}'`,
                    kind: monaco.languages.CompletionItemKind.File,
                    detail: `Vue компонент: ${path}`,
                    documentation: `📁 ${path}\n🧩 Vue компонент`,
                    insertText: `'./${name}'`,
                    range: range,
                    sortText: '0'
                })

                // Имя компонента для импорта
                suggestions.push({
                    label: name,
                    kind: monaco.languages.CompletionItemKind.Class,
                    detail: `import ${name} from './${name}'`,
                    documentation: `🧩 Компонент: ${path}`,
                    insertText: name,
                    range: range,
                    sortText: '1'
                })
            }

            // TS/JS файлы
            if (ext === 'ts' || ext === 'js') {
                suggestions.push({
                    label: `'./${name}'`,
                    kind: monaco.languages.CompletionItemKind.File,
                    detail: `Файл: ${path}`,
                    documentation: `📁 ${path}`,
                    insertText: `'./${name}'`,
                    range: range,
                    sortText: '2'
                })
            }
        }
    }

    // 2. Подсказки для путей
    if (isPath && !isImport) {
        for (const file of files) {
            const path = file.path
            suggestions.push({
                label: `'${path}'`,
                kind: monaco.languages.CompletionItemKind.File,
                detail: `Путь: ${path}`,
                insertText: `'${path}'`,
                range: range,
                sortText: '3'
            })
        }
    }

    // 3. Подсказки для Vue компонентов (в HTML части)
    if (isInHtml) {
        for (const file of files) {
            if (file.path.endsWith('.vue')) {
                const name = file.path.split('/').pop()?.replace('.vue', '') || ''
                suggestions.push({
                    label: name,
                    kind: monaco.languages.CompletionItemKind.Class,
                    detail: `Vue компонент: ${file.path}`,
                    documentation: `🧩 ${name}\n📁 ${file.path}`,
                    insertText: `<${name} />`,
                    range: range,
                    sortText: '4'
                })
            }
        }
    }

    // 4. Подсказки для экспортов (функции, переменные)
    if (language === 'typescript' || language === 'javascript') {
        for (const file of files) {
            const exports = parseExports(file.content)
            for (const exp of exports) {
                suggestions.push({
                    label: exp.name,
                    kind: exp.type === 'function'
                        ? monaco.languages.CompletionItemKind.Function
                        : monaco.languages.CompletionItemKind.Variable,
                    detail: `Из: ${file.path}`,
                    documentation: `${exp.type}: ${exp.name}`,
                    insertText: exp.name,
                    range: range,
                    sortText: '5'
                })
            }
        }
    }

    return { suggestions }
}

function getHoverInfo(
    monaco: typeof monaco,
    fs: VirtualFileSystem,
    model: monaco.editor.ITextModel,
    position: monaco.Position
): monaco.languages.ProviderResult<monaco.languages.Hover> {

    const word = model.getWordAtPosition(position)
    if (!word) return null

    const text = model.getValue()
    const files = fs.listFiles()

    // Ищем импорты
    const importRegex = new RegExp(`import\\s+{?\\s*${word.word}\\s*}?\\s+from\\s+['"]([^'"]+)['"]`, 'g')
    const match = importRegex.exec(text)

    if (match) {
        const importPath = match[1]
        for (const file of files) {
            if (file.path.includes(importPath) || file.path.endsWith(importPath)) {
                return {
                    contents: [
                        { value: `**📁 ${file.path}**` },
                        { value: `\`\`\`\n${file.content.slice(0, 200)}${file.content.length > 200 ? '...' : ''}\n\`\`\`` }
                    ]
                }
            }
        }
    }

    // Ищем компоненты
    for (const file of files) {
        if (file.path.endsWith('.vue')) {
            const name = file.path.split('/').pop()?.replace('.vue', '') || ''
            if (name === word.word) {
                return {
                    contents: [
                        { value: `**🧩 ${name}**` },
                        { value: `📁 ${file.path}` }
                    ]
                }
            }
        }
    }

    return null
}

function parseExports(content: string): Array<{ name: string; type: string }> {
    const exports: Array<{ name: string; type: string }> = []
    if (!content) return exports

    const patterns = [
        { regex: /export\s+function\s+(\w+)/g, type: 'function' },
        { regex: /export\s+const\s+(\w+)\s*=/g, type: 'variable' },
        { regex: /export\s+let\s+(\w+)\s*=/g, type: 'variable' },
        { regex: /export\s+var\s+(\w+)\s*=/g, type: 'variable' },
        { regex: /export\s+class\s+(\w+)/g, type: 'class' },
        { regex: /export\s+async\s+function\s+(\w+)/g, type: 'function' },
        { regex: /export\s+default\s+(\w+)/g, type: 'default' },
        { regex: /export\s*\{\s*([^}]*)\s*\}/g, type: 'named' },
    ]

    for (const pattern of patterns) {
        let match
        while ((match = pattern.regex.exec(content)) !== null) {
            if (pattern.type === 'named') {
                const names = match[1].split(',').map((n: string) => n.trim().split(' as ')[0].trim())
                for (const name of names) {
                    if (name) exports.push({ name, type: 'variable' })
                }
            } else {
                exports.push({ name: match[1], type: pattern.type })
            }
        }
    }

    return exports
}