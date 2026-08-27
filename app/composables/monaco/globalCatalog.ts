// composables/monaco/globalCatalog.ts
import type { FileNode } from './filesystem'

// ---------------------------------------------------------------
// ГЛОБАЛЬНЫЙ КАТАЛОГ КОМПОЗАБЛОВ И КОМПОНЕНТОВ
// ---------------------------------------------------------------
// В отличие от FileSystem (файлы текущего открытого модуля), этот каталог
// не зависит от того, что сейчас открыто в редакторе. import.meta.glob
// статически резолвится Vite'ом на этапе сборки и подтягивает исходники
// ВСЕХ композаблов/компонентов проекта как raw-текст.
//
// '!../monaco/**' исключает внутренности самого monaco-редактора
// (bootstrap/filesystem/virtualFS и т.д.) — это движок редактора,
// а не то, что пользователь должен вставлять в свой код.
//
// Если пути в объекте не совпадают с ожидаемыми (например, alias '~~' не
// резолвится в вашей версии Nuxt) — проверьте console.log(composableModules)
// в деве и поправьте паттерны под структуру вашего проекта.
// ---------------------------------------------------------------

const composableModules = import.meta.glob(
    ['../**/*.ts', '!../monaco/**'],
    { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const componentModules = import.meta.glob(
    '../../components/**/*.vue',
    { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

let cachedCatalog: FileNode[] | null = null

export function getGlobalCatalog(): FileNode[] {
    if (cachedCatalog) return cachedCatalog

    const result: FileNode[] = []

    for (const [fullPath, content] of Object.entries(composableModules)) {
        result.push({
            path: toDisplayPath(fullPath, 'composables'),
            content,
            language: 'typescript'
        })
    }

    for (const [fullPath, content] of Object.entries(componentModules)) {
        result.push({
            path: toDisplayPath(fullPath, 'components'),
            content,
            language: 'html'
        })
    }

    cachedCatalog = result
    return result
}

// На случай горячей замены каталога (dev-режим) — можно вызвать вручную,
// если понадобится сбросить кэш без перезагрузки страницы.
export function resetGlobalCatalogCache() {
    cachedCatalog = null
}

function toDisplayPath(fullPath: string, root: 'composables' | 'components'): string {
    // '../useFoo.ts' / '../../components/Ui/Button.vue' -> 'composables/useFoo.ts' / 'components/Ui/Button.vue'
    const idx = fullPath.lastIndexOf(`/${root}/`)
    if (idx !== -1) {
        return fullPath.slice(idx + 1)
    }
    return fullPath.replace(/^(\.\.\/)+/, `${root}/`)
}