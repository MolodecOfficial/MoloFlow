import * as monaco from 'monaco-editor';

export function initMonacoTypeScript() {
    // Настройка компилятора TypeScript
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        jsx: monaco.languages.typescript.JsxEmit.Preserve,
        allowJs: true,
        checkJs: false,
        strict: false,
    });

    // Добавление типов для Vue
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        `declare module '*.vue' { 
      import type { DefineComponent } from 'vue'; 
      const component: DefineComponent; 
      export default component; 
    }`,
        'file:///node_modules/@types/vue/index.d.ts'
    );
}

// Опционально: регистрация сниппетов
export function registerMonacoSnippets() {
    // Сниппет для Vue компонента
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
                    detail: 'Vue component scaffold',
                    range: { startLineNumber: 1, startColumn: 0, endLineNumber: 1, endColumn: 0 }
                },
                {
                    label: 'vfor',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'v-for="(${1:item}, ${2:index}) in ${3:items}" :key="${2:index}"',
                    detail: 'Vue v-for directive'
                },
                {
                    label: 'vmodel',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'v-model="${1:variable}"',
                    detail: 'Vue v-model directive'
                }
            ]
        })
    });

    // Сниппеты для JavaScript
    monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: () => ({
            suggestions: [
                {
                    label: 'clog',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'console.log(${1:data});',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Console log'
                },
                {
                    label: 'fun',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'function ${1:name}(${2:params}) {\n  ${3}\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    detail: 'Function declaration'
                }
            ]
        })
    });
}