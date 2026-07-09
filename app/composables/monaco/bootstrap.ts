// composables/monaco/bootstrap.ts
import * as monaco from 'monaco-editor'
import { FileSystem } from './filesystem'
import { VirtualFileSystem } from './virtualFS'
import { ApiService } from './services'
import { registerCompletionProviders } from './completions'
import { registerIntelliSense } from './intelliSense'
import './workers'

export type MonacoContext = {
    editor: monaco.editor.IStandaloneCodeEditor
    monaco: typeof monaco
    fs: FileSystem           // API файловая система
    vfs: VirtualFileSystem   // Виртуальная FS для модулей
    api: ApiService
}

export const LANGUAGE_MAP: Record<string, string> = {
    vue: 'html',
    js: 'javascript',
    ts: 'typescript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'shell',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    php: 'php',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    kt: 'kotlin',
    dart: 'dart',
    lua: 'lua',
    r: 'r',
    sql: 'sql'
}

export function getMonacoLanguage(format: string): string {
    return LANGUAGE_MAP[format] || 'plaintext'
}

export function createMonaco(el: HTMLElement, options?: {
    files?: any[]
    apiBase?: string
    language?: string
    moduleId?: string
    enterpriseId?: string
}) {
    // Создаем API файловую систему
    const fs = new FileSystem(options?.files || [], {
        apiBase: options?.apiBase,
        moduleId: options?.moduleId,
        enterpriseId: options?.enterpriseId
    })

    // Создаем виртуальную FS для IntelliSense
    const vfs = new VirtualFileSystem(monaco)

    // Загружаем файлы в виртуальную FS если есть
    if (options?.files) {
        const fileNodes = options.files.map(f => ({
            path: f.path || `${f.name}.${f.format}`,
            content: f.code || '',
            language: getMonacoLanguage(f.format || 'vue')
        }))
        vfs.addFiles(fileNodes)
    }

        const api = new ApiService(options?.apiBase)

        const editor = monaco.editor.create(el, {
            value: '',
            language: options?.language || 'typescript',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
            fontWeight: 'normal',
            lineHeight: 1.5,
            letterSpacing: 0.5,
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: { other: true, comments: false, strings: false },
            parameterHints: { enabled: true },
            snippetSuggestions: 'top',
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: true,
            renderWhitespace: 'selection',
            renderControlCharacters: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoSurround: 'languageDefined',
            codeLens: { enabled: true },
            semanticHighlighting: { enabled: true },
        })

        // Регистрируем оба типа провайдеров
        registerCompletionProviders(monaco, fs)
        registerIntelliSense(monaco, vfs)

        // Регистрируем команды
        registerApiCommands(editor, monaco, api, fs, vfs)

        const ctx: MonacoContext = {
            editor,
            monaco,
            fs,
            vfs,
            api
        }

        return ctx
    }

    // Регистрация API команд
    function registerApiCommands(
        editor: monaco.editor.IStandaloneCodeEditor,
        monaco: typeof monaco,
        api: ApiService,
        fs: FileSystem,
        vfs: VirtualFileSystem
    ) {
        // Команда: загрузить файлы из БД
        editor.addAction({
            id: 'load-files-from-db',
            label: 'Load Files from Database',
            contextMenuGroupId: 'navigation',
            run: async () => {
                const model = editor.getModel()
                if (!model) return

                const code = model.getValue()
                const match = code.match(/moduleId:\s*['"]([^'"]+)['"]/)
                if (match) {
                    const moduleId = match[1]
                    const enterpriseId = localStorage.getItem('currentEnterprise')
                        ? JSON.parse(localStorage.getItem('currentEnterprise')!)._id
                        : ''

                    if (moduleId && enterpriseId) {
                        // Загружаем в обе FS
                        await fs.loadFilesFromDB(moduleId, enterpriseId)
                        await vfs.loadFromDB(moduleId, enterpriseId)

                        const files = fs.listFiles()
                        model.setValue(JSON.stringify(files, null, 2))
                        monaco.editor.setModelLanguage(model, 'json')
                    }
                }
            }
        })

        // Команда: сохранить текущий файл в БД
        editor.addAction({
            id: 'save-current-file',
            label: 'Save Current File to Database',
            contextMenuGroupId: 'navigation',
            run: async () => {
                const model = editor.getModel()
                if (!model) return

                const path = model.uri.path.replace('/', '')
                const content = model.getValue()
                const language = model.getLanguageId()

                // Сохраняем в обе FS
                await fs.saveFileToDB(path, content, language)
                vfs.updateFile(path, content)

                console.log(`File ${path} saved to database`)
            }
        })

        // Команда: показать все файлы в файловой системе
        editor.addAction({
            id: 'list-files',
            label: 'List Files',
            run: () => {
                const files = fs.listFiles()
                console.table(files)

                const model = editor.getModel()
                if (model) {
                    const currentContent = model.getValue()
                    const fileList = files.map(f => `- ${f.path} (${f.language})`).join('\n')
                    model.setValue(`// Files in system:\n\n${fileList}\n\n// To see content, use: fs.readFile('path')\n\n${currentContent}`)
                }
            }
        })

        // Команда: показать виртуальные файлы (IntelliSense)
        editor.addAction({
            id: 'list-virtual-files',
            label: 'List Virtual Files (IntelliSense)',
            run: () => {
                const files = vfs.listFiles()
                console.table(files)

                const model = editor.getModel()
                if (model) {
                    const fileList = files.map(f => `- ${f.path} (${f.content.length} chars)`).join('\n')
                    model.setValue(`// Virtual files for IntelliSense:\n\n${fileList}`)
                }
            }
        })

        // Команда: открыть файл
        editor.addAction({
            id: 'open-file',
            label: 'Open File...',
            contextMenuGroupId: 'navigation',
            run: async () => {
                const paths = fs.getFilePaths()
                const path = prompt('Enter file path:', paths[0] || '')
                if (path && fs.exists(path)) {
                    const file = fs.readFile(path)
                    const model = editor.getModel()
                    if (model && file) {
                        model.setValue(file.content)
                        monaco.editor.setModelLanguage(model, file.language || 'plaintext')
                    }
                } else {
                    console.warn(`File ${path} not found`)
                }
            }
        })
    }