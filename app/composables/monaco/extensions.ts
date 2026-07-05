import type { MonacoContext } from './bootstrap'

export function registerExtensions(ctx: MonacoContext) {
    const { monaco, editor, api, fs } = ctx

    // 🧠 Пример: команда вызова API прямо из редактора
    editor.addAction({
        id: 'fetch-users',
        label: 'Fetch Users',
        contextMenuGroupId: 'navigation',
        run: async () => {
            const users = await api.getUsers()

            monaco.editor.createModel(
                JSON.stringify(users, null, 2),
                'json'
            )

            console.log('Users loaded:', users)
        }
    })

    editor.addAction({
        id: 'api-run-request',
        label: 'Run API Request',
        contextMenuGroupId: 'navigation',
        run: async () => {
            const result = await api.request('/api/users', {
                method: 'GET'
            })

            const model = editor.getModel()
            if (model) {
                model.setValue(JSON.stringify(result, null, 2))
            }
        }
    })

    // 🧠 Пример: вставка файловой системы
    editor.addAction({
        id: 'list-files',
        label: 'List Files',
        run: () => {
            console.log(fs.listFiles())
        }
    })
}