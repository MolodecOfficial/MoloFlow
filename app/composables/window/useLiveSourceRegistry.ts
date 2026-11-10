// composables/window/useLiveSourceRegistry.ts
//
// Реестр "живых" исходных DOM-элементов, из которых был сделан пин.
// Ключ — dragId (тот самый, что генерируется в useDragPayload.startDrag()
// и приезжает в payload пина как data.dragId).
//
// Пока элемент реально смонтирован в DOM (т.е. его окно открыто), мы можем
// в любой момент снять с него свежий снапшот (snapshotElement из pinnable.ts)
// и обновить data.html у пина — это и есть механизм "живого" пина.
//
// Как только окно закрывается, элемент уходит из DOM, isConnected становится
// false — getSourceElement сам вычистит запись и вернёт undefined.

const sourceElements = new Map<string, HTMLElement>()

// --- Уведомления о (пере)регистрации ---------------------------------------
//
// Нужны для случая, когда живой источник появляется НЕ в результате
// перетаскивания (там порядок событий и так корректный), а в результате
// автоматического переподключения при монтировании нового DOM-элемента
// (см. tryAutoReconnect в pinnable.ts — например, когда окно закрыли и
// открыли заново). В этот момент MoloPinnedShell.vue уже мог успеть
// провалить попытку attachObserver()/doResnapshot() (источника ещё не было
// в реестре на момент его watcher'а) — без явного уведомления пин так и
// остался бы висеть в устаревшем состоянии до следующего изменения
// isWindowOpen. Поэтому регистрирующая сторона оповещает подписчиков
// напрямую, и MoloPinnedShell.vue может подхватить это в любой момент.
type SourceListener = (dragId: string) => void
const listeners = new Set<SourceListener>()

export function onSourceRegistered(listener: SourceListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function registerSourceElement(dragId: string, el: HTMLElement) {
    sourceElements.set(dragId, el)
    listeners.forEach((listener) => listener(dragId))
}

export function unregisterSourceElement(dragId: string) {
    sourceElements.delete(dragId)
}

export function getSourceElement(dragId?: string): HTMLElement | undefined {
    if (!dragId) return undefined

    const el = sourceElements.get(dragId)

    if (el && !el.isConnected) {
        // Окно закрылось / элемент вырезан из DOM — запись больше не актуальна.
        sourceElements.delete(dragId)
        return undefined
    }

    return el
}