import { ref, type Ref } from 'vue'
import * as ExcelJS from 'exceljs'
import { colToName, type TableCell } from './useTableData'

const DEFAULT_COL_WIDTH = 100
const DEFAULT_ROW_HEIGHT = 22

export function useExcel(
    colsCount: Ref<number>,
    rowsCount: Ref<number>,
    columnWidths: Ref<number[]>,
    rowHeights: Ref<number[]>,
    getCellForRender: (row: number, col: number) => TableCell,
    loadFromExcel: (worksheet: ExcelJS.Worksheet) => void
) {
    const fileInput = ref<HTMLInputElement | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    async function exportToExcel() {
        try {
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('Sheet1')

            // Устанавливаем ширину колонок
            for (let c = 0; c < colsCount.value; c++) {
                worksheet.getColumn(c + 1).width = (columnWidths.value[c] || DEFAULT_COL_WIDTH) / 7
            }

            // Устанавливаем высоту строк
            for (let r = 0; r < rowsCount.value; r++) {
                worksheet.getRow(r + 1).height = rowHeights.value[r] || DEFAULT_ROW_HEIGHT
            }

            // Заполняем ячейки
            for (let row = 0; row < rowsCount.value; row++) {
                for (let col = 0; col < colsCount.value; col++) {
                    const cell = getCellForRender(row, col)
                    if (cell.hidden) continue

                    const excelCell = worksheet.getCell(row + 1, col + 1)
                    excelCell.value = cell.content

                    // Стили шрифта
                    excelCell.font = {
                        bold: cell.style.fontWeight === 'bold',
                        italic: cell.style.fontStyle === 'italic',
                        size: cell.style.fontSize,
                        color: { argb: cell.style.textColor.replace('#', '') },
                    }

                    // Выравнивание
                    excelCell.alignment = {
                        horizontal: cell.style.textAlign,
                        vertical: cell.style.verticalAlign === 'middle' ? 'middle' : cell.style.verticalAlign,
                    }

                    // Цвет фона
                    if (cell.style.backgroundColor) {
                        excelCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: cell.style.backgroundColor.replace('#', '') },
                        }
                    }

                    // Границы
                    const borderStyle = { style: 'thin' }
                    excelCell.border = {
                        top: cell.style.borderTop ? borderStyle : undefined,
                        bottom: cell.style.borderBottom ? borderStyle : undefined,
                        left: cell.style.borderLeft ? borderStyle : undefined,
                        right: cell.style.borderRight ? borderStyle : undefined,
                    }

                    // Объединение ячеек
                    if (cell.rowspan > 1 || cell.colspan > 1) {
                        const startCol = colToName(col)
                        const endCol = colToName(col + cell.colspan - 1)
                        worksheet.mergeCells(`${startCol}${row + 1}:${endCol}${row + cell.rowspan}`)
                    }
                }
            }

            // Сохраняем файл
            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = 'table.xlsx'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(link.href)

        } catch (e) {
            console.error('Export error:', e)
            error.value = 'Ошибка при экспорте'
        }
    }

    function onImportClick() {
        fileInput.value?.click()
    }

    async function onImportFile(event: Event) {
        try {
            const input = event.target as HTMLInputElement

            if (!input.files?.length) {
                console.log('Файл не выбран')
                return
            }

            isLoading.value = true
            error.value = null

            console.log('Файл:', input.files[0].name)

            const buffer = await input.files[0].arrayBuffer()
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(buffer)

            console.log('Листов:', workbook.worksheets.length)

            const worksheet = workbook.worksheets[0]

            if (!worksheet) {
                error.value = 'Не найден лист в Excel файле'
                return
            }

            console.log('Worksheet:', worksheet.name)
            console.log('Строк:', worksheet.rowCount)
            console.log('Колонок:', worksheet.columnCount)

            // Вызываем загрузку данных
            loadFromExcel(worksheet)

            // Обновляем количество строк и колонок на основе загруженных данных
            const newRowsCount = worksheet.rowCount || 0
            const newColsCount = worksheet.columnCount || 0

            if (newRowsCount > 0) {
                rowsCount.value = Math.max(rowsCount.value, newRowsCount + 10)
                initRowHeights()
            }

            if (newColsCount > 0) {
                colsCount.value = Math.max(colsCount.value, newColsCount + 5)
                initColumnWidths()
            }

            input.value = ''

        } catch (e) {
            console.error('IMPORT ERROR', e)
            error.value = 'Ошибка при импорте файла'
        } finally {
            isLoading.value = false
        }
    }

    return {
        fileInput,
        exportToExcel,
        onImportClick,
        onImportFile,
        isLoading,
        error,
    }
}