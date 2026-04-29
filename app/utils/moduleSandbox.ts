// server/utils/moduleSandbox.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_ROOT = path.join(process.cwd(), '.data', 'isolated-modules');

// Простой логгер для сервера (не используем useLogger)
const serverLogger = {
    info: (msg: string) => console.log(`[ModuleSandbox] ℹ️ ${msg}`),
    error: (msg: string) => console.error(`[ModuleSandbox] ❌ ${msg}`),
    success: (msg: string) => console.log(`[ModuleSandbox] ✅ ${msg}`)
};

async function ensureDirectories() {
    await fs.mkdir(MODULES_ROOT, { recursive: true });
}

export class ModuleSandbox {
    private moduleDir: string;
    private nodeModulesDir: string;
    private moduleId: string;
    private enterpriseId: string;
    private module: any;

    constructor(moduleId: string, enterpriseId: string) {
        this.moduleId = moduleId;
        this.enterpriseId = enterpriseId;
        this.moduleDir = path.join(MODULES_ROOT, enterpriseId, moduleId);
        this.nodeModulesDir = path.join(this.moduleDir, 'node_modules');
    }

    async prepare() {
        await ensureDirectories();
        await fs.mkdir(this.moduleDir, { recursive: true });

        // Динамический импорт модели (избегаем циклических зависимостей)
        const { DynamicModule } = await import('~~/server/models/dynamicModules.model');
        this.module = await DynamicModule.findById(this.moduleId);

        if (!this.module) {
            serverLogger.error(`Module ${this.moduleId} not found`);
            throw new Error(`Module ${this.moduleId} not found`);
        }

        return await this.installDependencies();
    }

    private async installDependencies() {
        // Получаем зависимости из Map или обычного объекта
        const deps = this.module.dependencies instanceof Map
            ? Object.fromEntries(this.module.dependencies)
            : (this.module.dependencies || {});

        const hasDeps = Object.keys(deps).length > 0;

        const pkgJson = {
            name: `module-${this.moduleId}`,
            version: this.module.version || '1.0.0',
            type: "module",
            dependencies: deps,
            devDependencies: this.module.devDependencies instanceof Map
                ? Object.fromEntries(this.module.devDependencies)
                : (this.module.devDependencies || {})
        };

        const pkgPath = path.join(this.moduleDir, 'package.json');
        await fs.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2));

        const lockFile = path.join(this.moduleDir, '.installed');
        const isInstalled = await fs.access(lockFile).then(() => true).catch(() => false);

        if (hasDeps && !isInstalled) {
            serverLogger.info(`Installing dependencies for module ${this.moduleId}`);

            try {
                await execAsync(`npm install --omit=dev --ignore-scripts --no-audit --no-fund`, {
                    cwd: this.moduleDir,
                    env: { ...process.env, NODE_ENV: 'production' }
                });

                await fs.writeFile(lockFile, Date.now().toString());
                serverLogger.success(`Dependencies installed for module ${this.moduleId}`);
            } catch (error: any) {
                serverLogger.error(`Failed to install dependencies: ${error.message}`);
                throw new Error(`Failed to install dependencies: ${error.message}`);
            }
        }

        return this;
    }

    async loadServerModule() {
        if (!this.module.serverEntry) {
            return null;
        }

        const entryPath = path.join(this.moduleDir, this.module.serverEntry);
        try {
            await fs.access(entryPath);

            // Создаем песочницу для require
            const self = this;
            const sandboxRequire = function(modulePath: string) {
                try {
                    const moduleFullPath = require.resolve(modulePath, { paths: [self.nodeModulesDir] });
                    return require(moduleFullPath);
                } catch {
                    return require(modulePath);
                }
            };

            const moduleContent = await fs.readFile(entryPath, 'utf-8');
            const moduleExports = {};
            const moduleWrapper = new Function('require', 'exports', 'module', '__dirname', '__filename', moduleContent);
            moduleWrapper(sandboxRequire, moduleExports, { exports: moduleExports }, this.moduleDir, entryPath);

            return moduleExports;
        } catch (error) {
            serverLogger.error(`Failed to load server entry: ${error}`);
            return null;
        }
    }

    async getClientBundleUrl() {
        if (this.module && this.module.clientBundlePath) {
            return `/api/modules/${this.moduleId}/client-bundle`;
        }
        return null;
    }

    async cleanup() {
        serverLogger.info(`Cleanup for module ${this.moduleId}`);
    }
}

const sandboxCache = new Map<string, ModuleSandbox>();

export async function getModuleSandbox(moduleId: string, enterpriseId: string): Promise<ModuleSandbox> {
    const cacheKey = `${enterpriseId}:${moduleId}`;
    if (!sandboxCache.has(cacheKey)) {
        const sandbox = new ModuleSandbox(moduleId, enterpriseId);
        await sandbox.prepare();
        sandboxCache.set(cacheKey, sandbox);
    }
    return sandboxCache.get(cacheKey)!;
}