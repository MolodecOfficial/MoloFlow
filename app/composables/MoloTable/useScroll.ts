import { ref, computed, type Ref } from 'vue'

const DEFAULT_COL_WIDTH = 100
const DEFAULT_ROW_HEIGHT = 22

const OVERSCAN = 8

export function useScroll(
    colsCount: Ref<number>,
    rowsCount: Ref<number>,
    columnWidths: Ref<number[]>,
    rowHeights: Ref<number[]>
) {
    const scrollTop = ref(0)
    const scrollLeft = ref(0)

    const containerHeight = ref(0)
    const containerWidth = ref(0)

    let scrollRAF: number | null = null

    // ==========================================
    // OFFSETS
    // ==========================================

    const colOffsets = computed(() => {
        const offsets = new Array(colsCount.value + 1)

        offsets[0] = 0

        for (let i = 0; i < colsCount.value; i++) {
            offsets[i + 1] =
                offsets[i] +
                (columnWidths.value[i] ?? DEFAULT_COL_WIDTH)
        }

        return offsets
    })

    const rowOffsets = computed(() => {
        const offsets = new Array(rowsCount.value + 1)

        offsets[0] = 0

        for (let i = 0; i < rowsCount.value; i++) {
            offsets[i + 1] =
                offsets[i] +
                (rowHeights.value[i] ?? DEFAULT_ROW_HEIGHT)
        }

        return offsets
    })

    // ==========================================
    // BINARY SEARCH
    // ==========================================

    /**
     * Последний индекс
     * offsets[index] <= target
     */
    function findLastIndex(
        offsets: number[],
        target: number
    ): number {
        let left = 0
        let right = offsets.length - 1

        let answer = 0

        while (left <= right) {
            const mid = (left + right) >> 1

            if (offsets[mid] <= target) {
                answer = mid
                left = mid + 1
            } else {
                right = mid - 1
            }
        }

        return answer
    }

    /**
     * Первый индекс
     * offsets[index] >= target
     */
    function findFirstIndex(
        offsets: number[],
        target: number
    ): number {
        let left = 0
        let right = offsets.length - 1

        let answer = offsets.length - 1

        while (left <= right) {
            const mid = (left + right) >> 1

            if (offsets[mid] >= target) {
                answer = mid
                right = mid - 1
            } else {
                left = mid + 1
            }
        }

        return answer
    }

    // ==========================================
    // ROWS
    // ==========================================

    const visibleStartRow = computed(() => {
        const idx = findLastIndex(
            rowOffsets.value,
            scrollTop.value
        )

        return Math.max(
            0,
            Math.min(
                rowsCount.value - 1,
                idx - OVERSCAN
            )
        )
    })

    const visibleEndRow = computed(() => {
        const bottom =
            scrollTop.value +
            containerHeight.value

        const idx = findFirstIndex(
            rowOffsets.value,
            bottom
        )

        return Math.max(
            visibleStartRow.value + 1,
            Math.min(
                rowsCount.value,
                idx + OVERSCAN
            )
        )
    })

    // ==========================================
    // COLS
    // ==========================================

    const visibleStartCol = computed(() => {
        const idx = findLastIndex(
            colOffsets.value,
            scrollLeft.value
        )

        return Math.max(
            0,
            Math.min(
                colsCount.value - 1,
                idx - OVERSCAN
            )
        )
    })

    const visibleEndCol = computed(() => {
        const right =
            scrollLeft.value +
            containerWidth.value

        const idx = findFirstIndex(
            colOffsets.value,
            right
        )

        return Math.max(
            visibleStartCol.value + 1,
            Math.min(
                colsCount.value,
                idx + OVERSCAN
            )
        )
    })

    // ==========================================
    // ARRAYS
    // ==========================================

    const visibleRows = computed(() => {
        const rows: number[] = []

        for (
            let i = visibleStartRow.value;
            i < visibleEndRow.value;
            i++
        ) {
            rows.push(i)
        }

        return rows
    })

    const visibleCols = computed(() => {
        const cols: number[] = []

        for (
            let i = visibleStartCol.value;
            i < visibleEndCol.value;
            i++
        ) {
            cols.push(i)
        }

        return cols
    })

    // ==========================================
    // VIRTUAL OFFSET
    // ==========================================

    const virtualTop = computed(
        () =>
            rowOffsets.value[
                visibleStartRow.value
                ] ?? 0
    )

    const virtualLeft = computed(
        () =>
            colOffsets.value[
                visibleStartCol.value
                ] ?? 0
    )

    // ==========================================
    // SCROLL
    // ==========================================

    function handleScroll(el: HTMLElement) {
        if (scrollRAF !== null) return

        scrollRAF = requestAnimationFrame(() => {
            scrollTop.value = Math.max(
                0,
                el.scrollTop
            )

            scrollLeft.value = Math.max(
                0,
                el.scrollLeft
            )

            scrollRAF = null
        })
    }

    function updateContainerSize(
        height: number,
        width: number
    ) {
        containerHeight.value = Math.max(
            0,
            height
        )

        containerWidth.value = Math.max(
            0,
            width
        )
    }

    return {
        scrollTop,
        scrollLeft,

        containerHeight,
        containerWidth,

        colOffsets,
        rowOffsets,

        visibleRows,
        visibleCols,

        visibleStartRow,
        visibleEndRow,

        visibleStartCol,
        visibleEndCol,

        virtualTop,
        virtualLeft,

        handleScroll,
        updateContainerSize,
    }
}