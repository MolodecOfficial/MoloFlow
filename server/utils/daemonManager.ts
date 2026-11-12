// server/utils/daemonManager.ts
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { loadModule } from '~~/server/utils/moduleLookup'
import { tenantModels } from '~~/server/utils/tenantDb'
import { issueModuleToken } from '~~/server/utils/moloDb/access'
import { PY_CLIENT_SOURCE } from '~~/server/utils/moloDb/pythonClient'
import { getMoloFlowGatewayPublicUrl, isMoloFlowGatewayConfigured } from '~~/server/utils/moloFlowGateway'

export interface ManagedCloudDaemon {
    pid: number
    moduleId: string
    enterpriseId: string
    name: string
    slug: string
    publicUrl: string
    mode: 'server' | 'gateway' | 'browser'
    logs: string[]
    lastResult: any
    startedAt: number
    lastHeartbeat: number
    running: boolean
    process?: ChildProcessWithoutNullStreams
    manuallyStopped?: boolean
}

const runningDaemons = new Map<string, ManagedCloudDaemon>()
let cachedPythonBin: string | null | undefined = undefined

export function findServerPythonBin(): string | null {
    if (cachedPythonBin !== undefined) return cachedPythonBin
    const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python']
    for (const cmd of candidates) {
        try {
            const res = spawnSync(cmd, ['--version'], { timeout: 3000, encoding: 'utf8' })
            if (res.status === 0 && (res.stdout.includes('Python 3') || res.stderr.includes('Python 3'))) {
                cachedPythonBin = cmd
                return cmd
            }
        } catch {}
    }
    cachedPythonBin = null
    return null
}

// Чистая stdlib-реализация aiogram 3.x для серверного Python (если не установлен через pip)
export const SERVER_AIOGRAM_FALLBACK = `# aiogram/__init__.py
import asyncio, inspect, json, logging, ssl, urllib.error, urllib.request
logger = logging.getLogger("aiogram")

class _AttrDict:
    def __init__(self, data=None):
        data = data or {}
        for k, v in data.items():
            if isinstance(v, dict): setattr(self, k, _AttrDict(v))
            elif isinstance(v, list): setattr(self, k, [_AttrDict(x) if isinstance(x, dict) else x for x in v])
            else: setattr(self, k, v)
        self._raw = data
    def __getattr__(self, item): return None

class User(_AttrDict):
    @property
    def full_name(self):
        first = getattr(self, "first_name", "") or ""
        last = getattr(self, "last_name", "") or ""
        return f"{first} {last}".strip() or getattr(self, "username", "") or "Пользователь"

class Chat(_AttrDict): pass

class Message:
    def __init__(self, raw, bot=None):
        raw = raw or {}
        self._raw = raw
        self.bot = bot
        self.message_id = raw.get("message_id", 0)
        self.date = raw.get("date", 0)
        self.text = raw.get("text")
        self.caption = raw.get("caption")
        self.from_user = User(raw["from"]) if raw.get("from") else None
        self.chat = Chat(raw.get("chat") or {})
        self.reply_to_message = Message(raw["reply_to_message"], bot=bot) if raw.get("reply_to_message") else None
        self.message_thread_id = raw.get("message_thread_id")

    async def answer(self, text, parse_mode=None, **kwargs):
        if not self.bot: return None
        return await self.bot.send_message(chat_id=self.chat.id, text=text, parse_mode=parse_mode, **kwargs)

    async def reply(self, text, parse_mode=None, **kwargs):
        if not self.bot: return None
        return await self.bot.send_message(chat_id=self.chat.id, text=text, parse_mode=parse_mode, reply_to_message_id=self.message_id, **kwargs)

class TelegramAPIServer:
    def __init__(self, base="https://api.telegram.org/bot{token}/{method}", file="https://api.telegram.org/file/bot{token}/{path}"):
        self.base = base
        self.file = file

class AiohttpSession:
    def __init__(self, api=None):
        self.api = api or TelegramAPIServer()
    async def close(self): pass

class Bot:
    def __init__(self, token, session=None, parse_mode=None):
        self.token = str(token or "").strip()
        self.session = session or AiohttpSession()
        self.parse_mode = parse_mode
        self._ssl_ctx = ssl.create_default_context()

    def _build_url(self, method):
        base_tpl = getattr(self.session.api, "base", "https://api.telegram.org/bot{token}/{method}")
        return base_tpl.format(token=self.token, method=method)

    def _sync_call(self, method, payload=None, http_timeout=25):
        url = self._build_url(method)
        req = urllib.request.Request(
            url,
            data=json.dumps(payload or {}, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MoloFlowBot/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=http_timeout, context=self._ssl_ctx) as res:
            data = json.loads(res.read().decode("utf-8") or "{}")
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or f"Telegram error in {method}")
        return data.get("result")

    async def _call(self, method, payload=None, http_timeout=25):
        return await asyncio.to_thread(self._sync_call, method, payload, http_timeout)

    async def get_me(self): return User(await self._call("getMe"))

    async def send_message(self, chat_id, text, parse_mode=None, **kwargs):
        payload = {"chat_id": chat_id, "text": text}
        if parse_mode or self.parse_mode: payload["parse_mode"] = parse_mode or self.parse_mode
        for k, v in kwargs.items():
            if v is not None: payload[k] = v
        return Message(await self._call("sendMessage", payload), bot=self)

    async def delete_webhook(self, drop_pending_updates=False):
        return await self._call("deleteWebhook", {"drop_pending_updates": bool(drop_pending_updates)})

    async def get_updates(self, offset=None, timeout=10, allowed_updates=None):
        payload = {"timeout": timeout}
        if offset is not None: payload["offset"] = offset
        if allowed_updates is not None: payload["allowed_updates"] = allowed_updates
        return await self._call("getUpdates", payload, http_timeout=timeout + 10)

class Command:
    def __init__(self, *commands):
        self.commands = [str(c).lstrip("/").lower() for c in commands]
    def check(self, message: Message) -> bool:
        text = (message.text or message.caption or "").strip()
        if not text.startswith("/"): return False
        cmd = text.split()[0].lstrip("/").split("@")[0].lower()
        return cmd in self.commands

class CommandStart(Command):
    def __init__(self): super().__init__("start")

class _LifecycleHook:
    def __init__(self): self.callbacks = []
    def register(self, fn):
        self.callbacks.append(fn)
        return fn
    def __call__(self, fn): return self.register(fn)

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
        if inspect.isawaitable(res): await res

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
                    if inspect.isawaitable(r): r = await r
                    if not r:
                        matched = False
                        break
            if matched:
                try:
                    res = handler(msg)
                    if inspect.isawaitable(res): await res
                except Exception as e:
                    logger.error(f"Handler error: {e}")
                break

    async def start_polling(self, bot: Bot, drop_pending_updates=False, **kwargs):
        try: await bot.delete_webhook(drop_pending_updates=drop_pending_updates)
        except Exception: pass
        for cb in self.startup.callbacks:
            await self._call_hook(cb, bot)
        offset = None
        errors = 0
        try:
            while True:
                try:
                    updates = await bot.get_updates(offset=offset, timeout=10)
                    errors = 0
                    for upd in updates or []:
                        upd_id = upd.get("update_id")
                        if upd_id is not None: offset = upd_id + 1
                        if upd.get("message"):
                            await self._dispatch_message(Message(upd["message"], bot=bot))
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    errors += 1
                    await asyncio.sleep(min(15, 2 * errors))
        finally:
            for cb in self.shutdown.callbacks:
                try: await self._call_hook(cb, bot)
                except Exception: pass
`

const SERVER_PY_RUNNER = `
import asyncio, inspect, json, os, sys, traceback

work_dir = os.path.abspath(os.path.dirname(__file__))
fallback_dir = os.path.join(work_dir, "_fallback_site")
if work_dir not in sys.path:
    sys.path.insert(0, work_dir)
if fallback_dir not in sys.path:
    sys.path.append(fallback_dir)

entry_file = os.environ.get("MOLO_ENTRY_FILE", "main.py")
context_raw = os.environ.get("MOLO_CONTEXT_JSON", "{}")
is_daemon = os.environ.get("MOLO_IS_DAEMON", "0") == "1"

async def _run():
    ctx = json.loads(context_raw or "{}")
    target = os.path.join(work_dir, entry_file)
    with open(target, "r", encoding="utf-8") as f:
        source = f.read()

    import moloflow_db
    ns = {"__name__": "__molo_runner__", "__file__": target, "context": ctx, "db": moloflow_db.db}
    code = compile(source, target, "exec")
    exec(code, ns)

    for fn_name in ("main", "handler", "run"):
        fn = ns.get(fn_name)
        if inspect.isfunction(fn):
            sig = inspect.signature(fn)
            res = fn(ctx) if len(sig.parameters) > 0 else fn()
            if inspect.isawaitable(res):
                res = await res
            if not is_daemon:
                print("\\n__MOLO_RESULT__:" + json.dumps({"ok": True, "result": res}, ensure_ascii=False, default=str), flush=True)
            return

    if not is_daemon:
        print("\\n__MOLO_RESULT__:" + json.dumps({"ok": True, "result": None}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        tb = traceback.format_exc()
        sys.stderr.write(tb + "\\n")
        if not is_daemon:
            print("\\n__MOLO_RESULT__:" + json.dumps({"ok": False, "error": str(e), "traceback": tb}, ensure_ascii=False), flush=True)
        sys.exit(1)
`

function normalizeSlug(raw: string): string {
    return String(raw || 'module').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'module'
}

function normalizeFileName(raw: string, format = 'py'): string {
    let p = String(raw || 'main.py').trim().replace(/\\/g, '/').replace(/^\.?\/+/, '')
    if (!/\.[a-z0-9]+$/i.test(p)) p += `.${format || 'py'}`
    return p
}

export async function prepareServerPyWorkspace(moduleDoc: any, enterpriseId: string, entryOverride?: string) {
    const workDir = path.join(os.tmpdir(), 'moloflow_server_py', `${enterpriseId}_${moduleDoc._id}`)
    await fs.mkdir(workDir, { recursive: true })

    const mainFile = normalizeFileName(moduleDoc.fileName || 'main', 'py')
    await fs.writeFile(path.join(workDir, mainFile), String(moduleDoc.code || ''), 'utf8')
    if (mainFile !== 'main.py') {
        await fs.writeFile(path.join(workDir, 'main.py'), String(moduleDoc.code || ''), 'utf8')
    }

    for (const f of moduleDoc.files || []) {
        const rel = normalizeFileName(f.path || f.name, f.format || 'py')
        if (rel.includes('..')) continue
        const full = path.join(workDir, rel)
        await fs.mkdir(path.dirname(full), { recursive: true })
        await fs.writeFile(full, String(f.code || ''), 'utf8')
    }

    await fs.writeFile(path.join(workDir, 'moloflow_db.py'), PY_CLIENT_SOURCE, 'utf8')
    await fs.writeFile(path.join(workDir, '_molo_runner.py'), SERVER_PY_RUNNER, 'utf8')

    const aiogramDir = path.join(workDir, '_fallback_site', 'aiogram')
    await fs.mkdir(path.join(aiogramDir, 'client', 'session'), { recursive: true })
    await fs.writeFile(path.join(aiogramDir, '__init__.py'), SERVER_AIOGRAM_FALLBACK, 'utf8')
    await fs.writeFile(path.join(aiogramDir, 'filters.py'), 'from aiogram import Command, CommandStart\n', 'utf8')
    await fs.writeFile(path.join(aiogramDir, 'types.py'), 'from aiogram import Message, User, Chat\n', 'utf8')
    await fs.writeFile(path.join(aiogramDir, 'client', '__init__.py'), '', 'utf8')
    await fs.writeFile(path.join(aiogramDir, 'client', 'telegram.py'), 'from aiogram import TelegramAPIServer\n', 'utf8')
    await fs.writeFile(path.join(aiogramDir, 'client', 'session', '__init__.py'), '', 'utf8')
    await fs.writeFile(path.join(aiogramDir, 'client', 'session', 'aiohttp.py'), 'from aiogram import AiohttpSession\n', 'utf8')

    const entryFile = entryOverride ? normalizeFileName(entryOverride, 'py') : mainFile
    return { workDir, entryFile }
}

export async function stopDaemon(moduleId: string): Promise<boolean> {
    const proc = runningDaemons.get(String(moduleId))
    if (!proc) return false
    proc.manuallyStopped = true
    proc.running = false
    if (proc.process && !proc.process.killed) {
        try { proc.process.kill('SIGTERM') } catch {}
    }
    runningDaemons.delete(String(moduleId))
    return true
}

export function getDaemonStatus(moduleId: string) {
    const proc = runningDaemons.get(String(moduleId))
    return {
        running: !!proc?.running,
        pid: proc?.pid,
        mode: proc?.mode || 'browser',
        publicUrl: proc?.publicUrl || null,
        startedAt: proc?.startedAt,
        lastHeartbeat: proc?.lastHeartbeat,
        lastResult: proc?.lastResult ?? null,
        logs: proc?.logs || []
    }
}

export function listAllDaemons() {
    const list = []
    for (const [mId, proc] of runningDaemons.entries()) {
        if (!proc.running) continue
        list.push({
            moduleId: mId,
            pid: proc.pid,
            mode: proc.mode,
            publicUrl: proc.publicUrl,
            startedAt: proc.startedAt,
            lastHeartbeat: proc.lastHeartbeat,
            running: true,
            logs: proc.logs.slice(-30)
        })
    }
    return list
}

export async function recordDaemonHeartbeat(params: {
    moduleId: string
    enterpriseId: string
    log?: string
    result?: any
    finished?: boolean
}) {
    let proc = runningDaemons.get(params.moduleId)
    if (!proc) {
        proc = {
            pid: 2000 + Math.floor(Math.random() * 7000),
            moduleId: params.moduleId,
            enterpriseId: params.enterpriseId,
            name: 'Python Daemon',
            slug: `py/${params.moduleId}`,
            publicUrl: `/api/x/${params.enterpriseId}/py/${params.moduleId}`,
            mode: 'browser',
            logs: [],
            lastResult: null,
            startedAt: Date.now(),
            lastHeartbeat: Date.now(),
            running: true
        }
        runningDaemons.set(params.moduleId, proc)
    }

    proc.lastHeartbeat = Date.now()
    if (params.log) {
        proc.logs.push(params.log)
        if (proc.logs.length > 500) proc.logs.shift()
    }
    if (params.result !== undefined) {
        proc.lastResult = params.result
    }
    if (params.finished) {
        proc.running = false
        runningDaemons.delete(params.moduleId)
    }
    return { ok: true }
}

export async function startOrRestartDaemon(moduleId: string, enterpriseId: string, context: Record<string, any> = {}) {
    const moduleDoc: any = await loadModule(moduleId, enterpriseId, { lean: true })
    if (!moduleDoc || moduleDoc.format !== 'py') {
        throw new Error('Python-модуль не найден в MoloDB')
    }

    await stopDaemon(String(moduleDoc._id))

    const { MoloEndpoint } = tenantModels(enterpriseId)
    const linkedEndpoint: any = await MoloEndpoint.findOne({
        enterpriseId,
        moduleId: String(moduleDoc._id)
    }).lean()

    const slug = linkedEndpoint?.slug || `py/${normalizeSlug(moduleDoc.fileName || moduleDoc.name)}`
    let publicUrl = `/api/x/${enterpriseId}/${slug}`
    if (isMoloFlowGatewayConfigured()) {
        publicUrl = getMoloFlowGatewayPublicUrl(String(enterpriseId), slug)
    }

    const pyBin = findServerPythonBin()

    // Если на сервере есть Python 3 — запускаем настоящий серверный процесс
    if (pyBin) {
        const { workDir, entryFile } = await prepareServerPyWorkspace(moduleDoc, enterpriseId, linkedEndpoint?.file)
        const dbToken = await issueModuleToken(String(enterpriseId), String(moduleDoc._id))
        const apiBase = (process.env.MOLO_API_URL || `http://127.0.0.1:${process.env.NITRO_PORT || process.env.PORT || '3000'}`).replace(/\/+$/, '')

        const managed: ManagedCloudDaemon = {
            pid: 0,
            moduleId: String(moduleDoc._id),
            enterpriseId: String(enterpriseId),
            name: moduleDoc.name,
            slug,
            publicUrl,
            mode: 'server',
            logs: [],
            lastResult: { status: 'RUNNING', module: moduleDoc.name, publicUrl },
            startedAt: Date.now(),
            lastHeartbeat: Date.now(),
            running: true,
            manuallyStopped: false
        }

        const pushLog = (line: string) => {
            const clean = line.trimEnd()
            if (!clean) return
            managed.lastHeartbeat = Date.now()
            managed.logs.push(clean)
            if (managed.logs.length > 500) managed.logs.shift()
        }

        const spawnChild = () => {
            if (managed.manuallyStopped) return
            const child = spawn(pyBin, ['-u', path.join(workDir, '_molo_runner.py')], {
                cwd: workDir,
                env: {
                    ...process.env,
                    PYTHONIOENCODING: 'utf-8',
                    PYTHONUNBUFFERED: '1',
                    MOLO_API_URL: apiBase,
                    MOLO_DB_TOKEN: dbToken,
                    MOLO_ENTERPRISE_ID: String(enterpriseId),
                    MOLO_ENTRY_FILE: entryFile,
                    MOLO_CONTEXT_JSON: JSON.stringify(context || {}),
                    MOLO_IS_DAEMON: '1'
                }
            })

            managed.process = child
            managed.pid = child.pid || 3000
            managed.running = true
            pushLog(`[Server Python] Запущен процесс «${moduleDoc.name}» (PID: ${managed.pid})`)

            child.stdout.on('data', (chunk) => String(chunk).split('\n').forEach(pushLog))
            child.stderr.on('data', (chunk) => String(chunk).split('\n').forEach(pushLog))

            child.on('exit', (code) => {
                if (managed.manuallyStopped) {
                    managed.running = false
                    return
                }
                pushLog(`[Server Python] Процесс завершился (код ${code}). Перезапуск через 4 сек...`)
                setTimeout(() => {
                    if (!managed.manuallyStopped && runningDaemons.get(String(moduleDoc._id)) === managed) {
                        spawnChild()
                    }
                }, 4000)
            })
        }

        runningDaemons.set(String(moduleDoc._id), managed)
        spawnChild()

        return {
            success: true,
            pid: managed.pid,
            mode: 'server' as const,
            publicUrl,
            startedAt: managed.startedAt,
            logs: managed.logs,
            result: managed.lastResult,
            message: `[Server Python] Модуль запущен (PID: ${managed.pid})`
        }
    }

    // Фолбэк на браузерный воркер, если на хосте нет Python 3
    const pid = 2000 + Math.floor(Math.random() * 7000)
    const managed: ManagedCloudDaemon = {
        pid,
        moduleId: String(moduleDoc._id),
        enterpriseId: String(enterpriseId),
        name: moduleDoc.name,
        slug,
        publicUrl,
        mode: 'browser',
        logs: [`[Gateway] Ссылка активна: ${publicUrl}`],
        lastResult: { status: 'RUNNING', module: moduleDoc.name, publicUrl },
        startedAt: Date.now(),
        lastHeartbeat: Date.now(),
        running: true
    }

    runningDaemons.set(String(moduleDoc._id), managed)

    return {
        success: true,
        pid,
        mode: 'browser' as const,
        publicUrl,
        startedAt: managed.startedAt,
        logs: managed.logs,
        result: managed.lastResult,
        message: `[Gateway] Ссылка активна: ${publicUrl}`
    }
}