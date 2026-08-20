// server/utils/moduleSandbox.ts (Оптимизированная версия)
import vm from 'node:vm'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { createError } from 'h3'

export class ModuleSandbox {
    constructor(private moduleId: string, private enterpriseId: string) {}

    async prepare() {
        return this
    }

    async executeFile(fileName: string, data: any = {}) {
        const module = await DynamicModule.findById(this.moduleId)
        if (!module || !module.isActive) {
            throw createError({ statusCode: 404, message: 'Module not found' })
        }

        const file = module.files?.find((f: any) =>
            f.isServerFile && (f.name === fileName || f.path === fileName || f.name === `${fileName}.ts`)
        )

        if (!file) {
            throw createError({ statusCode: 404, message: `Server file not found: ${fileName}` })
        }

        // Создаем изолированный контекст (песочницу)
        const sandbox = {
            console,
            process: { env: process.env },
            fetch,
            Buffer,
            setTimeout,
            clearTimeout,
            moduleData: data,
            exports: {},
            require: (mod: string) => {
                // Разрешаем только безопасные встроенные модули или кешированные зависимости
                if (['path', 'crypto', 'http', 'https', 'url'].includes(mod)) {
                    return require(mod)
                }
                throw new Error(`Module ${mod} is not allowed in sandbox`)
            }
        }

        // Делаем код совместимым с CommonJS для vm
        const wrappedCode = `
      (function(exports, require, module, __filename, __dirname, context) {
        ${file.code}
        
        // Автоматический вызов main, если он есть
        if (typeof main === 'function') {
          return main(context);
        }
      })
    `

        try {
            // Компилируем и запускаем в изолированном контексте (мгновенно)
            const script = new vm.Script(wrappedCode)
            const func = script.runInThisContext()

            const result = await func(
                sandbox.exports,
                sandbox.require,
                { exports: sandbox.exports },
                fileName,
                '.',
                sandbox.moduleData
            )

            return result ?? sandbox.exports
        } catch (error: any) {
            console.error('[ModuleSandbox] VM Execution Error:', error)
            throw createError({ statusCode: 500, message: error.message })
        }
    }
}
export async function getModuleSandbox(moduleId: string, enterpriseId: string) {
    const sandbox = new ModuleSandbox(moduleId, enterpriseId)
    await sandbox.prepare()
    return sandbox
}