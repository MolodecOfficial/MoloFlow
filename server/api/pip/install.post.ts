import { defineEventHandler, readBody, createError } from 'h3'
import { spawn } from 'node:child_process'
import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { moduleId, enterpriseId, forceReinstall = false } = body

    if (!moduleId || !enterpriseId) {
        throw createError({ statusCode: 400, message: 'moduleId and enterpriseId are required' })
    }

    const module = await DynamicModule.findOne({ _id: moduleId, enterpriseId })
    if (!module) {
        throw createError({ statusCode: 404, message: 'Модуль не найден' })
    }

    // Приводим Map / Object к плоскому объекту зависимостей
    const deps = module.dependencies instanceof Map
        ? Object.fromEntries(module.dependencies)
        : (module.dependencies || {})

    const packages = Object.entries(deps).map(([pkg, ver]) => {
        const v = String(ver || '').trim()
        if (!v || v === 'latest' || v === '*') return pkg
        if (/^[<>=!~^]/.test(v)) return `${pkg}${v}`
        return `${pkg}==${v}`
    })

    if (!packages.length) {
        return {
            success: true,
            message: 'У модуля нет pip-зависимостей',
            packages: []
        }
    }

    const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
    const logs: string[] = []

    const installArgs = ['-m', 'pip', 'install', ...packages]
    if (forceReinstall) {
        installArgs.push('--force-reinstall')
    }

    try {
        await new Promise<void>((resolve, reject) => {
            const proc = spawn(pythonCmd, installArgs)

            proc.stdout.on('data', (d) => logs.push(d.toString().trim()))
            proc.stderr.on('data', (d) => logs.push(`[WARN] ${d.toString().trim()}`))

            proc.on('close', (code) => {
                if (code === 0) resolve()
                else reject(new Error(`pip install завершился с кодом ${code}:\n${logs.join('\n')}`))
            })

            proc.on('error', (err) => reject(new Error(`Не удалось запустить pip: ${err.message}`)))
        })

        return {
            success: true,
            message: 'Пакеты pip успешно установлены',
            packages,
            logs
        }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: error.message || 'Ошибка установки pip-пакетов'
        })
    }
})