/* eslint-disable */
// app/workers/pyodide.worker.ts
// УНИВЕРСАЛЬНАЯ PYTHON 3.12 ПЕСОЧНИЦА В ОПЕРАТИВНОЙ ПАМЯТИ (0 ФАЙЛОВ И ПРОЦЕССОВ НА ПК)

const PYODIDE_VERSION = '0.26.4'
const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/'

const ctx: any = self

let loadPyodideFn: ((opts: any) => Promise<any>) | null = null
async function getLoadPyodide() {
    if (!loadPyodideFn) {
        const url = PYODIDE_BASE + 'pyodide.mjs'
        const mod: any = await import(/* @vite-ignore */ url)
        loadPyodideFn = mod.loadPyodide
    }
    return loadPyodideFn!
}

const MAX_LOG_LINES = 10000

let pyodide: any = null
let runtimePromise: Promise<void> | null = null
let micropip: any = null
const installed = new Set<string>()
let currentRunId: string | null = null
let logCount = 0
let heartbeatTimer: any = null

const send = (msg: any) => ctx.postMessage(msg)

function startWorkerHeartbeat(id: string) {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(() => {
        if (currentRunId === id) {
            send({ type: 'heartbeat', id })
        }
    }, 20000)
}

function stopWorkerHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
    }
}

function log(level: 'info' | 'error' | 'system', text: string) {
    if (currentRunId == null) return
    const clean = String(text || '').trimEnd()
    if (!clean) return
    if (level !== 'system') {
        logCount++
        if (logCount > MAX_LOG_LINES) {
            if (logCount === MAX_LOG_LINES + 1) {
                send({ type: 'log', id: currentRunId, level: 'system', text: '… вывод обрезан (больше ' + MAX_LOG_LINES + ' строк)' })
            }
            return
        }
    }
    // Python logging по умолчанию пишет INFO в stderr — определяем реальный уровень по строке
    let finalLevel = level
    if (level === 'error' && /\b(INFO|DEBUG)\b/.test(clean) && !/\b(ERROR|CRITICAL|Traceback)\b/.test(clean)) {
        finalLevel = 'info'
    }
    send({ type: 'log', id: currentRunId, level: finalLevel, text: clean })
}

// ---------------------------------------------------------------------------
// 1. Универсальный клиент MoloDB
// ---------------------------------------------------------------------------
const MOLOFLOW_DB_PY = String.raw`
import asyncio
import json
from js import XMLHttpRequest
from pyodide.http import pyfetch

class MoloDBError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status

class Collection:
    def __init__(self, client, db_name, col_name):
        self._client = client
        self._db = db_name
        self._name = col_name

    def _call_sync(self, body):
        return self._client._request_sync(self._db, self._name, body)

    async def _call_async(self, body):
        return await self._client._request_async(self._db, self._name, body)

    @staticmethod
    def _target(t):
        return {"id": t} if isinstance(t, str) else {"filter": t or {}}

    # Синхронные методы
    def find(self, filter=None, sort=None, limit=50, skip=0, search=None):
        body = {"op": "find", "filter": filter or {}, "limit": limit, "skip": skip, "withTotal": False}
        if sort: body["sort"] = sort
        if search: body["search"] = search
        return self._call_sync(body).get("items", [])

    def page(self, filter=None, sort=None, limit=50, skip=0, search=None):
        body = {"op": "find", "filter": filter or {}, "limit": limit, "skip": skip}
        if sort: body["sort"] = sort
        if search: body["search"] = search
        r = self._call_sync(body)
        return {"items": r.get("items", []), "total": r.get("total"), "limit": r.get("limit"), "skip": r.get("skip")}

    def find_one(self, filter=None, sort=None):
        body = {"op": "findOne", "filter": filter or {}}
        if sort: body["sort"] = sort
        return self._call_sync(body).get("item")

    def get(self, id):
        return self._call_sync({"op": "get", "id": id}).get("item")

    def count(self, filter=None):
        return self._call_sync({"op": "count", "filter": filter or {}}).get("count", 0)

    def insert(self, doc):
        return self._call_sync({"op": "insert", "doc": doc}).get("item")

    def insert_many(self, docs):
        return self._call_sync({"op": "insertMany", "docs": docs}).get("items", [])

    def update(self, target, patch=None, inc=None, unset=None, many=False, upsert=False):
        body = {"op": "update", "patch": patch or {}, "many": many, "upsert": upsert, **self._target(target)}
        if inc: body["inc"] = inc
        if unset: body["unset"] = unset
        r = self._call_sync(body)
        r.pop("success", None)
        return r

    def delete(self, target, many=False):
        r = self._call_sync({"op": "delete", "many": many, **self._target(target)})
        r.pop("success", None)
        return r

    def clear(self):
        r = self._call_sync({"op": "delete", "filter": {}, "many": True, "all": True})
        r.pop("success", None)
        return r

    # Асинхронные методы
    async def afind(self, filter=None, sort=None, limit=50, skip=0, search=None):
        body = {"op": "find", "filter": filter or {}, "limit": limit, "skip": skip, "withTotal": False}
        if sort: body["sort"] = sort
        if search: body["search"] = search
        res = await self._call_async(body)
        return res.get("items", [])

    async def apage(self, filter=None, sort=None, limit=50, skip=0, search=None):
        body = {"op": "find", "filter": filter or {}, "limit": limit, "skip": skip}
        if sort: body["sort"] = sort
        if search: body["search"] = search
        r = await self._call_async(body)
        return {"items": r.get("items", []), "total": r.get("total"), "limit": r.get("limit"), "skip": r.get("skip")}

    async def afind_one(self, filter=None, sort=None):
        body = {"op": "findOne", "filter": filter or {}}
        if sort: body["sort"] = sort
        res = await self._call_async(body)
        return res.get("item")

    async def aget(self, id):
        res = await self._call_async({"op": "get", "id": id})
        return res.get("item")

    async def acount(self, filter=None):
        res = await self._call_async({"op": "count", "filter": filter or {}})
        return res.get("count", 0)

    async def ainsert(self, doc):
        res = await self._call_async({"op": "insert", "doc": doc})
        return res.get("item")

    async def ainsert_many(self, docs):
        res = await self._call_async({"op": "insertMany", "docs": docs})
        return res.get("items", [])

    async def aupdate(self, target, patch=None, inc=None, unset=None, many=False, upsert=False):
        body = {"op": "update", "patch": patch or {}, "many": many, "upsert": upsert, **self._target(target)}
        if inc: body["inc"] = inc
        if unset: body["unset"] = unset
        r = await self._call_async(body)
        r.pop("success", None)
        return r

    async def adelete(self, target, many=False):
        r = await self._call_async({"op": "delete", "many": many, **self._target(target)})
        r.pop("success", None)
        return r

class Database:
    def __init__(self, client, name):
        self._client = client
        self._name = name

    def collection(self, name):
        return Collection(self._client, self._name, name)

    __getitem__ = collection

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return self.collection(name)

class MoloDB:
    def __init__(self):
        self.enterprise = ""
        self.headers = {}

    def configure(self, enterprise_id, headers_dict):
        self.enterprise = str(enterprise_id or "")
        self.headers = dict(headers_dict or {})

    def __call__(self, name):
        return Database(self, name)

    def _url(self, db_name, col_name):
        if not self.enterprise:
            raise MoloDBError("Предприятие не выбрано (нет enterpriseId)")
        return f"/api/enterprises/{self.enterprise}/moloDb/{db_name}/{col_name}"

    def _request_sync(self, db_name, col_name, body):
        url = self._url(db_name, col_name)
        xhr = XMLHttpRequest.new()
        xhr.open("POST", url, False)
        xhr.setRequestHeader("Content-Type", "application/json")
        for k, v in self.headers.items():
            if v: xhr.setRequestHeader(str(k), str(v))
        xhr.send(json.dumps(body, ensure_ascii=False))
        if 200 <= xhr.status < 300:
            return json.loads(xhr.responseText or "{}")
        try:
            err = json.loads(xhr.responseText or "{}")
            msg = err.get("message") or err.get("statusMessage") or f"HTTP {xhr.status}"
        except Exception:
            msg = f"HTTP {xhr.status}"
        raise MoloDBError(msg, xhr.status)

    async def _request_async(self, db_name, col_name, body):
        url = self._url(db_name, col_name)
        req_headers = {"Content-Type": "application/json"}
        for k, v in self.headers.items():
            if v: req_headers[str(k)] = str(v)
        res = await pyfetch(url, method="POST", headers=req_headers, body=json.dumps(body, ensure_ascii=False))
        text = await res.string()
        if 200 <= res.status < 300:
            return json.loads(text or "{}")
        try:
            err = json.loads(text or "{}")
            msg = err.get("message") or err.get("statusMessage") or f"HTTP {res.status}"
        except Exception:
            msg = f"HTTP {res.status}"
        raise MoloDBError(msg, res.status)

db = MoloDB()
`

// ---------------------------------------------------------------------------
// 2. Адаптер aiogram с вечным реконнектом при сбоях сети/прокси
// ---------------------------------------------------------------------------
const AIOGRAM_WASM_SHIM = String.raw`
import asyncio
import inspect
import json
from pyodide.http import pyfetch

class _AttrDict:
    def __init__(self, data=None):
        data = data or {}
        for k, v in data.items():
            if isinstance(v, dict):
                setattr(self, k, _AttrDict(v))
            elif isinstance(v, list):
                setattr(self, k, [_AttrDict(x) if isinstance(x, dict) else x for x in v])
            else:
                setattr(self, k, v)
        self._raw = data

    def __getattr__(self, item):
        return None

class User(_AttrDict):
    @property
    def full_name(self):
        first = getattr(self, "first_name", "") or ""
        last = getattr(self, "last_name", "") or ""
        return f"{first} {last}".strip() or getattr(self, "username", "") or "Пользователь"

class Chat(_AttrDict):
    pass

class Message:
    def __init__(self, raw, bot=None):
        self._raw = raw or {}
        self.bot = bot
        self.message_id = raw.get("message_id", 0)
        self.date = raw.get("date", 0)
        self.text = raw.get("text")
        self.caption = raw.get("caption")
        self.from_user = User(raw["from"]) if "from" in raw else None
        self.chat = Chat(raw.get("chat", {}))
        self.reply_to_message = Message(raw["reply_to_message"], bot=bot) if "reply_to_message" in raw else None
        self.message_thread_id = raw.get("message_thread_id")

    async def answer(self, text, parse_mode=None, **kwargs):
        if not self.bot:
            return None
        return await self.bot.send_message(
            chat_id=self.chat.id,
            text=text,
            parse_mode=parse_mode,
            **kwargs
        )

    async def reply(self, text, parse_mode=None, **kwargs):
        if not self.bot:
            return None
        return await self.bot.send_message(
            chat_id=self.chat.id,
            text=text,
            parse_mode=parse_mode,
            reply_to_message_id=self.message_id,
            **kwargs
        )

class TelegramAPIServer:
    def __init__(self, base="https://api.telegram.org/bot{token}/{method}", file="https://api.telegram.org/file/bot{token}/{path}"):
        self.base = base
        self.file = file

class AiohttpSession:
    def __init__(self, api=None):
        self.api = api or TelegramAPIServer()

    async def close(self):
        pass

class Bot:
    def __init__(self, token, session=None, parse_mode=None):
        self.token = str(token or "").strip()
        self.session = session or AiohttpSession()
        self.parse_mode = parse_mode

    def _build_url(self, method):
        base_tpl = getattr(self.session.api, "base", "https://api.telegram.org/bot{token}/{method}")
        return base_tpl.format(token=self.token, method=method)

    async def _call(self, method, payload=None):
        target_url = self._build_url(method)
        body_str = json.dumps(payload or {}, ensure_ascii=False)
        res = await pyfetch(
            "/api/workspace/api-proxy",
            method="POST",
            headers={"Content-Type": "application/json"},
            body=json.dumps({
                "url": target_url,
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
                "body": body_str
            })
        )
        text_out = await res.string() or "{}"
        try:
            raw_env = json.loads(text_out)
        except Exception:
            raise RuntimeError(f"Proxy parsing error: {text_out[:200]}")

        if res.status >= 400:
            raise RuntimeError(raw_env.get("statusMessage") or raw_env.get("message") or f"Telegram API HTTP {res.status}")
        
        data_text = raw_env.get("text") or "{}"
        data = json.loads(data_text)
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or f"Telegram error in {method}")
        return data.get("result")

    async def get_me(self):
        res = await self._call("getMe")
        return User(res)

    async def send_message(self, chat_id, text, parse_mode=None, **kwargs):
        payload = {"chat_id": chat_id, "text": text}
        if parse_mode or self.parse_mode:
            payload["parse_mode"] = parse_mode or self.parse_mode
        for k, v in kwargs.items():
            if v is not None:
                payload[k] = v
        res = await self._call("sendMessage", payload)
        return Message(res, bot=self)

    async def delete_webhook(self, drop_pending_updates=False):
        return await self._call("deleteWebhook", {"drop_pending_updates": bool(drop_pending_updates)})

    async def get_updates(self, offset=None, timeout=8, allowed_updates=None):
        payload = {"timeout": timeout}
        if offset is not None:
            payload["offset"] = offset
        if allowed_updates is not None:
            payload["allowed_updates"] = allowed_updates
        return await self._call("getUpdates", payload)

class Command:
    def __init__(self, *commands):
        self.commands = [str(c).lstrip("/").lower() for c in commands]

    def check(self, message: Message) -> bool:
        text = (message.text or message.caption or "").strip()
        if not text.startswith("/"):
            return False
        cmd = text.split()[0].lstrip("/").split("@")[0].lower()
        return cmd in self.commands

class CommandStart(Command):
    def __init__(self):
        super().__init__("start")

class _LifecycleHook:
    def __init__(self):
        self.callbacks = []

    def register(self, fn):
        self.callbacks.append(fn)
        return fn

    def __call__(self, fn):
        return self.register(fn)

class Dispatcher:
    def __init__(self):
        self.startup = _LifecycleHook()
        self.shutdown = _LifecycleHook()
        self._message_handlers = []

    def message(self, *filters):
        def decorator(fn):
            self._message_handlers.append((filters, fn))
            return fn
        return decorator

    async def _call_hook(self, cb, bot):
        sig = inspect.signature(cb)
        res = cb(bot) if len(sig.parameters) > 0 else cb()
        if inspect.isawaitable(res):
            await res

    async def _dispatch_message(self, msg: Message):
        for filters, handler in self._message_handlers:
            matched = True
            for flt in filters:
                if hasattr(flt, "check"):
                    if not flt.check(msg):
                        matched = False
                        break
                elif callable(flt):
                    r = flt(msg)
                    if inspect.isawaitable(r):
                        r = await r
                    if not r:
                        matched = False
                        break
            if matched:
                try:
                    res = handler(msg)
                    if inspect.isawaitable(res):
                        await res
                except Exception as handler_err:
                    print(f"[Telegram Handler Error] {handler_err}")
                break

    async def start_polling(self, bot: Bot, drop_pending_updates=False, **kwargs):
        try:
            await bot.delete_webhook(drop_pending_updates=drop_pending_updates)
        except Exception:
            pass

        for cb in self.startup.callbacks:
            try:
                await self._call_hook(cb, bot)
            except Exception as e:
                print(f"[Startup Hook Error] {e}")

        offset = None
        consecutive_errors = 0
        print("[Telegram Bot] Демон запущен. Ожидание сообщений...")

        while True:
            try:
                updates = await bot.get_updates(offset=offset, timeout=8)
                consecutive_errors = 0
                for upd in updates or []:
                    upd_id = upd.get("update_id")
                    if upd_id is not None:
                        offset = upd_id + 1
                    if "message" in upd:
                        msg = Message(upd["message"], bot=bot)
                        await self._dispatch_message(msg)
            except (asyncio.CancelledError, KeyboardInterrupt):
                # Защита от прерывания браузером при сворачивании вкладки
                await asyncio.sleep(1)
                continue
            except BaseException as e:
                consecutive_errors += 1
                backoff = min(15, 1 + consecutive_errors * 2)
                if consecutive_errors == 1 or consecutive_errors % 5 == 0:
                    print(f"[Telegram Polling] Ошибка сети или соединения: {e}. Переподключение через {backoff}с...")
                await asyncio.sleep(backoff)
            await asyncio.sleep(0.3)
`

// ---------------------------------------------------------------------------
// 3. Основной загрузчик Python-окружения
// ---------------------------------------------------------------------------
const PY_BOOTSTRAP = String.raw`
import ast, base64, builtins, datetime, importlib, inspect, json, linecache, logging, math, os, shutil, sys, time, traceback

MOLO_DIR = '/home/pyodide/molo_module'
MOLO_SITE = '/home/pyodide/molo_site_packages'
ENTRY_NAMES = ('main', 'handler', 'run')

def _no_input(prompt=''):
    raise EOFError('input() не поддерживается — передавайте данные через context')

builtins.input = _no_input

def _setup_site_packages(db_code, aiogram_code):
    os.makedirs(MOLO_SITE, exist_ok=True)
    with open(os.path.join(MOLO_SITE, 'moloflow_db.py'), 'w', encoding='utf-8') as f:
        f.write(db_code)

    aiogram_dir = os.path.join(MOLO_SITE, 'aiogram')
    os.makedirs(os.path.join(aiogram_dir, 'client', 'session'), exist_ok=True)
    with open(os.path.join(aiogram_dir, '__init__.py'), 'w', encoding='utf-8') as f:
        f.write(aiogram_code)
    with open(os.path.join(aiogram_dir, 'filters.py'), 'w', encoding='utf-8') as f:
        f.write('from aiogram import Command, CommandStart\n')
    with open(os.path.join(aiogram_dir, 'types.py'), 'w', encoding='utf-8') as f:
        f.write('from aiogram import Message, User, Chat\n')
    with open(os.path.join(aiogram_dir, 'client', '__init__.py'), 'w', encoding='utf-8') as f:
        f.write('')
    with open(os.path.join(aiogram_dir, 'client', 'telegram.py'), 'w', encoding='utf-8') as f:
        f.write('from aiogram import TelegramAPIServer\n')
    with open(os.path.join(aiogram_dir, 'client', 'session', '__init__.py'), 'w', encoding='utf-8') as f:
        f.write('')
    with open(os.path.join(aiogram_dir, 'client', 'session', 'aiohttp.py'), 'w', encoding='utf-8') as f:
        f.write('from aiogram import AiohttpSession\n')

    if MOLO_SITE not in sys.path:
        sys.path.insert(0, MOLO_SITE)

def molo_prepare(files_json, db_code, aiogram_code, enterprise_id, auth_headers_json):
    _setup_site_packages(db_code, aiogram_code)

    for name, mod in list(sys.modules.items()):
        f = getattr(mod, '__file__', None)
        if f and str(f).startswith(MOLO_DIR):
            del sys.modules[name]

    for h in list(logging.root.handlers):
        logging.root.removeHandler(h)

    base_dir = os.path.dirname(MOLO_DIR)
    os.makedirs(base_dir, exist_ok=True)
    os.chdir(base_dir)

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

    for f in json.loads(files_json):
        target = os.path.normpath(os.path.join(MOLO_DIR, f['path']))
        if not target.startswith(MOLO_DIR + os.sep) and target != MOLO_DIR:
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8') as fh:
            fh.write(f['code'])

    if MOLO_DIR not in sys.path:
        sys.path.insert(0, MOLO_DIR)
    os.chdir(MOLO_DIR)
    linecache.clearcache()
    importlib.invalidate_caches()

    import moloflow_db
    moloflow_db.db.configure(enterprise_id, json.loads(auth_headers_json or '{}'))

def _to_plain(o):
    if hasattr(o, 'columns') and hasattr(o, 'to_dict'):
        try: return o.to_dict(orient='records')
        except Exception: pass
    if hasattr(o, 'tolist'):
        try: return o.tolist()
        except Exception: pass
    if isinstance(o, (datetime.date, datetime.datetime, datetime.time)):
        return o.isoformat()
    if isinstance(o, (bytes, bytearray)):
        return base64.b64encode(bytes(o)).decode('ascii')
    return str(o)

def _sanitize(o, depth=0):
    if depth > 50: return str(o)
    if o is None or isinstance(o, (bool, int, str)): return o
    if isinstance(o, float): return o if math.isfinite(o) else None
    if isinstance(o, dict): return {str(k): _sanitize(v, depth + 1) for k, v in o.items()}
    if isinstance(o, (list, tuple, set, frozenset)): return [_sanitize(v, depth + 1) for v in o]
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

        import moloflow_db
        flags = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
        tree = compile(source, path, 'exec', flags=flags | ast.PyCF_ONLY_AST)
        code = compile(tree, path, 'exec', flags=flags)

        ns = {'__name__': '__molo_entry__', '__file__': path, 'context': ctx, 'db': moloflow_db.db}
        res = eval(code, ns)
        if inspect.isawaitable(res):
            await res

        result = None
        for name in ENTRY_NAMES:
            fn = ns.get(name)
            if not inspect.isfunction(fn):
                continue
            try:
                params = inspect.signature(fn).parameters.values()
                req_positional = [
                    p for p in params
                    if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD) and p.default is p.empty
                ]
                takes_any = len(params) > 0
            except (TypeError, ValueError):
                req_positional = [1]
                takes_any = True

            result = fn(ctx) if takes_any else fn()
            if inspect.isawaitable(result):
                result = await result
            break

        return json.dumps({'ok': True, 'result': _sanitize(result), 'hasResult': result is not None})
    except SystemExit:
        return json.dumps({'ok': True, 'result': None, 'hasResult': False})
    except (Exception, BaseException) as e:
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

const BUILTIN_SHIMS = new Set(['aiogram', 'moloflow_db', 'asyncio', 'logging', 'typing', 'json', 'os', 'sys'])

async function ensureRuntime(id: string) {
    if (pyodide) return
    if (!runtimePromise) {
        runtimePromise = (async () => {
            send({ type: 'stage', id, stage: 'runtime' })
            const loadPyodide = await getLoadPyodide()
            pyodide = await loadPyodide({ indexURL: PYODIDE_BASE })
            pyodide.setStdout({ batched: (s: string) => log('info', s) })
            pyodide.setStderr({ batched: (s: string) => log('error', s) })
            pyodide.runPython(PY_BOOTSTRAP)
        })()
    }
    await runtimePromise
}

function toPipSpec(name: string, version: any) {
    const v = String(version || '').trim()
    if (!v || v === 'latest' || v === '*') return name
    if (v.startsWith('^')) return name + '>=' + v.slice(1)
    if (v.startsWith('~')) return name + '~=' + v.slice(1)
    if (/^[<>=!]/.test(v)) return name + v
    return name + '==' + v
}

async function installPackages(source: string, dependencies: Record<string, string>) {
    await pyodide.loadPackagesFromImports(source, {
        messageCallback: (m: string) => log('system', m),
        errorCallback: () => {},
    }).catch(() => {})

    const specs = Object.entries(dependencies || {})
        .filter(([n]) => !BUILTIN_SHIMS.has(n.toLowerCase()))
        .map(([n, v]) => toPipSpec(n, v))
        .filter((s: string) => !installed.has(s))
    if (!specs.length) return

    if (!micropip) {
        await pyodide.loadPackage('micropip')
        micropip = pyodide.pyimport('micropip')
    }
    for (const spec of specs) {
        log('system', 'Установка пакета в память: ' + spec)
        await micropip.install(spec)
        installed.add(spec)
    }
}

async function handleRun(msg: any) {
    const { id, entry, files, dependencies, context, enterpriseId, authHeaders } = msg
    currentRunId = id
    logCount = 0
    const started = Date.now()

    startWorkerHeartbeat(id)

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
        pyodide.globals.get('molo_prepare')(
            JSON.stringify(files.filter((f: any) => f.path)),
            MOLOFLOW_DB_PY,
            AIOGRAM_WASM_SHIM,
            String(enterpriseId || ''),
            JSON.stringify(authHeaders || {})
        )
        pyodide.globals.set('__molo_entry', entry)
        pyodide.globals.set('__molo_ctx', JSON.stringify(context == null ? {} : context))

        const raw = await pyodide.runPythonAsync('await molo_run(__molo_entry, __molo_ctx)')
        const envelope = JSON.parse(raw)
        send(Object.assign({ type: 'result', id, durationMs: Date.now() - started }, envelope))
    } finally {
        stopWorkerHeartbeat()
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