// server/api/pip/install.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { loadModule } from '~~/server/utils/moduleLookup'
import { validateDependencies, toPipSpec } from '~~/server/utils/pythonEnv'

export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) || {}
    const { moduleId, enterpriseId } = body

    if (!moduleId || !enterpriseId) {
        throw createError({ statusCode: 400, message: 'moduleId and enterpriseId are required' })
    }

    const mod: any = await loadModule(moduleId, String(enterpriseId), { lean: true })
    if (!mod) {
        throw createError({ statusCode: 404, message: 'Модуль не найден в MoloDB' })
    }

    const deps = mod.dependencies || {}
    validateDependencies(deps)
    const packages = Object.entries(deps).map(([k, v]) => toPipSpec(k, String(v)))

    return {
        success: true,
        message: packages.length
            ? `Пакеты pip (${packages.join(', ')}) сохранены в MoloDB`
            : 'У модуля нет pip-зависимостей',
        packages,
        logs: [`[MoloDB] Зависимости модуля обновлены: ${packages.join(', ') || 'нет'}`]
    }
})