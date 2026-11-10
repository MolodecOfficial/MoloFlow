import type * as monaco from 'monaco-editor'
import type { FileSystem } from './filesystem'

// Регистрируем провайдеры для всех языков
export function registerCompletionProviders(
    monaco: typeof monaco,
    fs: FileSystem
) {
    // 1. Провайдер для TypeScript
    monaco.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems: (model, position) => {
            return getFileCompletions(monaco, fs, model, position)
        }
    })

    // 2. Провайдер для JavaScript
    monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: (model, position) => {
            return getFileCompletions(monaco, fs, model, position)
        }
    })

    // 3. Провайдер для Vue (HTML)
    monaco.languages.registerCompletionItemProvider('html', {
        provideCompletionItems: (model, position) => {
            return getVueComponentCompletions(monaco, fs, model, position)
        }
    })

    // 4. Провайдер для Vue (внутри script)
    monaco.languages.registerCompletionItemProvider('vue', {
        provideCompletionItems: (model, position) => {
            // Проверяем, находимся ли мы внутри script тега
            const text = model.getValue()
            const lines = text.split('\n')
            let inScript = false
            let scriptStart = -1

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('<script')) {
                    inScript = true
                    scriptStart = i
                }
                if (inScript && lines[i].includes('</script>')) {
                    inScript = false
                }
                if (inScript && i === position.lineNumber - 1) {
                    // Мы внутри script - используем TS/JS подсказки
                    return getFileCompletions(monaco, fs, model, position)
                }
            }

            // Вне script - подсказки для компонентов
            return getVueComponentCompletions(monaco, fs, model, position)
        }
    })
}

// Получение подсказок для файлов
function getFileCompletions(
    monaco: typeof monaco,
    fs: FileSystem,
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

    // Получаем текст для анализа импортов
    const text = model.getValue()
    const lines = text.split('\n')
    const currentLine = lines[position.lineNumber - 1] || ''

    // Проверяем, пишем ли мы импорт
    const isImportContext = currentLine.includes('import') ||
        currentLine.includes('from') ||
        currentLine.includes('require') ||
        currentLine.includes('import(')

    // Добавляем файлы как подсказки
    files.forEach(file => {
        const ext = file.path.split('.').pop() || ''
        const isVue = ext === 'vue'
        const isTs = ext === 'ts'
        const isJs = ext === 'js'

        if (isVue || isTs || isJs) {
            const importPath = file.path.replace(/\.[^/.]+$/, '')
            const fileName = file.path.split('/').pop() || ''
            const componentName = fileName.replace(/\.[^/.]+$/, '')

            // Для импортов
            if (isImportContext) {
                suggestions.push({
                    label: `'./${importPath}'`,
                    kind: monaco.languages.CompletionItemKind.File,
                    documentation: {
                        value: `📁 ${file.path}\n${file.isServerFile ? '🖥️ Server file' : '🌐 Client file'}`,
                        isTrusted: true
                    },
                    detail: `import from ${file.path}`,
                    insertText: `'./${importPath}'`,
                    range: range,
                    sortText: '0'
                })
            }

            // Для Vue компонентов (в HTML части)
            if (isVue) {
                suggestions.push({
                    label: componentName,
                    kind: monaco.languages.CompletionItemKind.Class,
                    documentation: {
                        value: `🧩 Vue Component\n📁 ${file.path}\n\n${file.content?.slice(0, 200) || 'No preview'}`,
                        isTrusted: true
                    },
                    detail: `Vue component from ${file.path}`,
                    insertText: `<${componentName} />`,
                    range: range,
                    sortText: '0'
                })
            }

            // Для импорта компонентов
            if (isVue && isImportContext) {
                suggestions.push({
                    label: componentName,
                    kind: monaco.languages.CompletionItemKind.Class,
                    documentation: {
                        value: `🧩 Vue Component\n📁 ${file.path}`,
                        isTrusted: true
                    },
                    detail: `import ${componentName} from './${importPath}'`,
                    insertText: `${componentName}`,
                    range: range,
                    sortText: '1'
                })
            }
        }
    })

    // Добавляем подсказки для путей
    if (isImportContext) {
        fs.getFilePaths().forEach(path => {
            suggestions.push({
                label: `'${path}'`,
                kind: monaco.languages.CompletionItemKind.File,
                documentation: `📁 File: ${path}`,
                insertText: `'${path}'`,
                range: range,
                sortText: '2'
            })
        })
    }

    return { suggestions }
}

// Подсказки для Vue компонентов (в HTML части)
function getVueComponentCompletions(
    monaco: typeof monaco,
    fs: FileSystem,
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

    // Добавляем все Vue компоненты
    files.forEach(file => {
        if (file.path.endsWith('.vue')) {
            const fileName = file.path.split('/').pop() || ''
            const componentName = fileName.replace('.vue', '')

            suggestions.push({
                label: componentName,
                kind: monaco.languages.CompletionItemKind.Class,
                documentation: {
                    value: `🧩 Vue Component\n📁 ${file.path}\n\n${file.content?.slice(0, 200) || 'No preview'}`,
                    isTrusted: true
                },
                detail: `Vue component from ${file.path}`,
                insertText: `<${componentName} />`,
                range: range,
                sortText: '0'
            })
        }
    })

    return { suggestions }
}