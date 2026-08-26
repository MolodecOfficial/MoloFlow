// server/utils/moduleSandbox.ts
import vm from 'node:vm'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { createError } from 'h3'

function stripExportKeywords(code: string): string {
    return code
        .replace(/^\s*export\s+default\s+/gm, '')
        .replace(/^\s*export\s+(async\s+function|function|class|const|let|var)/gm, '$1')
        .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
}

function hasTopLevelSelfCall(code: string, fnName: string): boolean {
    const re = new RegExp(`^[ \\t]{0,2}(await\\s+)?${fnName}\\s*\\([^)]*\\)\\s*;?\\s*$`, 'm')
    return re.test(code)
}

export class ModuleSandbox {
    constructor(private moduleId: string, private enterpriseId: string) {}

    async prepare() {
        return this
    }

    private async runCode(rawCode: string, context: any, moduleName?: string) {
        const code = stripExportKeywords(rawCode)
        const skipAutoMain = hasTopLevelSelfCall(code, 'main')
        const skipAutoHandler = hasTopLevelSelfCall(code, 'handler')
        const skipAutoRun = hasTopLevelSelfCall(code, 'run')

        // 🔥 Массив для сбора логов
        const logs: string[] = [];

        const sandbox = {
            console: {
                log: (...args: any[]) => {
                    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
                    logs.push(`[${moduleName || 'Module'}] ${msg}`);
                    // Дублируем в серверную консоль, чтобы видеть в терминале
                    console.log(`[${moduleName || 'Module'}]`, ...args);
                },
                error: (...args: any[]) => {
                    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
                    logs.push(`[${moduleName || 'Module'} ERROR] ${msg}`);
                    console.error(`[${moduleName || 'Module'}]`, ...args);
                },
                warn: (...args: any[]) => {
                    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
                    logs.push(`[${moduleName || 'Module'} WARN] ${msg}`);
                    console.warn(`[${moduleName || 'Module'}]`, ...args);
                },
                info: (...args: any[]) => {
                    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
                    logs.push(`[${moduleName || 'Module'} INFO] ${msg}`);
                    console.info(`[${moduleName || 'Module'}]`, ...args);
                },
                debug: (...args: any[]) => {
                    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
                    logs.push(`[${moduleName || 'Module'} DEBUG] ${msg}`);
                    console.debug(`[${moduleName || 'Module'}]`, ...args);
                },
                table: (data: any) => {
                    const tableStr = JSON.stringify(data, null, 2);
                    logs.push(`[${moduleName || 'Module'} TABLE]\n${tableStr}`);
                    console.table(data);
                },
                time: (label: string) => console.time(label),
                timeEnd: (label: string) => console.timeEnd(label),
            },
            process: { env: process.env },
            fetch,
            Buffer,
            setTimeout,
            clearTimeout,
            moduleData: context,
            exports: {},
            require: (mod: string) => {
                if (['path', 'crypto', 'http', 'https', 'url'].includes(mod)) {
                    return require(mod)
                }
                throw new Error(`Module ${mod} is not allowed in sandbox`)
            }
        }

        const wrappedCode = `
      (function(exports, require, module, __filename, __dirname, context) {
        ${code}
        if (!${skipAutoMain} && typeof main === 'function') {
          return main(context);
        }
        if (!${skipAutoHandler} && typeof handler === 'function') {
          return handler(context);
        }
        if (!${skipAutoRun} && typeof run === 'function') {
          return run(context);
        }
        return exports;
      })
    `

        try {
            const script = new vm.Script(wrappedCode)
            const func = script.runInThisContext()

            const result = await func(
                sandbox.exports,
                sandbox.require,
                { exports: sandbox.exports },
                moduleName || 'module',
                '.',
                sandbox.moduleData
            )

            // 🔥 Возвращаем и результат, и логи
            return { result, logs };
        } catch (error: any) {
            console.error(`[ModuleSandbox] Execution error in "${moduleName}":`, error)
            // Логи ошибок тоже возвращаем
            logs.push(`[${moduleName || 'Module'} ERROR] ${error.message}`);
            throw createError({ statusCode: 500, message: error.message, data: { logs } })
        }
    }

    async runMain(context: any = {}) {
        const module = await DynamicModule.findById(this.moduleId)
        if (!module || !module.isActive) {
            throw createError({ statusCode: 404, message: 'Module not found' })
        }
        if (!module.code || !module.code.trim()) {
            throw createError({ statusCode: 404, message: 'Module has no main code' })
        }
        return this.runCode(module.code, context, module.name)
    }

    async executeFile(fileName: string, data: any = {}) {
        const module = await DynamicModule.findById(this.moduleId)
        if (!module || !module.isActive) {
            throw createError({ statusCode: 404, message: 'Module not found' })
        }

        const file = module.files?.find((f: any) =>
            f.isServerFile && (f.name === fileName || f.path === fileName || f.name === `${fileName}.ts`)
        )

        if (file) {
            return this.runCode(file.code, data, module.name)
        }

        const looksLikeMainEntry =
            !fileName ||
            fileName === 'index' ||
            fileName === 'main' ||
            fileName === module.fileName ||
            fileName === module.name

        if (looksLikeMainEntry && module.code?.trim()) {
            return this.runCode(module.code, data, module.name)
        }

        throw createError({ statusCode: 404, message: `Server file not found: ${fileName}` })
    }
}

export async function getModuleSandbox(moduleId: string, enterpriseId: string) {
    const sandbox = new ModuleSandbox(moduleId, enterpriseId)
    await sandbox.prepare()
    return sandbox
}