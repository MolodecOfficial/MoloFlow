export function useModuleService() {
    const { addLog } = useLogger('Сервис модулей')
    const { addNotification } = useNotifications('Сервис модулей')

    /**
     * Загружает полные данные модуля (основной код + все файлы + зависимости)
     * @param moduleId - ID модуля
     * @param enterpriseId - ID предприятия
     * @param includeCode - загружать ли основной код (если false — вернёт только метаданные)
     */

    async function fetchFullModuleData(moduleId: string, enterpriseId: string, includeCode: boolean = true) {
        addLog('info', `Загрузка модуля для предприятия...`)

        try {
            // Запрашиваем все файлы модуля (и основной код, и дополнительные)
            const response = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`)

            if (!response) {
                throw new Error('Пустой ответ от сервера')
            }

            const mainFile = response.mainFile
            const additionalFiles = response.files || []

            // Формируем единую структуру
            const moduleData: any = {
                _id: moduleId,
                name: mainFile?.name || 'Без названия',
                format: mainFile?.format || 'vue',
                code: includeCode ? (mainFile?.code || '') : '',
                dependencies: response.dependencies || {},
                files: additionalFiles.map((f: any) => ({
                    name: f.name,
                    path: f.path,
                    format: f.format,
                    code: f.code || '',
                    isServerFile: f.isServerFile || false
                }))
            }

            addLog('success', `Загружено файлов: ${moduleData.files.length}`)
            return moduleData

        } catch (error: any) {
            addLog('error', `Ошибка загрузки модуля: ${error.message}`)
            throw error
        }
    }

    /**
     * Создаёт объект moduleData, готовый к передаче в open-window
     */

    function prepareModuleForWindow(moduleData: any, customTitle?: string) {
        return {
            _id: moduleData._id,
            moduleId: moduleData._id,
            name: customTitle || moduleData.name,
            format: moduleData.format,
            code: moduleData.code,
            files: moduleData.files,
            dependencies: moduleData.dependencies
        }
    }

    return {
        fetchFullModuleData,
        prepareModuleForWindow
    }
}