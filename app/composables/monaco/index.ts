// composables/monaco/index.ts
import { createMonaco, getMonacoLanguage, LANGUAGE_MAP } from './bootstrap'
import { EditorManager } from './editor'
import { virtualFS } from './virtualFS'
import type { FileNode } from './filesystem'

export function initMonaco(el: HTMLElement, options?: {
    language?: string
    apiBase?: string
    moduleId?: string
    enterpriseId?: string
    files?: FileNode[]
    // Вызывается по Ctrl+S внутри редактора — прокидывается напрямую в createMonaco.
    onSave?: () => void
}) {
    const ctx = createMonaco(el, {
        language: options?.language || 'typescript',
        apiBase: options?.apiBase || '',
        moduleId: options?.moduleId,
        enterpriseId: options?.enterpriseId,
        files: options?.files,
        onSave: options?.onSave
    })

    const manager = new EditorManager(ctx)
    return {
        ctx,
        manager,
        vfs: ctx.vfs,
        utils: {
            getMonacoLanguage,
            LANGUAGE_MAP
        }
    }
}

// Нормализует данные модуля (formData стора + список доп. файлов) в единый
// формат {path, content, language, isServerFile}, который понимают и FileSystem,
// и VirtualFileSystem, и реальный TS language service (typeSystem.ts).
export function buildEditorFiles(
    main: { code?: string; fileName?: string; format?: string } | null | undefined,
    files: Array<{ path?: string; name?: string; code?: string; format?: string; isServerFile?: boolean }> = []
): FileNode[] {
    const result: FileNode[] = []

    if (main?.code) {
        const mainPath = `${main.fileName || 'module'}.${main.format || 'vue'}`
        result.push({
            path: mainPath,
            content: main.code,
            language: getMonacoLanguage(main.format || 'vue')
        })
    }

    for (const file of files || []) {
        const path = file.path || `${file.name || 'file'}.${file.format || 'js'}`
        result.push({
            path,
            content: file.code || '',
            language: getMonacoLanguage(file.format || 'js'),
            isServerFile: file.isServerFile || false
        })
    }

    return result
}

export { getMonacoLanguage, LANGUAGE_MAP } from './bootstrap'
export { virtualFS } from './virtualFS'
export type { FileNode } from './filesystem'