// app/utils/moduleSandbox.ts
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { createError } from 'h3'
import { DynamicModule } from '~~/server/models/dynamicModules.model'

const ROOT = path.join(process.cwd(), '.data', 'isolated-modules')

async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true })
}

export class ModuleSandbox {
    private dir: string
    private module: any

    constructor(private moduleId: string, private enterpriseId: string) {
        this.dir = path.join(ROOT, enterpriseId, moduleId)
    }

    async prepare() {
        await ensureDir(this.dir)
        this.module = await DynamicModule.findById(this.moduleId)
        if (!this.module) throw new Error('Module not found')
        await this.ensurePackageJson()
        try {
            await fs.access(path.join(this.dir, 'node_modules'))
        } catch {
            await this.installDependencies()
        }
        return this
    }

    private async ensurePackageJson() {
        const deps = this.module.dependencies instanceof Map
            ? Object.fromEntries(this.module.dependencies)
            : (this.module.dependencies || {})

        const pkg = {
            name: `module-${this.moduleId}`,
            private: true,
            dependencies: deps
        }
        await fs.writeFile(path.join(this.dir, 'package.json'), JSON.stringify(pkg, null, 2))
    }

    async installDependencies() {
        return new Promise<void>((resolve, reject) => {
            exec('npm install --legacy-peer-deps', { cwd: this.dir }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`npm install failed:`, stderr)
                    reject(new Error(`Failed to install dependencies: ${stderr}`))
                } else {
                    console.log(`Dependencies installed for module ${this.moduleId}`)
                    resolve()
                }
            })
        })
    }

    async reinstallDependencies() {
        // Полностью удаляем ВСЁ кроме package.json
        const itemsToDelete = ['node_modules', 'package-lock.json', 'server', 'exec']

        for (const item of itemsToDelete) {
            try {
                await fs.rm(path.join(this.dir, item), { recursive: true, force: true })
            } catch (e) {
                // Игнорируем ошибки если папки нет
            }
        }

        await this.installDependencies()
    }

    async executeFile(fileName: string, data: any = {}) {
        const file = this.module.files?.find((f: any) =>
                f.isServerFile && (
                    f.name === fileName ||
                    f.path === fileName ||
                    f.name === `${fileName}.ts` ||
                    f.name === `${fileName}.js`
                )
        )

        if (!file) {
            throw createError({ statusCode: 404, message: `Server file not found: ${fileName}` })
        }

        const timestamp = Date.now()
        const execDir = path.join(this.dir, 'exec', `run-${timestamp}`)
        await ensureDir(execDir)

        // Создаём package.json с "type": "module" для поддержки ESM
        await fs.writeFile(
            path.join(execDir, 'package.json'),
            JSON.stringify({ type: 'module' })
        )

        // Используем .mjs расширение
        const execFile = path.join(execDir, 'script.mjs')

        // Проверяем, использует ли код import или require
        const hasImports = file.code?.includes('import ')

        let wrappedCode

        if (hasImports) {
            // ESM код - оставляем как есть
            wrappedCode = `
${file.code || ''}

const context = ${JSON.stringify({ data })};

if (typeof main === 'function') {
  try {
    const result = await main(context);
    process.stdout.write(JSON.stringify({ success: true, result }));
  } catch (error) {
    process.stderr.write(error.message || 'Unknown error');
    process.exit(1);
  }
} else {
  process.stdout.write(JSON.stringify({ success: true, warning: 'No main function' }));
}
`
        } else {
            // CJS код с require
            wrappedCode = `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

${file.code || ''}

const context = ${JSON.stringify({ data })};

if (typeof main === 'function') {
  try {
    const result = await main(context);
    process.stdout.write(JSON.stringify({ success: true, result }));
  } catch (error) {
    process.stderr.write(error.message || 'Unknown error');
    process.exit(1);
  }
} else {
  process.stdout.write(JSON.stringify({ success: true, warning: 'No main function' }));
}
`
        }

        await fs.writeFile(execFile, wrappedCode, 'utf-8')

        return new Promise((resolve, reject) => {
            exec(`node "${execFile}"`, {
                cwd: execDir,
                timeout: 30000,
                env: {
                    ...process.env,
                    NODE_PATH: path.join(this.dir, 'node_modules')
                }
            }, async (error, stdout, stderr) => {
                await fs.rm(execDir, { recursive: true, force: true }).catch(() => {})

                if (error || stderr) {
                    const errMsg = stderr || error?.message || 'Unknown error'
                    console.error('[ModuleSandbox] Error:', errMsg)
                    reject(createError({ statusCode: 500, message: errMsg.trim() }))
                    return
                }

                try {
                    const parsed = JSON.parse(stdout)
                    resolve(parsed.result || parsed)
                } catch {
                    resolve({ success: true, output: stdout })
                }
            })
        })
    }
}

export async function getModuleSandbox(moduleId: string, enterpriseId: string) {
    const sandbox = new ModuleSandbox(moduleId, enterpriseId)
    await sandbox.prepare()
    return sandbox
}