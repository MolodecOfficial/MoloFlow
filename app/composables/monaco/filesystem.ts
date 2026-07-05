// composables/monaco/filesystem.ts
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
        initialFiles.forEach(f => this.files.set(f.path, f))
    }

    readFile(path: string) {
        return this.files.get(path) || null
    }

    writeFile(path: string, content: string, language = 'typescript') {
        this.files.set(path, { path, content, language })
    }

    deleteFile(path: string) {
        this.files.delete(path)
    }

    listFiles() {
        return Array.from(this.files.values())
    }

    exists(path: string) {
        return this.files.has(path)
    }

    getFilePaths(): string[] {
        return Array.from(this.files.keys())
    }

    // ЗАГРУЗКА ФАЙЛОВ ИЗ БД
    async loadFilesFromDB(moduleId: string, enterpriseId: string) {
        try {
            const response = await fetch(
                `/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`
            )
            const data = await response.json()

            if (data.success) {
                // Очищаем текущие файлы
                this.files.clear()

                // Добавляем основной файл
                if (data.mainFile) {
                    this.files.set(data.mainFile.path, {
                        path: data.mainFile.path,
                        content: data.mainFile.code || '',
                        language: data.mainFile.format || 'vue',
                        isServerFile: data.mainFile.isServerFile || false
                    })
                }

                // Добавляем дополнительные файлы
                if (data.files) {
                    for (const file of data.files) {
                        this.files.set(file.path, {
                            path: file.path,
                            content: file.code || '',
                            language: file.format || 'vue',
                            isServerFile: file.isServerFile || false
                        })
                    }
                }

                console.log(`[FileSystem] Loaded ${this.files.size} files from DB for module ${moduleId}`)
                return true
            }
            return false
        } catch (error) {
            console.error('[FileSystem] Failed to load files from DB:', error)
            return false
        }
    }

    // СОХРАНЕНИЕ ФАЙЛА В БД
    async saveFileToDB(path: string, content: string, language: string) {
        try {
            const moduleId = this.options?.moduleId
            const enterpriseId = this.options?.enterpriseId

            if (!moduleId || !enterpriseId) {
                console.warn('[FileSystem] No moduleId or enterpriseId provided')
                return false
            }

            const response = await fetch(
                `/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        path: path,
                        code: content,
                        format: language
                    })
                }
            )

            const data = await response.json()

            if (data.success) {
                // Обновляем локальный кеш
                this.files.set(path, {
                    path: path,
                    content: content,
                    language: language
                })
                console.log(`[FileSystem] File ${path} saved to DB`)
                return true
            }
            return false
        } catch (error) {
            console.error('[FileSystem] Failed to save file to DB:', error)
            return false
        }
    }

    // УДАЛЕНИЕ ФАЙЛА ИЗ БД
    async deleteFileFromDB(path: string) {
        try {
            const moduleId = this.options?.moduleId
            const enterpriseId = this.options?.enterpriseId

            if (!moduleId || !enterpriseId) {
                console.warn('[FileSystem] No moduleId or enterpriseId provided')
                return false
            }

            const response = await fetch(
                `/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files/${encodeURIComponent(path)}`,
                {
                    method: 'DELETE'
                }
            )

            const data = await response.json()

            if (data.success) {
                // Удаляем из локального кеша
                this.files.delete(path)
                console.log(`[FileSystem] File ${path} deleted from DB`)
                return true
            }
            return false
        } catch (error) {
            console.error('[FileSystem] Failed to delete file from DB:', error)
            return false
        }
    }
}