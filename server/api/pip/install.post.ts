import { defineEventHandler, readBody, createError } from 'h3'
import { loadModule } from '~~/server/utils/moduleLookup'
import { ensurePythonEnv } from '~~/server/utils/pythonEnv'

// Ставит pip-зависимости модуля в его venv (кнопка «очистить кеш» → forceReinstall)
export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) || {}
    const { moduleId, enterpriseId, forceReinstall = false } = body

    if (!moduleId || !enterpriseId) {
        throw createError({ statusCode: 400, message: 'moduleId and enterpriseId are required' })
    }

    const mod: any = await loadModule(moduleId, String(enterpriseId), { lean: true })
    if (!mod) {
        throw createError({ statusCode: 404, message: 'Модуль не найден' })
    }

    const deps = mod.dependencies || {}
    const logs: string[] = []
    await ensurePythonEnv(String(mod._id), deps, {
        force: !!forceReinstall,
        log: (text) => logs.push(text.trim())
    })

    const packages = Object.keys(deps)
    return {
        success: true,
        message: packages.length ? 'Пакеты pip успешно установлены' : 'У модуля нет pip-зависимостей',
        packages,
        logs: logs.slice(-200)
    }
})
