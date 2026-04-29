import * as Babel from '@babel/standalone'
import presetTypeScript from '@babel/preset-typescript'
import MoloSelect from "~~/app/components/MoloSelect.vue";
import { useModulesStore } from "~~/stores/moduleStore";
import MoloInput from "~~/app/components/MoloInput.vue";
import { useNotifications } from '~~/app/composables/useNotifications';
import { useLogger } from '~~/app/composables/useLogger';

const runningModules = new Map()

const transpileTypeScript = (code: string): string => {
    try {
        const result = Babel.transform(code, {
            presets: [presetTypeScript],
            filename: 'module.ts',
            configFile: false,
        })
        return result.code || code
    } catch (err) {
        console.error('TypeScript transpilation error:', err)
        return code
    }
}

// Создание изолированного контекста выполнения
const createSandboxContext = (moduleName?: string) => {
    // Устанавливаем глобальную переменную с именем модуля
    if (typeof window !== 'undefined') {
        (window as any).__currentModuleName = moduleName
    }

    const context: any = {
        console: {
            log: (...args: any[]) => console.log(`[${moduleName || 'MODULE'}]`, ...args),
            error: (...args: any[]) => console.error(`[${moduleName || 'MODULE'}]`, ...args),
            warn: (...args: any[]) => console.warn(`[${moduleName || 'MODULE'}]`, ...args),
            info: (...args: any[]) => console.info(`[${moduleName || 'MODULE'}]`, ...args),
            debug: (...args: any[]) => console.debug(`[${moduleName || 'MODULE'}]`, ...args),
            table: (data: any) => console.table(data),
            time: (label: string) => console.time(label),
            timeEnd: (label: string) => console.timeEnd(label),
        },

        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        fetch: fetch,
        URL: URL,
        URLSearchParams: URLSearchParams,
        JSON: JSON,
        Math: Math,
        Date: Date,
        Error: Error,
        TypeError: TypeError,
        Promise: Promise,
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,
        RegExp: RegExp,
        Map: Map,
        Set: Set,
        WeakMap: WeakMap,
        WeakSet: WeakSet,
        Buffer: {
            from: (data: any) => {
                if (typeof data === 'string') return new TextEncoder().encode(data)
                return new Uint8Array(data)
            },
            isBuffer: () => false
        },
        crypto: window.crypto,
        localStorage: localStorage,
        sessionStorage: sessionStorage,

        // Передаем имя модуля в useNotifications
        useNotifications: (source?: string) => useNotifications(source),
        useLogger: (source?: string) => useLogger(source),
        useWindowManager: () => windowManager,
        useModulesStore: () => moduleStore,

        MoloInput: MoloInput,
        MoloSelect: MoloSelect,
    }

    return context
}

// Выполнение кода в изолированной среде
export const executeScript = async (
    code: string,
    format: 'js' | 'ts',
    options?: {
        onLog?: (args: any[]) => void
        onError?: (error: Error) => void
        moduleName?: string
    }
): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        try {
            let executableCode = code
            if (format === 'ts') {
                executableCode = transpileTypeScript(code)
            }

            // Устанавливаем имя модуля глобально перед выполнением
            if (options?.moduleName && typeof window !== 'undefined') {
                (window as any).__currentModuleName = options.moduleName
            }

            const sandbox = createSandboxContext(options?.moduleName)

            if (options?.onLog) {
                const originalLog = sandbox.console.log
                sandbox.console.log = (...args: any[]) => {
                    options.onLog?.(args)
                    originalLog(...args)
                }
            }

            const functionBody = `
        return (async () => {
          ${executableCode}
          
          const __exports = {};
          
          if (typeof module !== 'undefined' && module.exports) {
            Object.assign(__exports, module.exports);
          }
          
          if (typeof exports !== 'undefined') {
            Object.assign(__exports, exports);
          }
          
          if (typeof main === 'function') {
            const result = await main();
            if (result !== undefined) __exports.main = result;
          }
          
          if (typeof init === 'function') {
            const result = await init();
            if (result !== undefined) __exports.init = result;
          }
          
          if (typeof run === 'function') {
            const result = await run();
            if (result !== undefined) __exports.run = result;
          }
          
          if (typeof start === 'function') {
            const result = await start();
            if (result !== undefined) __exports.start = result;
          }
          
          return __exports;
        })()
      `

            const paramNames = Object.keys(sandbox)
            const paramValues = Object.values(sandbox)

            const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor
            const executor = new AsyncFunction(...paramNames, functionBody)

            const result = await executor(...paramValues)

            if (typeof result === 'function' || typeof result === 'object') {
                resolve(result)
            } else {
                resolve({ exports: result, success: true })
            }

        } catch (error) {
            console.error('Script execution error:', error)
            options?.onError?.(error as Error)
            reject(error)
        } finally {
            // Очищаем глобальную переменную после выполнения
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    if ((window as any).__currentModuleName === options?.moduleName) {
                        (window as any).__currentModuleName = null
                    }
                }, 100)
            }
        }
    })
}

export const executeScriptBackground = async (
    code: string,
    format: 'js' | 'ts',
    moduleName?: string
): Promise<any> => {
    return executeScript(code, format, {
        onLog: (args) => console.log(`[Background ${moduleName || 'Module'}]`, ...args),
        onError: (error) => console.error(`[Background ${moduleName || 'Module'} Error]`, error),
        moduleName
    })
}

export const restartScript = async (
    code: string,
    format: 'js' | 'ts',
    moduleId: string,
    moduleName?: string
): Promise<any> => {
    if (runningModules.has(moduleId)) {
        const oldModule = runningModules.get(moduleId)
        if (oldModule && typeof oldModule.destroy === 'function') {
            await oldModule.destroy()
        }
        runningModules.delete(moduleId)
    }

    const result = await executeScriptBackground(code, format, moduleName)
    runningModules.set(moduleId, result)
    return result
}