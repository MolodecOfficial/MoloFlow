// composables/monaco/bootstrap.ts
import * as monaco from 'monaco-editor'
import { FileSystem, type FileNode } from './filesystem'
import { VirtualFileSystem } from './virtualFS'
import { ApiService } from './services'
import { registerCompletionProviders } from './completions'
import { registerIntelliSense } from './intelliSense'
import { setupTypeSystem, syncExtraLibs } from './typeSystem'
import { defineMoloTheme } from './theme'
import './workers'

export type MonacoContext = {
    editor: monaco.editor.IStandaloneCodeEditor
    monaco: typeof monaco
    fs: FileSystem           // API файловая система
    vfs: VirtualFileSystem   // Виртуальная FS для модулей
    api: ApiService
    // Пере-регистрирует .ts/.js файлы в реальном TS language service.
    // Вызывать вместе с fs.loadFiles()/vfs.loadModuleFiles() при любом обновлении набора файлов,
    // иначе автодополнение/hover/F12 будут показывать устаревшие версии файлов.
    refreshTypes: (files: FileNode[]) => void
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

let themeRegistered = false

export function createMonaco(el: HTMLElement, options?: {
    // files ожидаются УЖЕ нормализованными: {path, content, language, isServerFile}.
    files?: FileNode[]
    apiBase?: string
    language?: string
    moduleId?: string
    enterpriseId?: string
    // Вызывается по Ctrl+S. Реальное сохранение (запрос на бэкенд) остаётся
    // на стороне вызывающего компонента — редактор просто сигнализирует "пользователь хочет сохранить".
    onSave?: () => void
}) {
    // Настраиваем TS language service и тему один раз на всё приложение
    setupTypeSystem(monaco)
    if (!themeRegistered) {
        defineMoloTheme(monaco)
        themeRegistered = true
    }

    // Создаем API файловую систему — уже с готовыми файлами, без похода в сеть
    const fs = new FileSystem(options?.files || [], {
        apiBase: options?.apiBase,
        moduleId: options?.moduleId,
        enterpriseId: options?.enterpriseId
    })

    // Создаем виртуальную FS для IntelliSense (используется для .vue-компонентов —
    // у них нет полноценного языкового сервиса, поэтому для них оставлена
    // облегчённая, но всё ещё полезная кастомная система автодополнения)
    const vfs = new VirtualFileSystem(monaco)

    if (options?.files?.length) {
        vfs.addFiles(options.files.map(f => ({
            path: f.path,
            content: f.content,
            language: f.language
        })))
    }

    // .ts/.js файлы дополнительно регистрируем в настоящем TS-компиляторе —
    // это даёт реальный вывод типов, реальные ошибки и переход к определению (F12)
    const refreshTypes = (files: FileNode[]) => syncExtraLibs(monaco, files)
    refreshTypes(options?.files || [])

    const api = new ApiService(options?.apiBase)

    const editor = monaco.editor.create(el, {
        value: '',
        language: options?.language || 'typescript',
        theme: 'molo-dark',
        automaticLayout: true,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        fontLigatures: true,
        fontWeight: 'normal',
        lineHeight: 1.6,
        letterSpacing: 0.3,
        padding: { top: 12, bottom: 12 },
        minimap: { enabled: true, scale: 1, renderCharacters: true },
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
        wordBasedSuggestions: 'matchingDocuments',
        renderWhitespace: 'selection',
        renderControlCharacters: true,
        renderLineHighlight: 'all',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        matchBrackets: 'always',
        guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'languageDefined',
        codeLens: { enabled: true },
        semanticHighlighting: { enabled: true },
        // Ниже — то, что реально даёт ощущение "взрослой" IDE:
        stickyScroll: { enabled: true },              // прилипающий заголовок текущего блока при скролле
        inlayHints: { enabled: 'on' },                 // подсказки типов серым прямо в коде (как в IntelliJ)
        folding: true,
        foldingStrategy: 'indentation',
        showFoldingControls: 'mouseover',
        occurrencesHighlight: 'singleFile',            // подсветка всех вхождений выделенного слова
        linkedEditing: true,                            // синхронное переименование парных HTML/Vue тегов
        multiCursorModifier: 'ctrlCmd',
        find: { seedSearchStringFromSelection: 'always', autoFindInSelection: 'multiline' },
        overviewRulerBorder: false,
    })

    // Регистрируем провайдеры (для .vue — кастомные, для .ts/.js реальный TS-сервис уже работает сам)
    registerCompletionProviders(monaco, fs)
    registerIntelliSense(monaco, vfs)

    // Регистрируем команды и горячие клавиши
    registerApiCommands(editor, monaco, api, fs, vfs)
    registerKeybindings(editor, monaco, options?.onSave)

    const ctx: MonacoContext = {
        editor,
        monaco,
        fs,
        vfs,
        api,
        refreshTypes
    }

    return ctx
}

// Горячие клавиши уровня "нормальной IDE"
function registerKeybindings(
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: typeof monaco,
    onSave?: () => void
) {
    // Ctrl+S / Cmd+S — сохранение. Само сохранение (запрос к API) делает вызывающий
    // компонент через колбэк onSave — редактор про бэкенд ничего не знает.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave?.()
    })

    // Shift+Alt+F — форматирование документа (использует встроенный форматтер:
    // для JSON/CSS/HTML он полноценный, для TS/JS — форматтер из самого TS-компилятора)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        editor.getAction('editor.action.formatDocument')?.run()
    })

    // Ctrl+/ и Ctrl+D уже работают из коробки (toggle comment / select next occurrence)
}

// Регистрация API команд
function registerApiCommands(
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: typeof monaco,
    api: ApiService,
    fs: FileSystem,
    vfs: VirtualFileSystem
) {
    // Команда: загрузить файлы из БД (ручное действие пользователя из контекстного меню —
    // это осознанный поход в сеть по запросу, не автоматический на каждый маунт)
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