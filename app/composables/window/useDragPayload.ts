const MIME = 'application/x-molo-item'

const pendingCallbacks = new Map<string, () => void>()

export function startDrag(
    e: DragEvent,
    payload: Record<string, any>,
    onPinned?: () => void
): string | null {
    if (!e.dataTransfer) return null

    const dragId = crypto.randomUUID()

    if (onPinned) {
        pendingCallbacks.set(dragId, onPinned)
    }

    e.dataTransfer.setData(
        MIME,
        JSON.stringify({
            ...payload,
            dragId,
        })
    )

    e.dataTransfer.effectAllowed = 'move'

    return dragId
}

export function readDrag(
    e: DragEvent
): Record<string, any> | null {
    const raw = e.dataTransfer?.getData(MIME)

    if (!raw) return null

    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

export function consumePinnedCallback(dragId?: string) {
    if (!dragId) return

    const callback = pendingCallbacks.get(dragId)

    if (callback) {
        callback()
    }

    pendingCallbacks.delete(dragId)
}

export function discardDragCallback(dragId?: string) {
    if (!dragId) return

    pendingCallbacks.delete(dragId)
}