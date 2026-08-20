// composables/monaco/typeSystem.ts
import type * as monaco from 'monaco-editor'
import type { FileNode } from './filesystem'

// Базовые декларации Vue: без них TS-воркер ругался бы на "Cannot find module 'vue'"
// и на макросы defineProps/defineEmits, которых нет в реальном node_modules внутри браузера.
const VUE_AMBIENT_DECLARATIONS = `
declare module 'vue' {
  export function ref<T>(value: T): { value: T }
  export function ref<T = any>(): { value: T | undefined }
  export function reactive<T extends object>(target: T): T
  export function computed<T>(getter: () => T): { readonly value: T }
  export function computed<T>(options: { get: () => T; set: (v: T) => void }): { value: T }
  export function watch(source: any, cb: (...args: any[]) => void, options?: any): void
  export function watchEffect(effect: () => void): void
  export function onMounted(cb: () => void): void
  export function onUnmounted(cb: () => void): void
  export function onBeforeMount(cb: () => void): void
  export function onBeforeUnmount(cb: () => void): void
  export function nextTick(cb?: () => void): Promise<void>
  export function provide(key: any, value: any): void
  export function inject<T = any>(key: any, defaultValue?: T): T
  export function defineComponent(options: any): any
  export function defineAsyncComponent(loader: any): any
  export function toRef(obj: any, key: string): any
  export function toRefs(obj: any): any
  export function unref<T>(value: T | { value: T }): T
  export function isRef(value: any): boolean
  export function markRaw<T>(value: T): T
  export function shallowRef<T>(value: T): { value: T }
  export function useSlots(): Record<string, any>
  export function useAttrs(): Record<string, any>
  export type Ref<T = any> = { value: T }
  export type ComputedRef<T = any> = { readonly value: T }
  export type PropType<T> = any
}
declare function defineProps<T = any>(props?: any): T
declare function defineEmits<T = any>(emits?: any): T
declare function defineExpose(exposed?: Record<string, any>): void
declare function withDefaults<T, D>(props: T, defaults: D): T
declare function defineOptions(options: any): void
`

let typeSystemInitialized = false

// Настраивает компилятор и диагностику TS/JS воркера один раз на всё приложение.
// После этого автодополнение, hover, F12 (go to definition) для .ts/.js файлов —
// НАСТОЯЩИЕ, через компилятор TypeScript, а не текстовый разбор регэкспами.
export function setupTypeSystem(m: typeof monaco) {
    if (typeSystemInitialized) return
    typeSystemInitialized = true

    const ts = m.languages.typescript

    const compilerOptions: any = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: true,
        checkJs: false,
        jsx: ts.JsxEmit.Preserve,
        esModuleInterop: true,
        allowNonTsExtensions: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        noImplicitAny: false,
        skipLibCheck: true,
        lib: ['esnext', 'dom']
    }

    ts.typescriptDefaults.setCompilerOptions(compilerOptions)
    ts.javascriptDefaults.setCompilerOptions(compilerOptions)

    // Семантические ошибки о "не найден модуль/имя" глушим — в песочнице нет
    // реального node_modules, и это давало бы кучу ложных красных подчёркиваний
    // на абсолютно рабочем коде. Синтаксические ошибки (реальные баги) оставляем.
    const diagnosticsOptions = {
        noSemanticValidation: false,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: [
            2307, // Cannot find module
            2304, // Cannot find name
            2571, // Object is of type 'unknown'
        ]
    }
    ts.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
    ts.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions)

    ts.typescriptDefaults.setEagerModelSync(true)
    ts.javascriptDefaults.setEagerModelSync(true)

    ts.typescriptDefaults.addExtraLib(
        VUE_AMBIENT_DECLARATIONS,
        'file:///node_modules/@types/vue-shim/index.d.ts'
    )
}

// Реестр зарегистрированных extraLib'ов по пути файла — чтобы при обновлении
// содержимого не плодить дубликаты, а чисто заменять старую версию на новую.
const extraLibDisposables = new Map<string, monaco.IDisposable>()

// Регистрирует .ts/.js файлы модуля как extraLib в TS-воркере, чтобы файлы
// модуля видели типы/экспорты друг друга по-настоящему (реальный F12, реальный hover).
// Вызывать при каждом обновлении набора файлов (открытие модуля, сохранение файла и т.д.)
export function syncExtraLibs(m: typeof monaco, files: FileNode[]) {
    const ts = m.languages.typescript

    const currentPaths = new Set(files.filter(isTsOrJs).map(f => f.path))
    for (const [path, disposable] of extraLibDisposables) {
        if (!currentPaths.has(path)) {
            disposable.dispose()
            extraLibDisposables.delete(path)
        }
    }

    for (const file of files) {
        if (!isTsOrJs(file)) continue
        const uri = `file:///${file.path}`
        extraLibDisposables.get(file.path)?.dispose()
        const disposable = ts.typescriptDefaults.addExtraLib(file.content, uri)
        extraLibDisposables.set(file.path, disposable)
    }
}

function isTsOrJs(f: FileNode) {
    const ext = f.path.split('.').pop()?.toLowerCase()
    return ext === 'ts' || ext === 'js'
}
 