import * as Babel from '@babel/standalone'
import presetTypeScript from '@babel/preset-typescript'
import MoloSelect from "~~/app/components/MoloSelect.vue";
import {useModulesStore} from "~~/stores/moduleStore";
import MoloInput from "~~/app/components/MoloInput.vue";

// Транспиляция TypeScript в JavaScript
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
const createSandboxContext = () => {
    const context: any = {
        // Глобальные объекты
        console: {
            log: (...args: any[]) => console.log('[MODULE]', ...args),
            error: (...args: any[]) => console.error('[MODULE]', ...args),
            warn: (...args: any[]) => console.warn('[MODULE]', ...args),
            info: (...args: any[]) => console.info('[MODULE]', ...args),
            debug: (...args: any[]) => console.debug('[MODULE]', ...args),
            table: (data: any) => console.table(data),
            time: (label: string) => console.time(label),
            timeEnd: (label: string) => console.timeEnd(label),
        },

        // Таймеры
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,

        // Fetch API
        fetch: fetch,

        // URL и пути
        URL: URL,
        URLSearchParams: URLSearchParams,

        // JSON
        JSON: JSON,

        // Математика
        Math: Math,
        Date: Date,

        // Обработка ошибок
        Error: Error,
        TypeError: TypeError,

        // Promise
        Promise: Promise,

        // Массивы и объекты
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,

        // Регулярные выражения
        RegExp: RegExp,

        // Map, Set, WeakMap, WeakSet
        Map: Map,
        Set: Set,
        WeakMap: WeakMap,
        WeakSet: WeakSet,

        // Буфер (эмуляция)
        Buffer: {
            from: (data: any) => {
                if (typeof data === 'string') return new TextEncoder().encode(data)
                return new Uint8Array(data)
            },
            isBuffer: () => false
        },

        // Crypto (Web Crypto API)
        crypto: window.crypto,

        // LocalStorage
        localStorage: localStorage,
        sessionStorage: sessionStorage,

        // Ваши глобальные утилиты
        useNotifications: () => useNotifications(),
        useWindowManager: () => useWindowManager(),
        useModulesStore: () => useModulesStore(),

        // Ваши компоненты
        MoloInput: MoloInput,
        MoloSelect: MoloSelect,
    }

    return context
}

// Выполнение кода в изолированной среде
export const executeScript = async (
    code: string,
    format: 'js' | 'ts' ,
    options?: {
        onLog?: (args: any[]) => void
        onError?: (error: Error) => void
    }
): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        try {
            // Транспилируем TS в JS если нужно
            let executableCode = code
            if (format === 'ts') {
                executableCode = transpileTypeScript(code)
            }

            // Создаем контекст
            const sandbox = createSandboxContext()

            // Добавляем перехватчики логов если нужно
            if (options?.onLog) {
                const originalLog = sandbox.console.log
                sandbox.console.log = (...args: any[]) => {
                    options.onLog?.(args)
                    originalLog(...args)
                }
            }

            // Создаем функцию из кода с доступом к sandbox
            const functionBody = `
        return (async () => {
          ${executableCode}
          
          // Автоматический экспорт
          const __exports = {};
          
          // Если есть module.exports
          if (typeof module !== 'undefined' && module.exports) {
            Object.assign(__exports, module.exports);
          }
          
          // Если есть export default
          if (typeof exports !== 'undefined') {
            Object.assign(__exports, exports);
          }
          
          // Проверяем наличие функции main
          if (typeof main === 'function') {
            const result = await main();
            if (result !== undefined) __exports.main = result;
          }
          
          // Проверяем наличие функции init
          if (typeof init === 'function') {
            const result = await init();
            if (result !== undefined) __exports.init = result;
          }
          
          // Проверяем наличие функции run
          if (typeof run === 'function') {
            const result = await run();
            if (result !== undefined) __exports.run = result;
          }
          
          // Проверяем наличие функции start
          if (typeof start === 'function') {
            const result = await start();
            if (result !== undefined) __exports.start = result;
          }
          
          return __exports;
        })()
      `

            // Создаем функцию с параметрами из sandbox
            const paramNames = Object.keys(sandbox)
            const paramValues = Object.values(sandbox)

            const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor
            const executor = new AsyncFunction(...paramNames, functionBody)

            // Выполняем
            const result = await executor(...paramValues)

            // Если результат - это функция или класс, возвращаем его для дальнейшего использования
            if (typeof result === 'function' || typeof result === 'object') {
                resolve(result)
            } else {
                resolve({ exports: result, success: true })
            }

        } catch (error) {
            console.error('Script execution error:', error)
            options?.onError?.(error as Error)
            reject(error)
        }
    })
}

// Для запуска в фоне (без UI)
export const executeScriptBackground = async (
    code: string,
    format: 'js' | 'ts'
): Promise<any> => {
    return executeScript(code, format, {
        onLog: (args) => console.log('[Background Module]', ...args),
        onError: (error) => console.error('[Background Module Error]', error)
    })
}