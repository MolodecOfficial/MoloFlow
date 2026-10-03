/* eslint-disable */
// app/workers/pyodide.worker.ts
//
// НЕ класть в app/plugins/ — Nuxt автоматически исполнит каждый файл оттуда как плагин (в т.ч. на сервере).
// Подключается из usePythonRuntime.ts через new Worker(new URL(...), { type: 'module' }).
// Весь Python исполняется ЗДЕСЬ — в отдельном потоке без доступа к DOM и localStorage страницы.
//
// Протокол (main -> worker):
//   {type:'init'}
//   {type:'run',   id, entry, files:[{path, code}], dependencies:{name:version}, context}
//   {type:'check', id, code}
// Протокол (worker -> main):
//   {type:'ready'}
//   {type:'stage', id, stage:'runtime'|'packages'|'running'}
//   {type:'log',   id, level:'info'|'error'|'system', text}
//   {type:'result', id, ok, result, hasResult, error?, durationMs}
//   {type:'check-result', id, errors:[{line,column,endLine,endColumn,message}]}
//   {type:'fatal', id, message}

const PYODIDE_VERSION = '0.26.4'
const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/'

// Ctx — глобал воркера. Через any, чтобы не спорить с lib.dom (self там Window).
const ctx: any = self

// Динамический import() работает и в module-, и в classic-воркере (importScripts — только в classic).
// @vite-ignore: адрес внешний, бандлеру его трогать не нужно.
let loadPyodideFn: ((opts: any) => Promise<any>) | null = null
async function getLoadPyodide() {
    if (!loadPyodideFn) {
        const url = PYODIDE_BASE + 'pyodide.mjs'
        const mod: any = await import(/* @vite-ignore */ url)
        loadPyodideFn = mod.loadPyodide
    }
    return loadPyodideFn!
}

const MAX_LOG_LINES = 5000

let pyodide: any = null
let runtimePromise: Promise<void> | null = null
let micropip: any = null
const installed = new Set<string>()
let currentRunId: string | null = null
let logCount = 0

const send = (msg: any) => ctx.postMessage(msg)

function log(level: 'info' | 'error' | 'system', text: string) {
    if (currentRunId == null) return
    if (level !== 'system') {
        logCount++
        if (logCount > MAX_LOG_LINES) {
            if (logCount === MAX_LOG_LINES + 1) {
                send({ type: 'log', id: currentRunId, level: 'system', text: '… вывод обрезан (больше ' + MAX_LOG_LINES + ' строк)' })
            }
            return
        }
    }
    send({ type: 'log', id: currentRunId, level, text })
}

// ---------------------------------------------------------------------------
// Изоляция сети.
// Воркер same-origin, а значит обычный fetch('/api/...') из Python-кода ушёл бы
// с cookie пользователя. Модули можно импортировать из публичного каталога,
// поэтому чужой код не должен ходить на наш бэкенд от имени пользователя.
// Внешние адреса (PyPI, CDN, чужие API) разрешены, но всегда без credentials.
// ---------------------------------------------------------------------------
function isSameOrigin(input: any) {
    try {
        const raw = typeof input === 'string' ? input : (input && input.url) || String(input)
        return new URL(raw, ctx.location.href).origin === ctx.location.origin
    } catch (e) {
        return true // не смогли разобрать — считаем опасным
    }
}

function lockdownNetwork() {
    const nativeFetch = ctx.fetch.bind(self)
    ctx.fetch = (input: any, init?: any) => {
        if (isSameOrigin(input)) {
            return Promise.reject(new TypeError('Запросы на собственный домен заблокированы в Python-песочнице'))
        }
        return nativeFetch(input, Object.assign({}, init, { credentials: 'omit' }))
    }

    const nativeOpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL) {
        if (isSameOrigin(String(url))) {
            throw new Error('Запросы на собственный домен заблокированы в Python-песочнице')
        }
        return nativeOpen.apply(this, arguments as any)
    }
}

// ---------------------------------------------------------------------------
// Python-часть: подготовка файлов, запуск, форматирование ошибок, проверка синтаксиса
// ---------------------------------------------------------------------------
const PY_BOOTSTRAP = String.raw`
import ast, base64, builtins, datetime, importlib, inspect, json, linecache, math, os, shutil, sys, time, traceback

MOLO_DIR = '/home/pyodide/molo_module'
ENTRY_NAMES = ('main', 'handler', 'run')


def _no_input(prompt=''):
    raise EOFError('input() не поддерживается — передавайте данные через context')


builtins.input = _no_input


def molo_prepare(files_json):
    # 1. Выгружаем модули прошлого запуска
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, '__file__', None)
        if f and str(f).startswith(MOLO_DIR):
            del sys.modules[name]

    # 2. УХОДИМ из папки MOLO_DIR, чтобы сбросить блокировку Resource busy!
    base_dir = os.path.dirname(MOLO_DIR)
    os.makedirs(base_dir, exist_ok=True)
    os.chdir(base_dir)

    # 3. Чистим файлы внутри MOLO_DIR без удаления самой корневой точки монтирования
    if os.path.isdir(MOLO_DIR):
        for item in os.listdir(MOLO_DIR):
            item_path = os.path.join(MOLO_DIR, item)
            try:
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.unlink(item_path)
            except Exception:
                pass
    else:
        os.makedirs(MOLO_DIR, exist_ok=True)

    # 4. Записываем свежие файлы
    for f in json.loads(files_json):
        target = os.path.normpath(os.path.join(MOLO_DIR, f['path']))
        if not target.startswith(MOLO_DIR + os.sep) and target != MOLO_DIR:
            continue  # защита от ../../
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8') as fh:
            fh.write(f['code'])

    # 5. Возвращаемся в папку и настраиваем sys.path
    if MOLO_DIR not in sys.path:
        sys.path.insert(0, MOLO_DIR)
    os.chdir(MOLO_DIR)
    linecache.clearcache()
    importlib.invalidate_caches()


def _has_top_level_call(tree, name):
    class Finder(ast.NodeVisitor):
        found = False

        def visit_FunctionDef(self, node): pass
        def visit_AsyncFunctionDef(self, node): pass
        def visit_ClassDef(self, node): pass
        def visit_Lambda(self, node): pass

        def visit_Call(self, node):
            if isinstance(node.func, ast.Name) and node.func.id == name:
                self.found = True
            self.generic_visit(node)

    finder = Finder()
    finder.visit(tree)
    return finder.found


def _to_plain(o):
    if hasattr(o, 'columns') and hasattr(o, 'to_dict'):  # pandas.DataFrame
        try:
            return o.to_dict(orient='records')
        except Exception:
            pass
    if hasattr(o, 'tolist'):  # numpy / pandas.Series
        try:
            return o.tolist()
        except Exception:
            pass
    if isinstance(o, (datetime.date, datetime.datetime, datetime.time)):
        return o.isoformat()
    if isinstance(o, (bytes, bytearray)):
        return base64.b64encode(bytes(o)).decode('ascii')
    return str(o)


def _sanitize(o, depth=0):
    if depth > 50:
        return str(o)
    if o is None or isinstance(o, (bool, int, str)):
        return o
    if isinstance(o, float):
        return o if math.isfinite(o) else None  # NaN/Infinity ломают JSON.parse в браузере
    if isinstance(o, dict):
        return {str(k): _sanitize(v, depth + 1) for k, v in o.items()}
    if isinstance(o, (list, tuple, set, frozenset)):
        return [_sanitize(v, depth + 1) for v in o]
    return _sanitize(_to_plain(o), depth + 1)


def _rel(path):
    return str(path).replace(MOLO_DIR + '/', '')


def _format_error(e):
    frames = [f for f in traceback.extract_tb(e.__traceback__) if str(f.filename).startswith(MOLO_DIR)]
    line = file = column = None
    if isinstance(e, SyntaxError) and e.filename and str(e.filename).startswith(MOLO_DIR):
        line, file, column = e.lineno, e.filename, e.offset
    elif frames:
        line, file = frames[-1].lineno, frames[-1].filename

    parts = []
    if frames:
        parts.append('Traceback (most recent call last):\n')
        parts.extend(traceback.format_list(frames))
    parts.extend(traceback.format_exception_only(type(e), e))
    tb = ''.join(parts).replace(MOLO_DIR + '/', '')

    message = '%s: %s' % (type(e).__name__, e)
    if 'asyncio.run() cannot be called from a running event loop' in str(e):
        tb += '\nПодсказка: в браузере цикл событий уже запущен — используйте top-level await вместо asyncio.run().\n'

    return {
        'type': type(e).__name__,
        'message': message,
        'traceback': tb,
        'line': line,
        'column': column,
        'file': _rel(file) if file else None,
    }


async def molo_run(entry, context_json):
    try:
        ctx = json.loads(context_json or '{}')
        path = os.path.join(MOLO_DIR, entry)
        with open(path, encoding='utf-8') as fh:
            source = fh.read()

        flags = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
        tree = compile(source, path, 'exec', flags=flags | ast.PyCF_ONLY_AST)
        code = compile(tree, path, 'exec', flags=flags)

        ns = {'__name__': '__main__', '__file__': path, 'context': ctx}
        res = eval(code, ns)
        if inspect.isawaitable(res):
            await res

        result = None
        for name in ENTRY_NAMES:
            fn = ns.get(name)
            if not inspect.isfunction(fn):
                continue
            if _has_top_level_call(tree, name):
                break  # автор уже вызвал функцию сам (в том числе в if __name__ == '__main__')
            try:
                params = inspect.signature(fn).parameters.values()
                takes_arg = any(p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD, p.VAR_POSITIONAL) for p in params)
            except (TypeError, ValueError):
                takes_arg = True
            result = fn(ctx) if takes_arg else fn()
            if inspect.isawaitable(result):
                result = await result
            break

        return json.dumps({'ok': True, 'result': _sanitize(result), 'hasResult': result is not None})
    except SystemExit:
        return json.dumps({'ok': True, 'result': None, 'hasResult': False})
    except Exception as e:
        return json.dumps({'ok': False, 'error': _format_error(e)})


def molo_check(source):
    try:
        compile(source, '<module>', 'exec', flags=ast.PyCF_ONLY_AST | ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
        return '[]'
    except SyntaxError as e:
        line = e.lineno or 1
        col = e.offset or 1
        return json.dumps([{
            'line': line,
            'column': col,
            'endLine': getattr(e, 'end_lineno', None) or line,
            'endColumn': getattr(e, 'end_offset', None) or (col + 1),
            'message': e.msg,
        }])
    except Exception:
        return '[]'
`

// ---------------------------------------------------------------------------
async function ensureRuntime(id: string) {
    if (pyodide) return
    if (!runtimePromise) {
        runtimePromise = (async () => {
            send({ type: 'stage', id, stage: 'runtime' })
            const loadPyodide = await getLoadPyodide()
            pyodide = await loadPyodide({ indexURL: PYODIDE_BASE })
            pyodide.setStdout({ batched: (s: string) => log('info', s) })
            pyodide.setStderr({ batched: (s: string) => log('error', s) })
            lockdownNetwork() // ПОСЛЕ loadPyodide: самому загрузчику нужен только CDN
            pyodide.runPython(PY_BOOTSTRAP)
        })()
    }
    await runtimePromise
}

// npm-подобные версии из общей Map зависимостей -> pip-спецификаторы
function toPipSpec(name: string, version: any) {
    const v = String(version || '').trim()
    if (!v || v === 'latest' || v === '*') return name
    if (v.startsWith('^')) return name + '>=' + v.slice(1)
    if (v.startsWith('~')) return name + '~=' + v.slice(1)
    if (/^[<>=!]/.test(v)) return name + v
    return name + '==' + v
}

async function installPackages(source: string, dependencies: Record<string, string>) {
    // 1. Пакеты из каталога Pyodide (numpy, pandas, scipy, ...) находим по import'ам
    await pyodide.loadPackagesFromImports(source, {
        messageCallback: (m: string) => log('system', m),
        errorCallback: (m: string) => log('system', m),
    })

    // 2. Всё остальное, что автор явно указал в зависимостях, — через micropip (PyPI)
    const specs = Object.entries(dependencies || {})
        .map(([n, v]) => toPipSpec(n, v))
        .filter((s: string) => !installed.has(s))
    if (!specs.length) return

    if (!micropip) {
        await pyodide.loadPackage('micropip')
        micropip = pyodide.pyimport('micropip')
    }
    for (const spec of specs) {
        log('system', 'pip install ' + spec)
        await micropip.install(spec)
        installed.add(spec)
    }
}

async function handleRun(msg: any) {
    const { id, entry, files, dependencies, context } = msg
    currentRunId = id
    logCount = 0
    const started = Date.now()

    try {
        await ensureRuntime(id)

        send({ type: 'stage', id, stage: 'packages' })
        const source = files.map((f: any) => f.code).join('\n')
        try {
            await installPackages(source, dependencies)
        } catch (e: any) {
            send({
                type: 'result', id, ok: false, hasResult: false, result: null,
                durationMs: Date.now() - started,
                error: {
                    type: 'InstallError',
                    message: 'Не удалось установить пакет: ' + (e && e.message ? e.message : e),
                    traceback: '', line: null, column: null, file: null,
                },
            })
            return
        }

        send({ type: 'stage', id, stage: 'running' })
        pyodide.globals.get('molo_prepare')(JSON.stringify(files.filter((f: any) => f.path)))
        pyodide.globals.set('__molo_entry', entry)
        pyodide.globals.set('__molo_ctx', JSON.stringify(context == null ? {} : context))

        const raw = await pyodide.runPythonAsync('await molo_run(__molo_entry, __molo_ctx)')
        const envelope = JSON.parse(raw)
        send(Object.assign({ type: 'result', id, durationMs: Date.now() - started }, envelope))
    } finally {
        currentRunId = null
    }
}

async function handleCheck(msg: any) {
    if (!pyodide) {
        send({ type: 'check-result', id: msg.id, errors: [] })
        return
    }
    const raw = pyodide.globals.get('molo_check')(msg.code)
    send({ type: 'check-result', id: msg.id, errors: JSON.parse(raw) })
}

ctx.onmessage = async (ev: MessageEvent) => {
    const msg = ev.data || {}
    try {
        if (msg.type === 'init') {
            await ensureRuntime(msg.id)
            send({ type: 'ready' })
        } else if (msg.type === 'run') {
            await handleRun(msg)
        } else if (msg.type === 'check') {
            await handleCheck(msg)
        }
    } catch (e: any) {
        send({ type: 'fatal', id: msg.id, message: String((e && e.message) || e) })
    }
}

export {}