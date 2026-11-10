export type FileNode = {
    path: string
    content: string
    language?: string
    isServerFile?: boolean
}

export class FileSystem {
    private files = new Map<string, FileNode>()
    private options?: {
        apiBase?: string
        moduleId?: string
        enterpriseId?: string
    }

    constructor(initialFiles: FileNode[] = [], options?: {
        apiBase?: string
        moduleId?: string
        enterpriseId?: string
    }) {
        this.options = options
        initialFiles.forEach(f => this.files.set(this.normalizePath(f.path), { ...f, path: this.normalizePath(f.path) }))
    }

    private normalizePath(path: string): string {
        return String(path || '')
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/^\.\//, '')
            .replace(/^\/+/, '')
    }

    readFile(path: string) {
        return this.files.get(this.normalizePath(path)) || null
    }

    writeFile(path: string, content: string, language = 'typescript') {
        const normalized = this.normalizePath(path)
        this.files.set(normalized, { path: normalized, content, language })
    }

    deleteFile(path: string) {
        this.files.delete(this.normalizePath(path))
    }

    listFiles() {
        return Array.from(this.files.values())
    }

    exists(path: string) {
        return this.files.has(this.normalizePath(path))
    }

    getFilePaths(): string[] {
        return Array.from(this.files.keys())
    }

    // Синхронная замена всего набора файлов БЕЗ похода в сеть.
    // Используется, когда данные уже есть на руках (например, из Pinia-стора),
    // чтобы не дублировать fetch, который уже был сделан в другом месте.
    loadFiles(files: FileNode[]) {
        this.files.clear()
        for (const f of files || []) {
            if (!f || typeof f.path !== 'string') continue
            const path = this.normalizePath(f.path)
            this.files.set(path, { ...f, path })
        }
    }

    // ЗАГРУЗКА ФАЙЛОВ ИЗ БД — оставлена для ручных действий
    // (например, пункт контекстного меню редактора "Load Files from Database").
    // НЕ вызывать автоматически на маунте компонента — для этого есть loadFiles() выше.
    async loadFilesFromDB(moduleId: string, enterpriseId: string) {
        if (!moduleId || !enterpriseId) {
            console.error('[FileSystem] Для загрузки файлов нужны moduleId и enterpriseId')
            return false
        }

        try {
            const response = await fetch(
                `/api/enterprises/${encodeURIComponent(enterpriseId)}/dynamicModules/${encodeURIComponent(moduleId)}/files`
            )
            const data = await response.json().catch(() => null)

            if (!response.ok) {
                console.error('[FileSystem] API вернул ошибку загрузки файлов:', response.status, data)
                return false
            }
            if (!data || data.success !== true) {
                console.error('[FileSystem] Некорректный ответ API при загрузке файлов:', data)
                return false
            }

            const nextFiles: FileNode[] = []
            if (data.mainFile && typeof data.mainFile.path === 'string') {
                const path = this.normalizePath(data.mainFile.path)
                nextFiles.push({
                    path,
                    content: data.mainFile.code || '',
                    language: data.mainFile.format || 'vue',
                    isServerFile: Boolean(data.mainFile.isServerFile)
                })
            }
            if (Array.isArray(data.files)) {
                for (const file of data.files) {
                    if (!file || typeof file.path !== 'string') continue
                    const path = this.normalizePath(file.path)
                    nextFiles.push({
                        path,
                        content: file.code || '',
                        language: file.format || 'vue',
                        isServerFile: Boolean(file.isServerFile)
                    })
                }
            }

            this.loadFiles(nextFiles)
            console.info(`[FileSystem] Загружено файлов: ${this.files.size} (модуль ${moduleId})`)
            return true
        } catch (error) {
            console.error('[FileSystem] Не удалось загрузить файлы из БД:', error)
            return false
        }
    }

    // СОХРАНЕНИЕ ФАЙЛА В БД
    async saveFileToDB(path: string, content: string, language: string) {
        try {
            const moduleId = this.options?.moduleId
            const enterpriseId = this.options?.enterpriseId
            if (!moduleId || !enterpriseId) {
                console.warn('[FileSystem] Для сохранения нужны moduleId и enterpriseId')
                return false
            }

            const normalizedPath = this.normalizePath(path)
            const response = await fetch(
                `/api/enterprises/${encodeURIComponent(enterpriseId)}/dynamicModules/${encodeURIComponent(moduleId)}/files`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Endpoint expects an action + file object, not flat path/code fields.
                    body: JSON.stringify({
                        action: 'update',
                        file: {
                            path: normalizedPath,
                            code: content,
                            format: language,
                            isServerFile: false
                        }
                    })
                }
            )
            const data = await response.json().catch(() => null)
            if (!response.ok || data?.success !== true) {
                console.error('[FileSystem] Не удалось сохранить файл:', response.status, data)
                return false
            }

            this.files.set(normalizedPath, { path: normalizedPath, content, language })
            console.info(`[FileSystem] Файл ${normalizedPath} сохранён`)
            return true
        } catch (error) {
            console.error('[FileSystem] Ошибка сохранения файла в БД:', error)
            return false
        }
    }

    // УДАЛЕНИЕ ФАЙЛА ИЗ БД
    async deleteFileFromDB(path: string) {
        try {
            const moduleId = this.options?.moduleId
            const enterpriseId = this.options?.enterpriseId
            if (!moduleId || !enterpriseId) {
                console.warn('[FileSystem] Для удаления нужны moduleId и enterpriseId')
                return false
            }

            const normalizedPath = this.normalizePath(path)
            const response = await fetch(
                `/api/enterprises/${encodeURIComponent(enterpriseId)}/dynamicModules/${encodeURIComponent(moduleId)}/files`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete', file: { path: normalizedPath } })
                }
            )
            const data = await response.json().catch(() => null)
            if (!response.ok || data?.success !== true) {
                console.error('[FileSystem] Не удалось удалить файл:', response.status, data)
                return false
            }

            this.files.delete(normalizedPath)
            console.info(`[FileSystem] Файл ${normalizedPath} удалён`)
            return true
        } catch (error) {
            console.error('[FileSystem] Ошибка удаления файла из БД:', error)
            return false
        }
    }
}