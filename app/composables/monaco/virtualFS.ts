// composables/monaco/virtualFS.ts
import type * as monaco from 'monaco-editor'

export class VirtualFileSystem {
    private files = new Map<string, string>()
    private modelCache = new Map<string, monaco.editor.ITextModel>()
    private monacoInstance: typeof monaco | null = null

    constructor(monaco?: typeof monaco) {
        if (monaco) {
            this.monacoInstance = monaco
        }
    }

    setMonaco(monaco: typeof monaco) {
        this.monacoInstance = monaco
    }

    addFile(path: string, content: string, language?: string) {
        const normalizedPath = this.normalizePath(path)
        this.files.set(normalizedPath, content)

        if (this.monacoInstance) {
            this.createModel(normalizedPath, content, language)
        }
    }

    addFiles(files: Array<{ path: string, content: string, language?: string }>) {
        for (const file of files) {
            this.addFile(file.path, file.content, file.language)
        }
    }

    private createModel(path: string, content: string, language?: string) {
        if (!this.monacoInstance) return

        if (this.modelCache.has(path)) {
            const oldModel = this.modelCache.get(path)
            if (oldModel) {
                oldModel.dispose()
            }
            this.modelCache.delete(path)
        }

        const uri = this.monacoInstance.Uri.parse(`file:///${path}`)
        const model = this.monacoInstance.editor.createModel(
            content,
            language || this.getLanguageFromPath(path),
            uri
        )

        this.modelCache.set(path, model)
    }

    private getLanguageFromPath(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase() || ''
        const map: Record<string, string> = {
            vue: 'html',
            js: 'javascript',
            ts: 'typescript',
            json: 'json',
            css: 'css',
            html: 'html'
        }
        return map[ext] || 'plaintext'
    }

    private normalizePath(path: string): string {
        return path.replace(/^\/+/, '').replace(/\\/g, '/')
    }

    getFile(path: string): string | null {
        const normalized = this.normalizePath(path)
        return this.files.get(normalized) || null
    }

    updateFile(path: string, content: string) {
        const normalized = this.normalizePath(path)
        this.files.set(normalized, content)

        if (this.modelCache.has(normalized)) {
            const model = this.modelCache.get(normalized)
            if (model) {
                model.setValue(content)
            }
        }
    }

    deleteFile(path: string) {
        const normalized = this.normalizePath(path)
        this.files.delete(normalized)

        if (this.modelCache.has(normalized)) {
            const model = this.modelCache.get(normalized)
            if (model) {
                model.dispose()
            }
            this.modelCache.delete(normalized)
        }
    }

    getPaths(): string[] {
        return Array.from(this.files.keys())
    }

    listFiles(): Array<{ path: string, content: string }> {
        return Array.from(this.files.entries()).map(([path, content]) => ({
            path,
            content
        }))
    }

    clear() {
        this.files.clear()
        for (const model of this.modelCache.values()) {
            model.dispose()
        }
        this.modelCache.clear()
    }

    async loadFromDB(moduleId: string, enterpriseId: string) {
        try {
            const response = await fetch(
                `/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`
            )
            const data = await response.json()

            if (data.success) {
                this.clear()
                let count = 0

                if (data.mainFile) {
                    this.addFile(
                        data.mainFile.path,
                        data.mainFile.code || '',
                        this.getLanguageFromPath(data.mainFile.path)
                    )
                    count++
                }

                if (data.files) {
                    for (const file of data.files) {
                        this.addFile(
                            file.path,
                            file.code || '',
                            this.getLanguageFromPath(file.path)
                        )
                        count++
                    }
                }

                console.log(`[VirtualFS] Loaded ${count} files from DB for module ${moduleId}`)
            }
        } catch (error) {
            console.error('[VirtualFS] Failed to load from DB:', error)
        }
    }

    async loadModuleFiles(moduleData: any) {
        this.clear()
        let count = 0

        if (moduleData.code) {
            const mainPath = `${moduleData.fileName || 'module'}.${moduleData.format || 'vue'}`
            this.addFile(
                mainPath,
                moduleData.code,
                this.getLanguageFromPath(mainPath)
            )
            count++
        }

        if (moduleData.files) {
            for (const file of moduleData.files) {
                const path = file.path || `${file.name || 'file'}.${file.format || 'js'}`
                this.addFile(
                    path,
                    file.code || '',
                    this.getLanguageFromPath(path)
                )
                count++
            }
        }

        console.log(`[VirtualFS] Loaded ${count} module files`)
    }
}

export const virtualFS = new VirtualFileSystem()