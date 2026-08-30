// Общий протокол перетаскивания между окнами/рабочим столом.
// Источник кладёт { type, ...data } через startDrag, приёмник читает через readDrag.
// Ни одна сторона не знает о внутренностях другой — просто договорённость по type.

const MIME = 'application/x-molo-item'

export function startDrag(e: DragEvent, payload: Record<string, any>) {
    if (!e.dataTransfer) return
    e.dataTransfer.setData(MIME, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
}

export function readDrag(e: DragEvent): Record<string, any> | null {
    const raw = e.dataTransfer?.getData(MIME)
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}