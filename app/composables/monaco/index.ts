// composables/monaco/index.ts
import { createMonaco, getMonacoLanguage, LANGUAGE_MAP } from './bootstrap'
import { registerExtensions } from './extensions'
import { EditorManager } from './editor'
import { virtualFS } from './virtualFS' // ← импортируем из virtualFS

export function initMonaco(el: HTMLElement, options?: {
    language?: string
    apiBase?: string
    moduleId?: string
    enterpriseId?: string
    files?: any[]
}) {
    const ctx = createMonaco(el, {
        language: options?.language || 'typescript',
        apiBase: options?.apiBase || '',
        moduleId: options?.moduleId,
        enterpriseId: options?.enterpriseId,
        files: options?.files
    })

    // Сохраняем ссылку на виртуальную FS для использования извне
    if (options?.moduleId && options?.enterpriseId) {
        ctx.vfs.loadFromDB(options.moduleId, options.enterpriseId)
    }

    registerExtensions(ctx)

    const manager = new EditorManager(ctx)

    return {
        ctx,
        manager,
        vfs: ctx.vfs, // Экспортируем для использования в компонентах
        utils: {
            getMonacoLanguage,
            LANGUAGE_MAP
        }
    }
}

// Экспортируем все нужное
export { getMonacoLanguage, LANGUAGE_MAP } from './bootstrap'
export { virtualFS } from './virtualFS' // ← правильный экспорт