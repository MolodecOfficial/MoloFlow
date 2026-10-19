import vm from 'node:vm'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { createError } from 'h3'
import { createSandboxDb } from '~~/server/utils/moloDb/sandboxApi'

export type LogLevel = 'info' | 'success' | 'warning' | 'error'

export interface LogEntry {
    level: LogLevel
    source: string
    text: string
    ts: number
}

export interface ClientAction {
    type: 'openWindow' | 'notify' | 'custom'
    payload: any
}

function rejectPython(format?: string) {
    if (format === 'py') {
        throw createError({ statusCode: 400, message: 'Python-модули выполняются через фоновый демон' })
    }
}

function stripExportKeywords(code: string): string {
    return code
        .replace(/^\s*export\s+default\s+/gm, '')
        .replace(/^\s*export\s+(async\s+function|function|class|const|let|var)/gm, '$1')
        .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
}

function stripComposableImports(code: string): string {
    return code.replace(
        /^\s*import\s+[^;\n]*?from\s+['"][^'"]*(composables|useLogger|useNotifications|useWindowManager)[^'"]*['"]\s*;?\s*$/gm,
        ''
    )
}

function hasTopLevelSelfCall(code: string, fnName: string): boolean {
    const re = new RegExp(`^[ \\t]{0,2}(await\\s+)?${fnName}\\s*\\([^)]*\\)\\s*;?\\s*$`, 'm')
    return re.test(code)
}

function formatArg(a: any): string {
    if (a instanceof Error) return a.stack || a.message
    if (typeof a === 'object' && a !== null) {
        try { return JSON.stringify(a, null, 2) } catch { return String(a) }
    }
    return String(a)
}

function toSerializable(value: any) {
    if (value === undefined) return null
    try {
        return JSON.parse(JSON.stringify(value))
    } catch {
        return String(value)
    }
}

export class ModuleSandbox {
    constructor(private moduleId: string, private enterpriseId: string) {}

    async prepare() {
        return this
    }

    async reinstallDependencies(cleanCache = true) {
        const module = await DynamicModule.findById(this.moduleId)
        if (!module) throw createError({ statusCode: 404, message: 'Module not found' })

        const deps = module.dependencies instanceof Map
            ? Object.fromEntries(module.dependencies)
            : (module.dependencies || {})

        return {
            success: true,
            message: 'Dependencies reinstalled',
            dependencies: deps,
            cleanedCache: cleanCache
        }
    }

    async clearCache() {
        return this.reinstallDependencies(true)
    }

    private async runCode(rawCode: string, context: any, moduleName?: string, sourceName?: string) {
        const code = stripComposableImports(stripExportKeywords(rawCode))
        const skipAutoMain = hasTopLevelSelfCall(code, 'main')
        const skipAutoHandler = hasTopLevelSelfCall(code, 'handler')
        const skipAutoRun = hasTopLevelSelfCall(code, 'run')

        // Имя источника лога берется из имени конкретного файла или модуля
        const defaultSource = sourceName || moduleName || 'Серверный файл'
        const logs: string[] = []
        const entries: LogEntry[] = []
        const actions: ClientAction[] = []

        const push = (level: LogLevel, source: string, args: any[]) => {
            const text = args.map(formatArg).join(' ')
            entries.push({ level, source, text, ts: Date.now() })
            logs.push(`[${source}${level === 'info' ? '' : ' ' + level.toUpperCase()}] ${text}`)
            const fn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log
            fn(`[${source}]`, ...args)
        }

        // Серверный useLogger
        const useLogger = (source?: string) => {
            const src = source || defaultSource
            const addLog = (level: string, ...args: any[]) => {
                const lvl: LogLevel =
                    level === 'warn' ? 'warning'
                        : (['info', 'success', 'warning', 'error'] as string[]).includes(level) ? (level as LogLevel)
                            : 'info'
                push(lvl, src, args)
            }
            return {
                addLog,
                info: (...a: any[]) => addLog('info', ...a),
                success: (...a: any[]) => addLog('success', ...a),
                warn: (...a: any[]) => addLog('warning', ...a),
                warning: (...a: any[]) => addLog('warning', ...a),
                error: (...a: any[]) => addLog('error', ...a),
                debug: (...a: any[]) => addLog('info', ...a)
            }
        }

        // Серверный useWindowManager: перенаправляет открытие окон на клиент
        const useWindowManager = () => ({
            openWindow: (target: string, data?: any) => {
                actions.push({ type: 'openWindow', payload: { target, data } })
            }
        })

        // Серверный useNotifications: перенаправляет уведомления на клиент
        const useNotifications = (src?: string) => ({
            info: (msg: string) => actions.push({ type: 'notify', payload: { message: msg, type: 'info' } }),
            success: (msg: string) => actions.push({ type: 'notify', payload: { message: msg, type: 'success' } }),
            warning: (msg: string) => actions.push({ type: 'notify', payload: { message: msg, type: 'warning' } }),
            error: (msg: string) => actions.push({ type: 'notify', payload: { message: msg, type: 'error' } })
        })

        const sandboxConsole = {
            log: (...a: any[]) => push('info', defaultSource, a),
            info: (...a: any[]) => push('info', defaultSource, a),
            debug: (...a: any[]) => push('info', defaultSource, a),
            warn: (...a: any[]) => push('warning', defaultSource, a),
            error: (...a: any[]) => push('error', defaultSource, a),
            table: (data: any) => push('info', defaultSource, ['TABLE:\n' + formatArg(data)]),
            time: (label: string) => console.time(label),
            timeEnd: (label: string) => console.timeEnd(label)
        }

        // Мини-базы MoloFlow: db('база').коллекция  или  db('база').collection('коллекция')
        const db = createSandboxDb(this.enterpriseId, this.moduleId)
        const useMoloDb = (name: string) => db(name)

        const exportsObj = {}
        const requireFn = (mod: string) => {
            if (['path', 'crypto', 'http', 'https', 'url'].includes(mod)) {
                return require(mod)
            }
            throw new Error(`Module ${mod} is not allowed in sandbox`)
        }

        const wrappedCode = `
      (async function(exports, require, module, __filename, __dirname, context, moduleData, console, useLogger, useWindowManager, useNotifications, fetch, Buffer, setTimeout, clearTimeout, setInterval, clearInterval, db, useMoloDb) {
        ${code}
        if (!${skipAutoMain} && typeof main === 'function') {
          return await main(context);
        }
        if (!${skipAutoHandler} && typeof handler === 'function') {
          return await handler(context);
        }
        if (!${skipAutoRun} && typeof run === 'function') {
          return await run(context);
        }
        return exports;
      })
    `

        try {
            const script = new vm.Script(wrappedCode)
            const func = script.runInThisContext()

            const result = await func(
                exportsObj,
                requireFn,
                { exports: exportsObj },
                sourceName || 'module',
                '.',
                context,
                context,
                sandboxConsole,
                useLogger,
                useWindowManager,
                useNotifications,
                fetch,
                Buffer,
                setTimeout,
                clearTimeout,
                setInterval,
                clearInterval,
                db,
                useMoloDb
            )

            return {
                result: toSerializable(result),
                logs,
                entries,
                actions
            }
        } catch (error: any) {
            console.error(`[ModuleSandbox] Execution error in "${defaultSource}":`, error)
            push('error', defaultSource, [error?.message || String(error)])
            throw createError({
                statusCode: 500,
                message: error?.message || 'Script execution failed',
                data: { logs, entries, actions }
            })
        }
    }

    async runMain(context: any = {}) {
        const module = await DynamicModule.findById(this.moduleId)
        if (!module || !module.isActive) throw createError({ statusCode: 404, message: 'Module not found' })
        if (!module.code?.trim()) throw createError({ statusCode: 404, message: 'Module has no main code' })
        rejectPython(module.format)
        return this.runCode(module.code, context, module.name, module.name)
    }

    async executeFile(fileName: string, data: any = {}) {
        const module = await DynamicModule.findById(this.moduleId)
        if (!module || !module.isActive) throw createError({ statusCode: 404, message: 'Module not found' })

        const file = module.files?.find((f: any) =>
            f.isServerFile && (f.name === fileName || f.path === fileName || f.name === `${fileName}.ts`)
        )

        if (file) {
            rejectPython(file.format)
            const sourceTitle = file.name ? file.name.replace(/\.[^/.]+$/, '') : module.name
            return this.runCode(file.code, data, module.name, sourceTitle)
        }

        const looksLikeMainEntry =
            !fileName ||
            fileName === 'index' ||
            fileName === 'main' ||
            fileName === module.fileName ||
            fileName === module.name

        if (looksLikeMainEntry && module.code?.trim()) {
            rejectPython(module.format)
            return this.runCode(module.code, data, module.name, module.name)
        }

        throw createError({ statusCode: 404, message: `Server file not found: ${fileName}` })
    }
}

export async function getModuleSandbox(moduleId: string, enterpriseId: string) {
    const sandbox = new ModuleSandbox(moduleId, enterpriseId)
    await sandbox.prepare()
    return sandbox
}