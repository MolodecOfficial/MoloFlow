import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const tempDir = path.join(os.tmpdir(), 'npm-cache')

// Создаём временную директорию для кеша
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
}

export default defineEventHandler(async (event) => {
    const { packageName, version } = await readBody(event)

    const cacheKey = `${packageName}@${version}`
    const cacheFile = path.join(tempDir, `${cacheKey.replace(/[@/]/g, '_')}.js`)

    // Проверяем кеш
    if (fs.existsSync(cacheFile)) {
        const code = fs.readFileSync(cacheFile, 'utf-8')
        return { code }
    }

    try {
        // Создаём временную директорию для пакета
        const pkgDir = path.join(tempDir, cacheKey.replace(/[@/]/g, '_'))
        if (!fs.existsSync(pkgDir)) {
            fs.mkdirSync(pkgDir, { recursive: true })

            // Устанавливаем пакет
            execSync(`npm init -y`, { cwd: pkgDir, stdio: 'pipe' })
            execSync(`npm install ${packageName}@${version || 'latest'}`, {
                cwd: pkgDir,
                stdio: 'pipe'
            })
        }

        // Ищем entry point
        const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'node_modules', packageName, 'package.json'), 'utf-8'))
        const entryPoint = pkgJson.module || pkgJson.browser || pkgJson.main || 'index.js'
        const entryPath = path.join(pkgDir, 'node_modules', packageName, entryPoint)

        if (fs.existsSync(entryPath)) {
            let code = fs.readFileSync(entryPath, 'utf-8')

            // Простая обёртка для ESM
            code = `
// Auto-generated proxy for ${packageName}
${code}

// Export
if (typeof module !== 'undefined' && module.exports) {
    if (typeof exports !== 'undefined') {
        Object.assign(exports, module.exports);
    }
}
`
            fs.writeFileSync(cacheFile, code)
            return { code }
        }

        throw new Error('Entry point not found')
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: `Failed to load package: ${error.message}`
        })
    }
})