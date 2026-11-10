import type { MonacoContext } from './bootstrap'

export class EditorManager {
    constructor(private ctx: MonacoContext) {}

    openFile(path: string) {
        const file = this.ctx.fs.readFile(path)
        if (!file) return

        const model = this.ctx.monaco.editor.createModel(
            file.content,
            file.language || 'typescript',
            this.ctx.monaco.Uri.parse(`file:///${file.path}`)
        )

        this.ctx.editor.setModel(model)
    }

    saveCurrentFile() {
        const model = this.ctx.editor.getModel()
        if (!model) return

        const path = model.uri.path.replace('/', '')

        this.ctx.fs.writeFile(
            path,
            model.getValue(),
            model.getLanguageId()
        )
    }
}