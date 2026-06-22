import { ref, shallowRef } from 'vue'

export interface CellStyle {
    textAlign: 'left' | 'center' | 'right'
    verticalAlign: 'top' | 'middle' | 'bottom'
    fontWeight: 'normal' | 'bold'
    fontStyle: 'normal' | 'italic'
    fontSize: number
    backgroundColor: string
    textColor: string
    borderTop: string
    borderBottom: string
    borderLeft: string
    borderRight: string
}

export interface TableCell {
    content: string
    colspan: number
    rowspan: number
    hidden: boolean
    style: CellStyle
}

export interface TableRow {
    cells: TableCell[]
    backgroundColor: string
}

export function createEmptyCell(): TableCell {
    return {
        content: '',
        colspan: 1,
        rowspan: 1,
        hidden: false,
        style: {
            textAlign: 'left',
            verticalAlign: 'top',
            fontWeight: 'normal',
            fontStyle: 'normal',
            fontSize: 13,
            backgroundColor: '',
            textColor: '#000000',
            borderTop: '',
            borderBottom: '',
            borderLeft: '',
            borderRight: ''
        }
    }
}

const HIDDEN_CELL: TableCell = {
    ...createEmptyCell(),
    hidden: true
}

export function colToName(col: number): string {
    let result = ''
    let c = col
    while (c >= 0) {
        result = String.fromCharCode(65 + (c % 26)) + result
        c = Math.floor(c / 26) - 1
    }
    return result
}

export function nameToCol(name: string): number {
    let result = 0
    for (let i = 0; i < name.length; i++) {
        result = result * 26 + (name.charCodeAt(i) - 64)
    }
    return result - 1
}

export function getAddress(row: number, col: number): string {
    return `${colToName(col)}${row + 1}`
}

export function useTableData(initialModel?: TableRow[]) {
    const cells = shallowRef<Record<string, TableCell>>({})
    const spanMap = ref<Map<string, { masterRow: number; masterCol: number }>>(new Map())

    function rebuildSpanMap() {
        const newMap = new Map<string, {
            masterRow: number
            masterCol: number
        }>()

        for (const [addr, cell] of Object.entries(cells.value)) {

            if (cell.hidden) continue

            if (cell.rowspan <= 1 && cell.colspan <= 1) continue

            const match = addr.match(/^([A-Z]+)(\d+)$/)

            if (!match) continue

            const col = nameToCol(match[1])
            const row = Number(match[2]) - 1

            for (let r = row; r < row + cell.rowspan; r++) {
                for (let c = col; c < col + cell.colspan; c++) {

                    if (r === row && c === col) continue

                    newMap.set(
                        `${r},${c}`,
                        {
                            masterRow: row,
                            masterCol: col
                        }
                    )
                }
            }
        }

        spanMap.value = newMap
    }

    function getCellForRender(row: number, col: number): TableCell {
        // Проверяем, есть ли ячейка в spanMap (значит она часть объединения)
        const master = spanMap.value.get(`${row},${col}`)

        if (master) {
            return HIDDEN_CELL
        }

        const addr = getAddress(row, col)

        return cells.value[addr] || createEmptyCell()

    }

    function getMasterCell(row: number, col: number) {
        const master = spanMap.value.get(`${row},${col}`)

        if (master) {
            return {
                row: master.masterRow,
                col: master.masterCol
            }
        }

        return { row, col }
    }

    function updateCellContent(row: number, col: number, content: string) {
        // Проверяем, не является ли ячейка частью объединения
        const master = spanMap.value.get(`${row},${col}`)
        if (master) {
            // Редактируем мастер-ячейку
            const masterAddr = getAddress(master.masterRow, master.masterCol)
            let cell = cells.value[masterAddr]
            if (cell) {
                cell.content = content
                cells.value[masterAddr] = cell
            }
        } else {
            // Обычная ячейка
            const addr = getAddress(row, col)
            let cell = cells.value[addr]
            if (!cell) {
                cell = createEmptyCell()
                cells.value[addr] = cell
            }
            cell.content = content
            cells.value[addr] = cell
        }
        rebuildSpanMap()
    }

    function applyStyleToSelected<K extends keyof CellStyle>(
        selectedSet: Set<string>,
        key: K,
        value: CellStyle[K]
    ) {
        for (const selKey of selectedSet) {
            const [row, col] = selKey.split(',').map(Number)
            const master = spanMap.value.get(`${row},${col}`)

            let targetRow = row
            let targetCol = col

            if (master) {
                targetRow = master.masterRow
                targetCol = master.masterCol
            }

            const addr = getAddress(targetRow, targetCol)
            let cell = cells.value[addr]
            if (!cell) {
                cell = createEmptyCell()
                cells.value[addr] = cell
            }
            cell.style = { ...cell.style, [key]: value }
            cells.value[addr] = cell
        }
        rebuildSpanMap()
    }

    function applyBorder(
        selectedSet: Set<string>,
        borderType: keyof Pick<CellStyle, 'borderTop' | 'borderBottom' | 'borderLeft' | 'borderRight'>,
        color: string
    ) {
        const borderValue = `1px solid ${color}`
        for (const selKey of selectedSet) {
            const [row, col] = selKey.split(',').map(Number)
            const master = spanMap.value.get(`${row},${col}`)

            let targetRow = row
            let targetCol = col

            if (master) {
                targetRow = master.masterRow
                targetCol = master.masterCol
            }

            const addr = getAddress(targetRow, targetCol)
            let cell = cells.value[addr]
            if (!cell) {
                cell = createEmptyCell()
                cells.value[addr] = cell
            }
            if (cell.style[borderType] === borderValue) {
                cell.style[borderType] = ''
            } else {
                cell.style[borderType] = borderValue
            }
            cells.value[addr] = cell
        }
        rebuildSpanMap()
    }

    function removeAllBorders(selectedSet: Set<string>) {
        for (const selKey of selectedSet) {
            const [row, col] = selKey.split(',').map(Number)
            const master = spanMap.value.get(`${row},${col}`)

            let targetRow = row
            let targetCol = col

            if (master) {
                targetRow = master.masterRow
                targetCol = master.masterCol
            }

            const addr = getAddress(targetRow, targetCol)
            let cell = cells.value[addr]
            if (cell) {
                cell.style.borderTop = ''
                cell.style.borderBottom = ''
                cell.style.borderLeft = ''
                cell.style.borderRight = ''
                cells.value[addr] = cell
            }
        }
        rebuildSpanMap()
    }

    // ========== ИСПРАВЛЕННОЕ ОБЪЕДИНЕНИЕ ==========
    function mergeSelected(selectedSet: Set<string>) {
        if (selectedSet.size < 2) return null

        let minRow = Infinity
        let minCol = Infinity

        let maxRow = -Infinity
        let maxCol = -Infinity

        for (const key of selectedSet) {
            const [r, c] = key.split(',').map(Number)

            const master = getMasterCell(r, c)

            const addr = getAddress(master.row, master.col)

            const cell =
                cells.value[addr] ||
                createEmptyCell()

            minRow = Math.min(minRow, master.row)
            minCol = Math.min(minCol, master.col)

            maxRow = Math.max(
                maxRow,
                master.row + cell.rowspan - 1
            )

            maxCol = Math.max(
                maxCol,
                master.col + cell.colspan - 1
            )
        }

        // Получаем мастер-ячейку (верхняя левая)
        const masterAddr = getAddress(minRow, minCol)
        let master = cells.value[masterAddr] || createEmptyCell()

        // Сохраняем содержимое мастер-ячейки
        const masterContent = master.content
        const masterStyle = { ...master.style }

        // Обновляем размеры
        master.rowspan = maxRow - minRow + 1
        master.colspan = maxCol - minCol + 1
        master.hidden = false
        master.content = masterContent
        master.style = masterStyle

        // Создаём новый объект ячеек
        const newCells: Record<string, TableCell> = {}

        // Копируем все ячейки, кроме тех, что в области объединения
        for (const [addr, cell] of Object.entries(cells.value)) {
            const match = addr.match(/([A-Z]+)(\d+)/)
            if (!match) continue

            const col = nameToCol(match[1])
            const row = parseInt(match[2]) - 1

            // Пропускаем ячейки в области объединения (кроме мастер-ячейки)
            if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) {
                if (row === minRow && col === minCol) {
                    // Сохраняем мастер-ячейку с обновлёнными данными
                    newCells[addr] = master
                }
                // Остальные ячейки в области пропускаем (удаляем)
                continue
            }

            // Копируем остальные ячейки
            newCells[addr] = cell
        }

        // Если мастер-ячейка не была добавлена (если её не было в cells)
        if (!newCells[masterAddr]) {
            newCells[masterAddr] = master
        }

        cells.value = newCells
        rebuildSpanMap()

        return { row: minRow, col: minCol }
    }

    // ========== ИСПРАВЛЕННОЕ РАЗЪЕДИНЕНИЕ ==========
    function unmergeCell(row: number, col: number) {
        const addr = getAddress(row, col)
        const cell = cells.value[addr]
        if (!cell || (cell.rowspan === 1 && cell.colspan === 1)) return null

        const oldRowspan = cell.rowspan
        const oldColspan = cell.colspan
        const masterContent = cell.content
        const masterStyle = { ...cell.style }

        // Создаём новые ячейки
        const newCells = { ...cells.value }

        for (let r = row; r < row + oldRowspan; r++) {
            for (let c = col; c < col + oldColspan; c++) {
                const subAddr = getAddress(r, c)
                if (r === row && c === col) {
                    // Мастер-ячейка становится обычной
                    const masterCell = { ...cell }
                    masterCell.rowspan = 1
                    masterCell.colspan = 1
                    masterCell.hidden = false
                    masterCell.content = masterContent
                    masterCell.style = masterStyle
                    newCells[subAddr] = masterCell
                } else {
                    // Создаём пустую ячейку
                    const emptyCell = createEmptyCell()
                    emptyCell.rowspan = 1
                    emptyCell.colspan = 1
                    emptyCell.hidden = false
                    newCells[subAddr] = emptyCell
                }
            }
        }

        cells.value = newCells
        rebuildSpanMap()

        return { row, col }
    }

    function getCurrentStyle(selectedSet: Set<string>): CellStyle | null {
        if (selectedSet.size === 0) return null

        // Берём первую выбранную ячейку
        const firstKey = selectedSet.values().next().value
        const [row, col] = firstKey.split(',').map(Number)

        // Проверяем, не является ли она частью объединения
        const master = spanMap.value.get(`${row},${col}`)
        let targetRow = row
        let targetCol = col

        if (master) {
            targetRow = master.masterRow
            targetCol = master.masterCol
        }

        const addr = getAddress(targetRow, targetCol)
        return cells.value[addr]?.style || null
    }

    function toRows() {
        const rowMap = new Map<number, TableRow>()

        for (const [addr, cell] of Object.entries(cells.value)) {
            // Пропускаем скрытые ячейки (они часть объединения)
            if (cell.hidden) continue

            const match = addr.match(/([A-Z]+)(\d+)/)
            if (!match) continue

            const col = nameToCol(match[1])
            const row = parseInt(match[2]) - 1

            if (!rowMap.has(row)) {
                rowMap.set(row, { cells: [], backgroundColor: '' })
            }

            const rowData = rowMap.get(row)!
            while (rowData.cells.length <= col) {
                rowData.cells.push(createEmptyCell())
            }
            rowData.cells[col] = JSON.parse(JSON.stringify(cell))
        }

        return Array.from(rowMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([_, row]) => row)
    }

    function loadFromExcel(worksheet: any) {
        console.log('Loading from Excel:', worksheet)

        const newCells: Record<string, TableCell> = {}

        worksheet.eachRow((row: any, rowNumber: number) => {
            const rowIdx = rowNumber - 1

            row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
                const colIdx = colNumber - 1
                const addr = getAddress(rowIdx, colIdx)

                let targetCell = newCells[addr]
                if (!targetCell) {
                    targetCell = createEmptyCell()
                    newCells[addr] = targetCell
                }

                let value = ''
                if (cell.value !== null && cell.value !== undefined) {
                    if (typeof cell.value === 'object' && cell.value.richText) {
                        value = cell.value.richText.map((t: any) => t.text).join('')
                    } else {
                        value = String(cell.value)
                    }
                }

                targetCell.content = value

                if (cell.font) {
                    if (cell.font.bold) targetCell.style.fontWeight = 'bold'
                    if (cell.font.italic) targetCell.style.fontStyle = 'italic'
                    if (cell.font.size) targetCell.style.fontSize = cell.font.size
                    if (cell.font.color) {
                        targetCell.style.textColor = cell.font.color.argb ?
                            `#${cell.font.color.argb}` : '#000000'
                    }
                }

                if (cell.alignment) {
                    if (cell.alignment.horizontal) {
                        targetCell.style.textAlign = cell.alignment.horizontal
                    }
                    if (cell.alignment.vertical) {
                        targetCell.style.verticalAlign = cell.alignment.vertical
                    }
                }

                if (cell.fill && cell.fill.fgColor) {
                    targetCell.style.backgroundColor = cell.fill.fgColor.argb ?
                        `#${cell.fill.fgColor.argb}` : ''
                }
            })
        })

        cells.value = newCells
        rebuildSpanMap()

        console.log('Loaded cells:', Object.keys(newCells).length)
    }

    // Инициализация
    if (initialModel && initialModel.length > 0) {
        for (let rowIdx = 0; rowIdx < initialModel.length; rowIdx++) {
            const row = initialModel[rowIdx]
            if (row?.cells) {
                for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
                    const cell = row.cells[colIdx]
                    if (cell) {
                        cells.value[getAddress(rowIdx, colIdx)] = JSON.parse(JSON.stringify(cell))
                    }
                }
            }
        }
    }

    if (Object.keys(cells.value).length === 0) {
        cells.value[getAddress(0, 0)] = { ...createEmptyCell(), content: 'Пример текста' }
        cells.value[getAddress(0, 1)] = { ...createEmptyCell(), content: '12345' }
        cells.value[getAddress(1, 0)] = { ...createEmptyCell(), content: 'Другая строка' }
    }

    rebuildSpanMap()

    return {
        cells,
        spanMap,
        getCellForRender,
        getMasterCell,
        updateCellContent,
        applyStyleToSelected,
        applyBorder,
        removeAllBorders,
        mergeSelected,
        unmergeCell,
        getCurrentStyle,
        toRows,
        loadFromExcel,
        rebuildSpanMap,
    }
}