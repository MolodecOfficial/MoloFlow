// composables/monaco/theme.ts
import type * as monaco from 'monaco-editor'

// Тема на базе One Dark / Dracula — контрастнее и приятнее дефолтной vs-dark,
// с отдельными цветами под ключевые слова, строки, типы, функции, комментарии.
export function defineMoloTheme(m: typeof monaco) {
    m.editor.defineTheme('molo-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'C678DD', fontStyle: 'bold' },
            { token: 'keyword.control', foreground: 'C678DD' },
            { token: 'string', foreground: '98C379' },
            { token: 'string.escape', foreground: '56B6C2' },
            { token: 'number', foreground: 'D19A66' },
            { token: 'regexp', foreground: 'E06C75' },
            { token: 'type', foreground: 'E5C07B' },
            { token: 'type.identifier', foreground: 'E5C07B' },
            { token: 'identifier', foreground: 'ABB2BF' },
            { token: 'function', foreground: '61AFEF' },
            { token: 'variable', foreground: 'E06C75' },
            { token: 'variable.parameter', foreground: 'D19A66' },
            { token: 'delimiter', foreground: 'ABB2BF' },
            { token: 'tag', foreground: 'E06C75' },
            { token: 'attribute.name', foreground: 'D19A66' },
            { token: 'attribute.value', foreground: '98C379' },
            { token: 'operator', foreground: '56B6C2' },
            { token: 'annotation', foreground: 'D19A66' },
        ],
        colors: {
            'editor.background': '#1A1B26',
            'editor.foreground': '#ABB2BF',
            'editor.lineHighlightBackground': '#24283B',
            'editor.selectionBackground': '#3B4261',
            'editor.inactiveSelectionBackground': '#3B426180',
            'editorCursor.foreground': '#61AFEF',
            'editorWhitespace.foreground': '#3B3F51',
            'editorIndentGuide.background': '#2A2E42',
            'editorIndentGuide.activeBackground': '#4A4F6A',
            'editorLineNumber.foreground': '#4B5266',
            'editorLineNumber.activeForeground': '#ABB2BF',
            'editorBracketMatch.background': '#3B426180',
            'editorBracketMatch.border': '#61AFEF',
            'editorGutter.background': '#1A1B26',
            'editorSuggestWidget.background': '#20222E',
            'editorSuggestWidget.border': '#2A2E42',
            'editorSuggestWidget.selectedBackground': '#3B4261',
            'editorHoverWidget.background': '#20222E',
            'editorHoverWidget.border': '#2A2E42',
            'scrollbarSlider.background': '#4B526650',
            'scrollbarSlider.hoverBackground': '#4B526690',
            'minimap.background': '#1A1B26',
        }
    })
}