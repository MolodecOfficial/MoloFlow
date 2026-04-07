import * as monaco from 'monaco-editor'

export function initMonacoTypeScript() {
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2022,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        jsx: monaco.languages.typescript.JsxEmit.Preserve,
        allowJs: true,
        checkJs: false,
        strict: false,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
    })

    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        `declare module '*.vue' { 
            import type { DefineComponent } from 'vue'
            const component: DefineComponent<{}, {}, any>
            export default component
        }`,
        'file:///node_modules/@types/vue/index.d.ts'
    )

    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        `declare module '@/components/*' {
            const component: any
            export default component
        }`,
        'file:///node_modules/@types/components/index.d.ts'
    )
}

export function registerMonacoSnippets() {
    monaco.languages.registerCompletionItemProvider('html', {
        provideCompletionItems: () => ({
            suggestions: [
                {
                    label: 'vbase',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: [
                        '<template>',
                        '  <div class="$1">',
                        '    $2',
                        '  </div>',
                        '</template>',
                        '',
                        '<script setup lang="ts">',
                        'import { ref } from \'vue\'',
                        '',
                        'const $3 = ref($4)',
                        '</script>',
                        '',
                        '<style scoped>',
                        '.$1 {',
                        '  $5',
                        '}',
                        '</style>'
                    ].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Vue component scaffold'
                }
            ]
        })
    })
}