// server/api/npm/install.post.ts
import {getModuleSandbox} from '~~/app/utils/moduleSandbox'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {moduleId, enterpriseId, forceReinstall = false} = body

    if (!moduleId || !enterpriseId) {
        throw createError({statusCode: 400, message: 'moduleId and enterpriseId are required'})
    }

    try {
        const sandbox = await getModuleSandbox(moduleId, enterpriseId)
        if (forceReinstall) {
            await sandbox.reinstallDependencies()
        } else {
            await sandbox.prepare() // уже включает установку при первом вызове
        }
        return {
            success: true,
            message: forceReinstall ? 'Dependencies reinstalled successfully' : 'Dependencies are ready',
        }
    } catch (error: any) {
        throw createError({statusCode: 500, message: error.message || 'Failed to install dependencies'})
    }
})