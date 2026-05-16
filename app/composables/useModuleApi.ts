// composables/useModuleApi.ts
export function useModuleApi(){
    const { addLog } = useLogger('API модулей')
    const { addNotification } = useNotifications('API модулей')

    const fetchModules = async (enterpriseId: string) => {
        addLog('info', 'Загружаем модули...')
        try {
            const res = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules`)
            addLog('success', `Загружено ${res.modules?.length || 0} модулей`)
            return res.modules || []
        } catch (e: any) {
            addLog('error', `Ошибка: ${e.message}`)
            return []
        }
    }

    const loadModuleFiles = async (enterpriseId: string, moduleId: string) => {
        addLog('info', 'Загружаем файлы модуля...')
        try {
            const response = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`)
            addLog('success', `Загружено ${response.files?.length || 0} файлов`)
            return response.files || []
        } catch (err: any) {
            addLog('error', `Ошибка: ${err}`)
            return []
        }
    }

    const loadDependencies = async (enterpriseId: string, moduleId: string) => {
        try {
            const res = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/dependencies`)
            return {
                dependencies: res.dependencies || {},
                devDependencies: res.devDependencies || {}
            }
        } catch {
            return { dependencies: {}, devDependencies: {} }
        }
    }

    const saveModule = async (enterpriseId: string, data: any, isEditing: boolean, moduleId?: string) => {
        if (isEditing && moduleId) {
            return await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}`, {
                method: 'PUT',
                body: data
            })
        } else {
            return await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules`, {
                method: 'POST',
                body: { ...data, enterpriseId }
            })
        }
    }

    const saveFile = async (enterpriseId: string, moduleId: string, fileData: any, isUpdate: boolean, oldPath?: string) => {
        return await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`, {
            method: 'POST',
            body: {
                action: isUpdate ? 'update' : 'add',
                file: fileData,
                oldPath: oldPath
            }
        })
    }

    const deleteFile = async (enterpriseId: string, moduleId: string, filePath: string) => {
        return await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`, {
            method: 'POST',
            body: {
                action: 'delete',
                file: { path: filePath }
            }
        })
    }

    const addDependency = async (enterpriseId: string, moduleId: string, packageName: string, version: string, packageType: string) => {
        return await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/dependencies`, {
            method: 'POST',
            body: {
                action: 'add',
                packageName,
                version,
                packageType
            }
        })
    }

    const removeDependency = async (enterpriseId: string, moduleId: string, packageName: string, packageType: string) => {
        return await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/dependencies`, {
            method: 'POST',
            body: {
                action: 'remove',
                packageName,
                packageType
            }
        })
    }

    const clearCache = async (moduleId: string, enterpriseId: string) => {
        return await $fetch('/api/npm/install', {
            method: 'POST',
            body: { moduleId, enterpriseId, forceReinstall: true }
        })
    }

    return {
        fetchModules,
        loadModuleFiles,
        loadDependencies,
        saveModule,
        saveFile,
        deleteFile,
        addDependency,
        removeDependency,
        clearCache
    }
}