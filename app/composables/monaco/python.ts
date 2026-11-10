// app/composables/monaco/python.ts
//
// Python в Monaco. Подсветка синтаксиса и отступы уже встроены в monaco-editor
// (basic-languages/python), поэтому здесь только то, чего нет «из коробки»:
//  - сниппеты под контракт main(context) / handler / run
//  - автодополнение импортов из ДРУГИХ файлов модуля (def / class / async def)
//  - hover по функциям и классам модуля (сигнатура + первая строка docstring)
//  - красное подчёркивание синтаксических ошибок (compile() в Pyodide-воркере)
import type * as monaco from 'monaco-editor'
import { usePythonRuntime } from '../compiler/usePythonRuntime'

const PY_KEYWORDS = [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
    'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
]

const PY_BUILTINS = [
    'abs', 'all', 'any', 'bool', 'bytes', 'dict', 'enumerate', 'filter', 'float', 'format', 'frozenset',
    'getattr', 'hasattr', 'int', 'isinstance', 'iter', 'len', 'list', 'map', 'max', 'min', 'next', 'open',
    'print', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 'sorted', 'str', 'sum', 'tuple',
    'type', 'zip'
]

const PY_STDLIB = [
    'asyncio', 'base64', 'collections', 'csv', 'dataclasses', 'datetime', 'decimal', 'functools',
    'hashlib', 'io', 'itertools', 'json', 'math', 'pathlib', 'random', 're', 'statistics', 'string',
    'textwrap', 'time', 'typing', 'uuid'
]

interface Snippet { label: string; detail: string; body: string }

const SNIPPETS: Snippet[] = [
    { label: 'main', detail: 'def main(context)', body: 'def main(context):\n\t${1:# ваш код}\n\treturn $0' },
    { label: 'amain', detail: 'async def main(context)', body: 'async def main(context):\n\t${1:# ваш код}\n\treturn $0' },
    { label: 'handler', detail: 'def handler(context)', body: 'def handler(context):\n\t$0' },
    { label: 'ifmain', detail: 'if __name__ == "__main__"', body: 'if __name__ == "__main__":\n\t$0' },
    { label: 'def', detail: 'функция', body: 'def ${1:name}(${2:args}):\n\t${0:pass}' },
    { label: 'adef', detail: 'async-функция', body: 'async def ${1:name}(${2:args}):\n\t${0:pass}' },
    { label: 'class', detail: 'класс', body: 'class ${1:Name}:\n\tdef __init__(self${2:, args}):\n\t\t${0:pass}' },
    { label: 'dataclass', detail: '@dataclass', body: 'from dataclasses import dataclass\n\n@dataclass\nclass ${1:Name}:\n\t${0:field: str}' },
    { label: 'for', detail: 'for … in …', body: 'for ${1:item} in ${2:items}:\n\t$0' },
    { label: 'try', detail: 'try / except', body: 'try:\n\t$1\nexcept ${2:Exception} as e:\n\t${0:raise}' },
    { label: 'with', detail: 'with open(…)', body: 'with open(${1:"data.json"}, encoding="utf-8") as f:\n\t$0' },
    {
        label: 'pyfetch',
        detail: 'HTTP-запрос из браузера',
        body: 'from pyodide.http import pyfetch\n\nresponse = await pyfetch(${1:"https://api.example.com"})\ndata = await response.json()\n$0'
    },
    { label: 'pandas', detail: 'import pandas', body: 'import pandas as pd\n$0' },
    { label: 'numpy', detail: 'import numpy', body: 'import numpy as np\n$0' }
]

interface Symbol { name: string; kind: 'function' | 'class'; signature: string; doc: string; file: string }

// Разбор def/class верхнего уровня обычными регулярками: для автодополнения и hover этого
// достаточно, а полноценный разбор (jedi) тащил бы лишние мегабайты в браузер.
function parseSymbols(source: string, file: string): Symbol[] {
    const out: Symbol[] = []
    const lines = source.split('\n')
    const re = /^(async\s+def|def|class)\s+([A-Za-z_]\w*)\s*(\([^)]*\))?/

    for (let i = 0; i < lines.length; i++) {
        const m = re.exec(lines[i])
        if (!m) continue
        const [, kw, name, args = ''] = m
        if (name.startsWith('_') && !name.startsWith('__')) continue

        let doc = ''
        const next = (lines[i + 1] || '').trim()
        const dm = /^(?:"""|''')(.*?)(?:"""|''')?$/.exec(next)
        if (dm) doc = dm[1].trim()

        out.push({
            name,
            kind: kw === 'class' ? 'class' : 'function',
            signature: `${kw.replace(/\s+/g, ' ')} ${name}${args}`,
            doc,
            file
        })
    }
    return out
}

// Файлы модуля = все python-модели в Monaco (VirtualFileSystem создаёт по модели на файл).
function collectProjectSymbols(m: typeof monaco, current: monaco.editor.ITextModel): Symbol[] {
    const result: Symbol[] = []
    const seen = new Set<string>()

    for (const model of m.editor.getModels()) {
        if (model.id === current.id) continue
        if (model.getLanguageId() !== 'python') continue
        const file = model.uri.path.replace(/^\//, '')
        for (const s of parseSymbols(model.getValue(), file)) {
            const key = `${file}:${s.name}`
            if (seen.has(key)) continue
            seen.add(key)
            result.push(s)
        }
    }
    return result
}

function moduleNameFromFile(file: string): string {
    return file.replace(/\.py$/, '').replace(/\//g, '.')
}

let providersRegistered = false

export function registerPythonSupport(m: typeof monaco) {
    if (providersRegistered) return
    providersRegistered = true

    m.languages.registerCompletionItemProvider('python', {
        triggerCharacters: ['.'],
        provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position)
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            }
            const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
            const K = m.languages.CompletionItemKind
            const suggestions: monaco.languages.CompletionItem[] = []

            // `import ` / `from ` — предлагаем модули (stdlib + файлы этого модуля)
            if (/^\s*(import|from)\s+[\w.]*$/.test(line)) {
                for (const name of PY_STDLIB) {
                    suggestions.push({ label: name, kind: K.Module, insertText: name, range, detail: 'stdlib', sortText: '1' })
                }
                const files = new Set(collectProjectSymbols(m, model).map(s => s.file))
                for (const file of files) {
                    const mod = moduleNameFromFile(file)
                    suggestions.push({
                        label: mod, kind: K.File, insertText: mod, range,
                        detail: `файл модуля: ${file}`, sortText: '0'
                    })
                }
                return { suggestions }
            }

            // `from utils import <имя>` — имена из этого файла
            const fromImport = /^\s*from\s+([\w.]+)\s+import\s+[\w,\s]*$/.exec(line)
            if (fromImport) {
                for (const s of collectProjectSymbols(m, model)) {
                    if (moduleNameFromFile(s.file) !== fromImport[1]) continue
                    suggestions.push({
                        label: s.name,
                        kind: s.kind === 'class' ? K.Class : K.Function,
                        insertText: s.name, range, detail: s.signature,
                        documentation: s.doc || undefined, sortText: '0'
                    })
                }
                return { suggestions }
            }

            for (const sn of SNIPPETS) {
                suggestions.push({
                    label: sn.label, kind: K.Snippet, detail: sn.detail,
                    insertText: sn.body,
                    insertTextRules: m.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range, sortText: '2'
                })
            }
            for (const name of PY_BUILTINS) {
                suggestions.push({ label: name, kind: K.Function, insertText: name, range, detail: 'builtin', sortText: '3' })
            }
            for (const name of PY_KEYWORDS) {
                suggestions.push({ label: name, kind: K.Keyword, insertText: name, range, sortText: '4' })
            }
            suggestions.push({
                label: 'context', kind: K.Variable, insertText: 'context', range,
                detail: 'dict — данные, переданные при запуске', sortText: '0'
            })

            // Функции и классы из соседних файлов — с автоматическим импортом в начало файла
            for (const s of collectProjectSymbols(m, model)) {
                suggestions.push({
                    label: s.name,
                    kind: s.kind === 'class' ? K.Class : K.Function,
                    insertText: s.name, range, detail: `${s.signature}  — ${s.file}`,
                    documentation: s.doc || undefined,
                    sortText: '1',
                    additionalTextEdits: [{
                        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                        text: `from ${moduleNameFromFile(s.file)} import ${s.name}\n`
                    }]
                })
            }
            return { suggestions }
        }
    })

    m.languages.registerHoverProvider('python', {
        provideHover(model, position) {
            const word = model.getWordAtPosition(position)
            if (!word) return null

            // Сначала ищем в самом файле, потом в соседних
            const local = parseSymbols(model.getValue(), model.uri.path.replace(/^\//, ''))
            const sym = [...local, ...collectProjectSymbols(m, model)].find(s => s.name === word.word)
            if (!sym) return null

            const contents: monaco.IMarkdownString[] = [{ value: '```python\n' + sym.signature + '\n```' }]
            if (sym.doc) contents.push({ value: sym.doc })
            contents.push({ value: `*${sym.file}*` })
            return { contents }
        }
    })
}

/**
 * Подчёркивает синтаксические ошибки Python красным.
 * Сам рантайм не запускает: пока Pyodide не загружен, проверка молча пропускается,
 * а первое изменение Python-файла инициирует его фоновую загрузку.
 */
export function attachPythonDiagnostics(m: typeof monaco, editor: monaco.editor.IStandaloneCodeEditor) {
    const runtime = usePythonRuntime()
    let timer: ReturnType<typeof setTimeout> | null = null
    let version = 0

    const clear = (model: monaco.editor.ITextModel) => m.editor.setModelMarkers(model, 'molo-python', [])

    const schedule = () => {
        const model = editor.getModel()
        if (!model) return
        if (model.getLanguageId() !== 'python') {
            clear(model)
            return
        }

        if (!runtime.runtimeReady.value) {
            // как только рантайм догрузится — сразу проверяем текущий текст
            runtime.warmup().then(() => schedule(), () => {})
        }

        if (timer) clearTimeout(timer)
        timer = setTimeout(async () => {
            const current = ++version
            const errors = await runtime.check(model.getValue())
            if (current !== version || model.isDisposed()) return // пришёл более свежий ввод

            m.editor.setModelMarkers(model, 'molo-python', errors.map(e => ({
                severity: m.MarkerSeverity.Error,
                message: e.message,
                startLineNumber: e.line,
                startColumn: e.column,
                endLineNumber: e.endLine,
                endColumn: Math.max(e.endColumn, e.column + 1),
                source: 'python'
            })))
        }, 500)
    }

    const d1 = editor.onDidChangeModelContent(schedule)
    const d2 = editor.onDidChangeModelLanguage(schedule)
    const d3 = editor.onDidChangeModel(schedule)
    schedule()

    return {
        dispose() {
            if (timer) clearTimeout(timer)
            d1.dispose()
            d2.dispose()
            d3.dispose()
        }
    }
}