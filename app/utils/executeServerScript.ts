import * as babel from '@babel/standalone';
import presetTypeScript from '@babel/preset-typescript';

export const executeServerScript = async (code: string, format: string, context: any) => {
    let executableCode = code;

    if (format === 'ts') {
        const result = babel.transform(code, {
            presets: [presetTypeScript],
            filename: 'module.ts'
        });
        executableCode = result.code || code;
    }

    // Создаём функцию из кода
    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    const fn = new AsyncFunction('context', `
        try {
            ${executableCode}
            
            // Если есть export default
            if (typeof module !== 'undefined' && module.exports) {
                const handler = module.exports.default || module.exports;
                if (typeof handler === 'function') {
                    return await handler(context.body, context);
                }
                return module.exports;
            }
            
            // Если есть основной export
            if (typeof exports !== 'undefined' && exports.default) {
                if (typeof exports.default === 'function') {
                    return await exports.default(context.body, context);
                }
                return exports.default;
            }
            
            // Если есть функция handler или main
            if (typeof handler === 'function') {
                return await handler(context.body, context);
            }
            if (typeof main === 'function') {
                return await main(context.body, context);
            }
            
            return { success: true, message: 'No handler defined' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    `);

    return await fn(context);
};