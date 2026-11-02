// utils/gsheetsSync.ts
// Чистая логика двусторонней синхронизации MoloTable <-> Google Таблицы.
// Без Vue и без Univer: всё работает с двумерными массивами значений, поэтому покрывается тестами.
//
// Модель: трёхсторонний merge по «базе» — последнему состоянию, которое точно совпадало
// на обеих сторонах. Для каждой ячейки:
//   local == remote            -> ничего
//   меняла только одна сторона -> эта сторона побеждает, другая получает значение
//   менялись обе по-разному    -> конфликт, побеждает локальная версия (MoloTable), counted в conflicts

export type Matrix = any[][]

export interface CellChange {
    r: number
    c: number
    v: any
}

export interface SegmentChange {
    r: number
    c0: number
    values: any[]
}

export interface SyncPlan {
    /** Изменения, которые нужно применить к локальной таблице (remote -> local) */
    pull: CellChange[]
    /** Изменения, которые нужно отправить в Google (local -> remote) */
    push: CellChange[]
    /** Ячейки, которые менялись на обеих сторонах */
    conflicts: number
    /** Итоговое состояние после слияния (обрезано по краям) */
    merged: Matrix
}

export interface GSheetsLink {
    id: string
    /** Univer sheetId локального листа */
    localSheetId: string
    localSheetName: string
    spreadsheetId: string
    spreadsheetTitle: string
    /** Название вкладки в Google Таблице */
    sheetTitle: string
    /** Последнее согласованное состояние, обрезанное по краям */
    base: Matrix
    createdAt: string
}

export type LinkMode = 'merge' | 'replace-local' | 'replace-remote'

const SPREADSHEET_ID_RE = /^[a-zA-Z0-9_-]{20,200}$/

/** Принимает либо ID, либо полную ссылку вида https://docs.google.com/spreadsheets/d/<ID>/edit */
export function parseSpreadsheetId(input: string): string | null {
    const text = String(input || '').trim()
    const fromUrl = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    const id = fromUrl ? fromUrl[1]! : text
    return SPREADSHEET_ID_RE.test(id) ? id : null
}

export function cellText(v: unknown): string {
    return v === null || v === undefined ? '' : String(v)
}

/** Значение для хранения и отправки: null/undefined превращаем в пустую строку */
export function normCell(v: unknown): any {
    return v === null || v === undefined ? '' : v
}

/** 0 -> A, 25 -> Z, 26 -> AA */
export function colToA1(col0: number): string {
    let n = col0 + 1
    let s = ''
    while (n > 0) {
        const m = (n - 1) % 26
        s = String.fromCharCode(65 + m) + s
        n = Math.floor((n - 1) / 26)
    }
    return s
}

/** Имя вкладки в A1-нотации: 'Лист 1' -> 'Лист 1' с экранированием апострофов */
export function quoteSheetTitle(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`
}

/** Обрезает пустые строки и столбцы снизу и справа, пустые значения приводит к '' */
export function trimMatrix(m: Matrix): Matrix {
    let lastR = -1
    let lastC = -1
    for (let r = 0; r < m.length; r++) {
        const row = m[r] || []
        for (let c = 0; c < row.length; c++) {
            if (cellText(row[c]) !== '') {
                if (r > lastR) lastR = r
                if (c > lastC) lastC = c
            }
        }
    }
    if (lastR < 0) return []
    const out: Matrix = []
    for (let r = 0; r <= lastR; r++) {
        const row: any[] = []
        for (let c = 0; c <= lastC; c++) row.push(normCell(m[r]?.[c]))
        out.push(row)
    }
    return out
}

/** Применяет список изменений к матрице, возвращает новую обрезанную матрицу */
export function applyChanges(m: Matrix, changes: CellChange[]): Matrix {
    const out: Matrix = m.map((row) => [...(row || [])])
    for (const ch of changes) {
        while (out.length <= ch.r) out.push([])
        const row = out[ch.r]!
        while (row.length <= ch.c) row.push('')
        row[ch.c] = normCell(ch.v)
    }
    return trimMatrix(out)
}

/** Трёхсторонний merge: local (MoloTable), remote (Google), base (последнее согласованное) */
export function planSync(local: Matrix, remote: Matrix, base: Matrix): SyncPlan {
    const rows = Math.max(local.length, remote.length, base.length)
    let cols = 0
    for (const m of [local, remote, base]) {
        for (const row of m) cols = Math.max(cols, row?.length || 0)
    }

    const pull: CellChange[] = []
    const push: CellChange[] = []
    const mergedRows: Matrix = []
    let conflicts = 0

    for (let r = 0; r < rows; r++) {
        const row: any[] = []
        for (let c = 0; c < cols; c++) {
            const L = local[r]?.[c]
            const R = remote[r]?.[c]
            const B = base[r]?.[c]
            const l = cellText(L)
            const rr = cellText(R)
            const b = cellText(B)

            if (l === rr) {
                row.push(normCell(L))
                continue
            }

            const localChanged = l !== b
            const remoteChanged = rr !== b

            if (localChanged && remoteChanged) {
                conflicts++
                push.push({ r, c, v: normCell(L) })
                row.push(normCell(L))
            } else if (remoteChanged) {
                pull.push({ r, c, v: normCell(R) })
                row.push(normCell(R))
            } else {
                // изменилась только локальная сторона
                push.push({ r, c, v: normCell(L) })
                row.push(normCell(L))
            }
        }
        mergedRows.push(row)
    }

    return { pull, push, conflicts, merged: trimMatrix(mergedRows) }
}

/** Все различия между двумя матрицами (для режима «заменить локальные данными из Google») */
export function diffAll(from: Matrix, to: Matrix): CellChange[] {
    const rows = Math.max(from.length, to.length)
    let cols = 0
    for (const m of [from, to]) for (const row of m) cols = Math.max(cols, row?.length || 0)
    const out: CellChange[] = []
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const a = cellText(from[r]?.[c])
            const b = cellText(to[r]?.[c])
            if (a !== b) out.push({ r, c, v: normCell(to[r]?.[c]) })
        }
    }
    return out
}

/**
 * Группирует изменения в непрерывные отрезки внутри одной строки:
 * [{r:0,c:1,v:'a'}, {r:0,c:2,v:'b'}] -> [{r:0, c0:1, values:['a','b']}]
 * Нужно, чтобы отправлять в Google по одному запросу на отрезок, а не на ячейку.
 */
export function groupSegments(changes: CellChange[]): SegmentChange[] {
    const sorted = [...changes].sort((a, b) => (a.r - b.r) || (a.c - b.c))
    const out: SegmentChange[] = []
    let cur: SegmentChange | null = null
    for (const ch of sorted) {
        if (cur && cur.r === ch.r && ch.c === cur.c0 + cur.values.length) {
            cur.values.push(normCell(ch.v))
        } else {
            cur = { r: ch.r, c0: ch.c, values: [normCell(ch.v)] }
            out.push(cur)
        }
    }
    return out
}

/** A1-диапазон для отрезка на вкладке Google, например 'Лист 1'!B3:D3 */
export function segmentRange(sheetTitle: string, seg: SegmentChange): string {
    const from = `${colToA1(seg.c0)}${seg.r + 1}`
    const to = `${colToA1(seg.c0 + seg.values.length - 1)}${seg.r + 1}`
    return `${quoteSheetTitle(sheetTitle)}!${from}:${to}`
}
