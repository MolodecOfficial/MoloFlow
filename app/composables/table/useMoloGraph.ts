// app/composables/table/useMoloGraph.ts
//
// Универсальный анализатор таблиц и сборщик графиков.
// Никакой привязки к названиям колонок: тип и роль колонки определяются только по значениям.

export type ColumnDataType = 'number' | 'date' | 'category' | 'id' | 'text'
export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median'
export type ChartKind = 'bar' | 'hbar' | 'line' | 'area' | 'donut' | 'histogram'
export type TimeGrain = 'auto' | 'day' | 'week' | 'month' | 'year'

export interface ColumnAnalysis {
    index: number
    header: string
    type: ColumnDataType
    filled: number
    fillRate: number
    uniqueCount: number
    sampleValues: any[]
    /** Знак единицы измерения, найденный в значениях: ₽, $, %, … */
    unit?: string
    /** Целые числа с малым числом вариантов (оценки, количества) — подходят и как категория */
    discrete?: boolean
    numericStats?: {
        min: number
        max: number
        sum: number
        avg: number
        median: number
        count: number
    }
    dateRange?: { min: number; max: number }
}

export interface ChartSpec {
    kind: ChartKind
    /** Колонка по оси X (категория / дата / число) */
    x: number
    /** Колонка-показатель, -1 = считать количество строк */
    y: number
    agg: Aggregation
    /** Сколько групп показывать для категорий */
    topN: number
    grain: TimeGrain
}

export interface ChartPoint {
    label: string
    fullLabel: string
    value: number
    /** Доля от итога (только для сумм и количеств) */
    share: number | null
    isOther?: boolean
}

export interface ChartHighlight {
    label: string
    value: string
    tone?: 'up' | 'down' | 'neutral'
}

export interface ChartData {
    kind: ChartKind
    title: string
    xTitle: string
    yTitle: string
    unit: string
    agg: Aggregation
    additive: boolean
    isTime: boolean
    points: ChartPoint[]
    total: number
    usedRows: number
    skippedRows: number
    hiddenCount: number
    highlights: ChartHighlight[]
}

export interface MetricSummary {
    label: string
    value: string | number
    subText?: string
    trend?: 'up' | 'down' | 'neutral'
    delta?: string
    icon: 'rows' | 'sum' | 'period' | 'leader'
}

export interface ChartPreset {
    id: string
    title: string
    spec: ChartSpec
    chart: ChartData
}

/* ───────────────────────────── Константы ───────────────────────────── */

const EMPTY_LABEL = 'Не заполнено'
const OTHER_LABEL = 'Прочее'
const MAX_BUCKETS = 120

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_LONG = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

export const AGG_LABEL: Record<Aggregation, string> = {
    sum: 'Сумма',
    avg: 'Среднее',
    count: 'Количество значений',
    min: 'Минимум',
    max: 'Максимум',
    median: 'Медиана',
}

export const KIND_LABEL: Record<ChartKind, string> = {
    area: 'Область',
    line: 'Линия',
    bar: 'Столбцы',
    hbar: 'Рейтинг',
    donut: 'Кольцо',
    histogram: 'Гистограмма',
}

export const GRAIN_LABEL: Record<TimeGrain, string> = {
    auto: 'Авто',
    day: 'По дням',
    week: 'По неделям',
    month: 'По месяцам',
    year: 'По годам',
}

/* ───────────────────────────── Форматирование ───────────────────────────── */

export function formatValue(v: number, unit = '', compact = false): string {
    if (!Number.isFinite(v)) return '—'
    const abs = Math.abs(v)
    const opts: Intl.NumberFormatOptions = compact && abs >= 10000
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { maximumFractionDigits: abs >= 1000 ? 0 : abs >= 1 ? 2 : 4 }
    const s = new Intl.NumberFormat('ru-RU', opts).format(v)
    return unit ? `${s}\u00a0${unit}` : s
}

function niceNum(range: number, round: boolean): number {
    const exp = Math.floor(Math.log10(range))
    const f = range / 10 ** exp
    let nf: number
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
    else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
    return nf * 10 ** exp
}

/** «Красивые» деления оси: 0, 250, 500, 750, 1000 вместо 0, 237.5, 475… */
export function niceScale(min: number, max: number, count = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] }
    if (min === max) {
        if (min === 0) max = 1
        else if (min > 0) min = 0
        else max = 0
    }
    const range = niceNum(max - min, false)
    const step = niceNum(range / Math.max(1, count - 1), true)
    const lo = Math.floor(min / step) * step
    const hi = Math.ceil(max / step) * step
    const n = Math.max(1, Math.round((hi - lo) / step))
    const ticks = Array.from({ length: n + 1 }, (_, i) => +(lo + i * step).toPrecision(12))
    return { lo: ticks[0]!, hi: ticks[n]!, step, ticks }
}

/* ───────────────────────────── Парсинг значений ───────────────────────────── */

const UNIT_RE = /[₽$€£¥₸₴%]|руб(?:\.|лей|ля)?|р\.|usd|eur|rub|kzt/gi
const UNIT_SYMBOL = /[₽$€£¥₸₴%]/

/** Заглушки вместо пустых значений: «—», «n/a», «null» … считаются пустой ячейкой */
const EMPTY_TOKENS = new Set(['—', '–', '-', '−', 'n/a', 'na', 'null', 'undefined', 'нет данных', 'н/д'])

const cellStr = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = String(v).trim()
    return EMPTY_TOKENS.has(s.toLowerCase()) ? '' : s
}

/**
 * Строгий разбор числа: "1 500,50 ₽", "$45.2", "1,234.56", "-12%" -> число.
 * Идентификаторы, UUID, телефоны, коды с ведущим нулём и даты числами НЕ считаются.
 */
export function parseNumeric(val: unknown): number | null {
    if (val === null || val === undefined || typeof val === 'boolean') return null
    if (typeof val === 'number') return Number.isFinite(val) ? val : null

    let s = String(val).trim()
    if (!s || s.length > 40) return null
    s = s.replace(UNIT_RE, '').replace(/[\s\u00a0\u202f'’]/g, '').replace(/[−–—]/g, '-')
    if (!/^[-+]?\d[\d.,]*$/.test(s)) return null
    if (/^[-+]?0\d/.test(s)) return null

    const dots = (s.match(/\./g) || []).length
    const commas = (s.match(/,/g) || []).length
    if (dots && commas) {
        const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
        const thou = dec === '.' ? ',' : '.'
        s = s.split(thou).join('').replace(dec, '.')
    } else if (commas > 1) {
        s = s.replace(/,/g, '')
    } else if (commas === 1) {
        s = s.replace(',', '.')
    } else if (dots > 1) {
        return null
    }

    if (s.replace(/\D/g, '').length > 15) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i
const DMY_RE = /^(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

function buildLocal(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number | null {
    if (y < 1900 || y > 2100) return null
    const dt = new Date(y, mo - 1, d, h, mi, s)
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt.getTime() : null
}

/** Дата -> timestamp (ISO, DD.MM.YYYY, DD/MM/YY, с временем и без). Числа датами не считаются. */
export function parseDate(val: unknown): number | null {
    if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val.getTime()
    if (typeof val !== 'string') return null
    const s = val.trim()
    if (s.length < 6 || s.length > 40) return null

    const iso = s.match(ISO_RE)
    if (iso) {
        if (iso[7]) {
            const t = new Date(s).getTime()
            return Number.isNaN(t) ? null : t
        }
        return buildLocal(+iso[1]!, +iso[2]!, +iso[3]!, +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0))
    }

    const dmy = s.match(DMY_RE)
    if (dmy) {
        let y = +dmy[3]!
        if (y < 100) y += 2000
        return buildLocal(y, +dmy[2]!, +dmy[1]!, +(dmy[4] ?? 0), +(dmy[5] ?? 0), +(dmy[6] ?? 0))
    }
    return null
}

/* ───────────────────────────── Анализ колонок ───────────────────────────── */

export function inspectMatrix(headers: string[], rows: any[][]): ColumnAnalysis[] {
    const total = rows.length
    if (!total) return []

    return headers.map((header, idx) => {
        let filled = 0
        let numCount = 0
        let dateCount = 0
        let allInt = true
        let lenSum = 0
        let spaced = 0
        let sum = 0
        let min = Infinity
        let max = -Infinity
        let dMin = Infinity
        let dMax = -Infinity

        const unique = new Set<string>()
        const nums: number[] = []
        const sample: any[] = []
        const unitVotes = new Map<string, number>()

        for (let r = 0; r < total; r++) {
            const raw = rows[r]?.[idx]
            const str = cellStr(raw)
            if (!str) continue

            filled++
            unique.add(str)
            lenSum += str.length
            if (str.includes(' ')) spaced++
            if (sample.length < 5) sample.push(raw)

            const ts = parseDate(raw)
            if (ts !== null) {
                dateCount++
                if (ts < dMin) dMin = ts
                if (ts > dMax) dMax = ts
                continue
            }

            const n = parseNumeric(raw)
            if (n !== null) {
                numCount++
                sum += n
                nums.push(n)
                if (n < min) min = n
                if (n > max) max = n
                if (!Number.isInteger(n)) allInt = false
                if (typeof raw === 'string') {
                    const m = raw.match(UNIT_SYMBOL)
                    if (m) unitVotes.set(m[0], (unitVotes.get(m[0]) || 0) + 1)
                }
            }
        }

        const uniqueCount = unique.size
        const uRatio = filled ? uniqueCount / filled : 0

        let unit: string | undefined
        let bestVotes = 0
        unitVotes.forEach((v, k) => {
            if (v > bestVotes) {
                bestVotes = v
                unit = k
            }
        })
        if (unit && bestVotes < numCount * 0.5) unit = undefined

        let type: ColumnDataType = 'category'
        if (!filled) {
            type = 'text'
        } else if (dateCount / filled >= 0.8) {
            type = 'date'
        } else if (numCount / filled >= 0.8) {
            // плотная последовательность целых (1,2,3…N) или очень длинные числа — это идентификатор, не показатель
            const dense = allInt && !unit && filled >= 12 && uRatio > 0.95 && (max - min + 1) / filled <= 1.3
            const huge = allInt && !unit && max >= 1e9 && uRatio > 0.95
            type = dense || huge ? 'id' : 'number'
        } else {
            const avgLen = lenSum / filled
            const spaceRatio = spaced / filled
            if (uniqueCount <= 1) type = 'category'
            else if (uRatio >= 0.9 && filled >= 12) type = avgLen > 32 || spaceRatio > 0.4 ? 'text' : 'id'
            else if (uniqueCount <= 60 || uRatio <= 0.5) type = 'category'
            else type = 'text'
        }

        const analysis: ColumnAnalysis = {
            index: idx,
            header: header || `Колонка ${idx + 1}`,
            type,
            filled,
            fillRate: filled / total,
            uniqueCount,
            sampleValues: sample,
        }

        if (type === 'number' && nums.length) {
            const sorted = [...nums].sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            analysis.numericStats = {
                min,
                max,
                sum,
                avg: sum / nums.length,
                median: sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2,
                count: nums.length,
            }
            analysis.unit = unit
            analysis.discrete = allInt && uniqueCount <= 12
        }
        if (type === 'date') analysis.dateRange = { min: dMin, max: dMax }

        return analysis
    })
}

/* ───────────────────────────── Агрегирование ───────────────────────────── */

interface Acc {
    n: number
    sum: number
    min: number
    max: number
    vals?: number[]
}

const newAcc = (keep: boolean): Acc => ({ n: 0, sum: 0, min: Infinity, max: -Infinity, vals: keep ? [] : undefined })

function pushAcc(a: Acc, v: number) {
    a.n++
    a.sum += v
    if (v < a.min) a.min = v
    if (v > a.max) a.max = v
    a.vals?.push(v)
}

function resolveAcc(a: Acc, agg: Aggregation): number {
    switch (agg) {
        case 'count': return a.n
        case 'sum': return a.sum
        case 'avg': return a.n ? a.sum / a.n : 0
        case 'min': return a.n ? a.min : 0
        case 'max': return a.n ? a.max : 0
        case 'median': {
            const v = a.vals ? [...a.vals].sort((x, y) => x - y) : []
            if (!v.length) return 0
            const mid = Math.floor(v.length / 2)
            return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2
        }
    }
}

const isAdditive = (agg: Aggregation) => agg === 'sum' || agg === 'count'

/* ───────────────────────────── Время ───────────────────────────── */

const GRAINS: Exclude<TimeGrain, 'auto'>[] = ['day', 'week', 'month', 'year']
const GRAIN_MS = { day: 864e5, week: 6048e5, month: 2.63e9, year: 3.156e10 }

function resolveGrain(requested: TimeGrain, min: number, max: number): Exclude<TimeGrain, 'auto'> {
    const spanDays = (max - min) / 864e5
    let i = requested === 'auto'
        ? (spanDays <= 62 ? 0 : spanDays <= 240 ? 1 : spanDays <= 1100 ? 2 : 3)
        : GRAINS.indexOf(requested)
    const limit = requested === 'auto' ? MAX_BUCKETS : 400
    while (i < 3 && (max - min) / GRAIN_MS[GRAINS[i]!] + 1 > limit) i++
    return GRAINS[i]!
}

function startOf(ts: number, g: Exclude<TimeGrain, 'auto'>): number {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = d.getMonth()
    if (g === 'day') return new Date(y, m, d.getDate()).getTime()
    if (g === 'week') return new Date(y, m, d.getDate() - ((d.getDay() + 6) % 7)).getTime()
    if (g === 'month') return new Date(y, m, 1).getTime()
    return new Date(y, 0, 1).getTime()
}

function addGrain(ts: number, g: Exclude<TimeGrain, 'auto'>): number {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = d.getMonth()
    if (g === 'day') return new Date(y, m, d.getDate() + 1).getTime()
    if (g === 'week') return new Date(y, m, d.getDate() + 7).getTime()
    if (g === 'month') return new Date(y, m + 1, 1).getTime()
    return new Date(y + 1, 0, 1).getTime()
}

const pad = (n: number) => String(n).padStart(2, '0')
const longDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

function bucketLabels(ts: number, g: Exclude<TimeGrain, 'auto'>, withYear: boolean) {
    const d = new Date(ts)
    const dm = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`
    const short = withYear ? `${dm}.${String(d.getFullYear()).slice(2)}` : dm
    if (g === 'day') return { label: short, fullLabel: longDate.format(d) }
    if (g === 'week') return { label: short, fullLabel: `Неделя с ${longDate.format(d)}` }
    if (g === 'month') {
        return {
            label: `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
            fullLabel: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`,
        }
    }
    return { label: String(d.getFullYear()), fullLabel: `${d.getFullYear()} год` }
}

/* ───────────────────────────── Подписи и допустимые типы ───────────────────────────── */

export function chartTitle(spec: ChartSpec, analysis: ColumnAnalysis[]): string {
    const x = analysis[spec.x]?.header ?? '—'
    const yCol = spec.y >= 0 ? analysis[spec.y] : undefined
    const agg: Aggregation = yCol ? spec.agg : 'count'
    const xCol = analysis[spec.x]

    if (spec.kind === 'histogram' || (xCol?.type === 'number' && !xCol.discrete)) return `Распределение: «${x}»`
    const what = yCol
        ? agg === 'count' ? `Количество значений «${yCol.header}»` : `${AGG_LABEL[agg]} «${yCol.header}»`
        : 'Количество записей'
    return xCol?.type === 'date' ? `Динамика: ${what.charAt(0).toLowerCase()}${what.slice(1)}` : `${what} по «${x}»`
}

/** Какие виды графиков имеют смысл для выбранной оси X */
export function kindsFor(col: ColumnAnalysis | undefined, additive = true): ChartKind[] {
    if (!col) return []
    if (col.type === 'date') return ['area', 'line', 'bar']
    if (col.type === 'number' && !col.discrete) return ['histogram']
    const kinds: ChartKind[] = ['hbar', 'bar']
    if (additive) kinds.push('donut')
    if (col.type === 'number') kinds.push('histogram')
    return kinds
}

export function defaultAgg(col: ColumnAnalysis | undefined): Aggregation {
    return col?.unit === '%' ? 'avg' : 'sum'
}

/* ───────────────────────────── Построение графика ───────────────────────────── */

type ChartBase = Pick<ChartData, 'title' | 'xTitle' | 'yTitle' | 'unit' | 'agg'>

function emptyChart(base: ChartBase, kind: ChartKind, used: number, skipped: number): ChartData {
    return {
        ...base,
        kind,
        additive: isAdditive(base.agg),
        isTime: false,
        points: [],
        total: 0,
        usedRows: used,
        skippedRows: skipped,
        hiddenCount: 0,
        highlights: [],
    }
}

function pct(v: number, digits = 1): string {
    return `${(v * 100).toFixed(digits).replace('.', ',')}%`
}

function buildHistogram(col: ColumnAnalysis, rows: any[][], base: ChartBase): ChartData {
    const nums: number[] = []
    let skipped = 0
    for (const row of rows) {
        const n = parseNumeric(row[col.index])
        if (n === null) skipped++
        else nums.push(n)
    }
    const hBase: ChartBase = { ...base, unit: '', yTitle: 'Количество записей', agg: 'count' }
    if (!nums.length) return emptyChart(hBase, 'histogram', 0, skipped)

    nums.sort((a, b) => a - b)
    const n = nums.length
    const q = (p: number) => nums[Math.min(n - 1, Math.floor(p * (n - 1)))]!
    const min = nums[0]!
    const max = nums[n - 1]!
    let hi = max
    let clipped = false
    const p99 = q(0.99)
    if (n >= 50 && max - min > (p99 - min) * 2 && p99 > min) {
        hi = p99
        clipped = true
    }

    const bins = Math.min(14, Math.max(6, Math.ceil(Math.log2(n) + 1)))
    const sc = niceScale(min, hi, bins + 1)
    const count = Math.max(1, Math.round((sc.hi - sc.lo) / sc.step))
    const counts = new Array<number>(count).fill(0)
    for (const v of nums) {
        const i = Math.min(count - 1, Math.max(0, Math.floor((v - sc.lo) / sc.step)))
        counts[i]!++
    }

    const u = col.unit ?? ''
    const points: ChartPoint[] = counts.map((c, i) => {
        const a = sc.lo + i * sc.step
        const b = a + sc.step
        const last = i === count - 1
        return {
            label: formatValue(a, '', true),
            fullLabel: clipped && last ? `от ${formatValue(a, u)} и выше` : `${formatValue(a, u)} – ${formatValue(b, u)}`,
            value: c,
            share: c / n,
        }
    })

    const avg = nums.reduce((s, v) => s + v, 0) / n
    return {
        ...hBase,
        kind: 'histogram',
        additive: true,
        isTime: false,
        points,
        total: n,
        usedRows: n,
        skippedRows: skipped,
        hiddenCount: 0,
        highlights: [
            { label: 'Среднее', value: formatValue(avg, u) },
            { label: 'Медиана', value: formatValue(q(0.5), u) },
            { label: 'Диапазон', value: `${formatValue(min, u, true)} – ${formatValue(max, u, true)}` },
        ],
    }
}

export function buildChart(
    spec: ChartSpec,
    headers: string[],
    rows: any[][],
    analysis: ColumnAnalysis[] = inspectMatrix(headers, rows),
): ChartData | null {
    const xCol = analysis[spec.x]
    if (!xCol) return null

    const yCol = spec.y >= 0 ? analysis[spec.y] : undefined
    const agg: Aggregation = yCol ? spec.agg : 'count'
    const unit = agg === 'count' ? '' : yCol?.unit ?? ''
    const additive = isAdditive(agg)
    const yTitle = yCol
        ? agg === 'count' ? `Количество значений «${yCol.header}»` : `${AGG_LABEL[agg]}: ${yCol.header}`
        : 'Количество записей'
    const base: ChartBase = { title: chartTitle(spec, analysis), xTitle: xCol.header, yTitle, unit, agg }

    if (spec.kind === 'histogram' || (xCol.type === 'number' && !xCol.discrete)) {
        return buildHistogram(xCol, rows, base)
    }

    const keep = agg === 'median'
    const measureOf = (row: any[]): number | null => {
        if (!yCol) return 1
        const raw = row[yCol.index]
        return agg === 'count' ? (cellStr(raw) ? 1 : null) : parseNumeric(raw)
    }
    const fmt = (v: number) => formatValue(v, unit)

    /* ── Ось времени ── */
    if (xCol.type === 'date') {
        const entries: { t: number; v: number }[] = []
        let skipped = 0
        let min = Infinity
        let max = -Infinity
        for (const row of rows) {
            const t = parseDate(row[xCol.index])
            const v = measureOf(row)
            if (t === null || v === null) {
                skipped++
                continue
            }
            entries.push({ t, v })
            if (t < min) min = t
            if (t > max) max = t
        }
        if (!entries.length) return emptyChart(base, spec.kind, 0, skipped)

        const grain = resolveGrain(spec.grain, min, max)
        const map = new Map<number, Acc>()
        for (const e of entries) {
            const k = startOf(e.t, grain)
            let acc = map.get(k)
            if (!acc) map.set(k, (acc = newAcc(keep)))
            pushAcc(acc, e.v)
        }

        let keys = [...map.keys()].sort((a, b) => a - b)
        if (additive) {
            const filled: number[] = []
            for (let t = keys[0]!; t <= keys[keys.length - 1]!; t = addGrain(t, grain)) filled.push(t)
            keys = filled
        }

        const withYear = (max - min) / 864e5 > 300
        const points: ChartPoint[] = keys.map((k) => {
            const acc = map.get(k)
            return { ...bucketLabels(k, grain, withYear), value: acc ? resolveAcc(acc, agg) : 0, share: null }
        })
        const total = points.reduce((s, p) => s + p.value, 0)
        if (additive && total) points.forEach((p) => (p.share = p.value / total))

        const highlights: ChartHighlight[] = []
        highlights.push(additive
            ? { label: 'Итого за период', value: fmt(total) }
            : { label: 'Среднее по периодам', value: fmt(total / points.length) })
        const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]!)
        highlights.push({ label: 'Пик', value: `${peak.fullLabel}: ${fmt(peak.value)}` })

        if (points.length >= 4) {
            const mid = Math.floor(points.length / 2)
            const part = (arr: ChartPoint[]) => {
                const s = arr.reduce((acc, p) => acc + p.value, 0)
                return additive ? s : s / arr.length
            }
            const a = part(points.slice(0, mid))
            const b = part(points.slice(mid))
            if (a !== 0) {
                const d = (b - a) / Math.abs(a)
                highlights.push({
                    label: 'Вторая половина к первой',
                    value: `${d >= 0 ? '+' : ''}${pct(d)}`,
                    tone: Math.abs(d) < 0.005 ? 'neutral' : d > 0 ? 'up' : 'down',
                })
            }
        }

        return {
            ...base,
            kind: spec.kind,
            additive,
            isTime: true,
            points,
            total,
            usedRows: entries.length,
            skippedRows: skipped,
            hiddenCount: 0,
            highlights,
        }
    }

    /* ── Категории ── */
    const groups = new Map<string, Acc>()
    let skipped = 0
    let used = 0
    for (const row of rows) {
        const v = measureOf(row)
        if (v === null) {
            skipped++
            continue
        }
        const key = cellStr(row[xCol.index]) || EMPTY_LABEL
        let acc = groups.get(key)
        if (!acc) groups.set(key, (acc = newAcc(keep)))
        pushAcc(acc, v)
        used++
    }
    if (!groups.size) return emptyChart(base, spec.kind, 0, skipped)

    type Item = { label: string; value: number; other?: boolean }
    let items: Item[] = [...groups.entries()].map(([label, acc]) => ({ label, value: resolveAcc(acc, agg) }))
    const natural = xCol.type === 'number'
    if (natural) items.sort((a, b) => (parseNumeric(a.label) ?? 0) - (parseNumeric(b.label) ?? 0))
    else items.sort((a, b) => b.value - a.value)

    let hidden = 0
    const limit = Math.max(2, spec.topN || 10)
    if (!natural && items.length > limit) {
        const head = items.slice(0, limit)
        const rest = items.slice(limit)
        if (additive && rest.length > 1) {
            head.push({ label: `${OTHER_LABEL} (${rest.length})`, value: rest.reduce((s, i) => s + i.value, 0), other: true })
        } else if (additive) {
            head.push(rest[0]!)
        } else {
            hidden = rest.length
        }
        items = head
    } else if (natural && items.length > 40) {
        hidden = items.length - 40
        items = items.slice(0, 40)
    }

    const total = items.reduce((s, i) => s + i.value, 0)
    const points: ChartPoint[] = items.map((i) => ({
        label: i.label,
        fullLabel: i.label,
        value: i.value,
        share: additive && total ? i.value / total : null,
        isOther: i.other,
    }))

    const real = points.filter((p) => !p.isOther)
    const leader = real.reduce((a, b) => (b.value > a.value ? b : a), real[0]!)
    const highlights: ChartHighlight[] = [
        { label: 'Лидер', value: `${leader.label}: ${fmt(leader.value)}${leader.share !== null ? ` · ${pct(leader.share, 0)}` : ''}` },
    ]
    if (additive) {
        highlights.push({ label: 'Итого', value: fmt(total) })
        if (real.length > 3 && total) {
            const top3 = [...real].sort((a, b) => b.value - a.value).slice(0, 3).reduce((s, p) => s + p.value, 0)
            highlights.push({ label: 'Доля тройки лидеров', value: pct(top3 / total, 0) })
        }
    } else {
        const lowest = real.reduce((a, b) => (b.value < a.value ? b : a), real[0]!)
        highlights.push({ label: 'Минимум', value: `${lowest.label}: ${fmt(lowest.value)}` })
    }

    return {
        ...base,
        kind: spec.kind,
        additive,
        isTime: false,
        points,
        total,
        usedRows: used,
        skippedRows: skipped,
        hiddenCount: hidden,
        highlights,
    }
}

/* ───────────────────────────── Автоподбор графиков ───────────────────────────── */

export function suggestSpecs(analysis: ColumnAnalysis[], rowCount: number): ChartSpec[] {
    const measures = analysis
        .filter((c) => c.type === 'number' && c.numericStats && c.numericStats.max !== c.numericStats.min && c.fillRate >= 0.3)
        .map((c) => ({ c, score: (c.unit ? 2 : 0) + (c.discrete ? 0 : 1) + c.fillRate }))
        .sort((a, b) => b.score - a.score)
        .map((m) => m.c)
        .slice(0, 3)

    const dims = analysis
        .filter((c) => c.type === 'category' && c.uniqueCount >= 2 && c.uniqueCount <= 60 && c.fillRate >= 0.5)
        .map((c) => ({ c, score: c.fillRate - Math.abs(Math.log(c.uniqueCount / 6)) }))
        .sort((a, b) => b.score - a.score)
        .map((d) => d.c)
        .slice(0, 3)

    const time = analysis.find((c) => c.type === 'date' && c.fillRate >= 0.5)
    const primary = measures[0]
    const specs: ChartSpec[] = []
    const add = (s: Partial<ChartSpec> & Pick<ChartSpec, 'kind' | 'x'>) =>
        specs.push({ y: -1, agg: 'count', topN: 10, grain: 'auto', ...s })

    if (time) {
        if (primary) add({ kind: 'area', x: time.index, y: primary.index, agg: defaultAgg(primary) })
        add({ kind: primary ? 'line' : 'area', x: time.index })
    }

    dims.forEach((d, i) => {
        add({ kind: d.uniqueCount <= 7 ? 'donut' : 'hbar', x: d.index, topN: 8 })
        if (primary && i < 2) {
            add({ kind: d.uniqueCount <= 6 ? 'bar' : 'hbar', x: d.index, y: primary.index, agg: defaultAgg(primary) })
        }
    })

    if (primary && rowCount >= 20) add({ kind: 'histogram', x: primary.index })

    const second = measures[1]
    if (second) {
        if (time) add({ kind: 'area', x: time.index, y: second.index, agg: defaultAgg(second) })
        else if (dims[0]) add({ kind: 'hbar', x: dims[0].index, y: second.index, agg: defaultAgg(second) })
    }

    const seen = new Set<string>()
    return specs
        .filter((s) => {
            const k = JSON.stringify([s.kind, s.x, s.y, s.agg])
            if (seen.has(k)) return false
            seen.add(k)
            return true
        })
        .slice(0, 8)
}

export function generatePresets(
    headers: string[],
    rows: any[][],
    analysis: ColumnAnalysis[] = inspectMatrix(headers, rows),
): { presets: ChartPreset[]; kpis: MetricSummary[] } {
    const specs = suggestSpecs(analysis, rows.length)
    const presets: ChartPreset[] = []
    specs.forEach((spec, i) => {
        const chart = buildChart(spec, headers, rows, analysis)
        if (!chart || !chart.points.length) return
        if (chart.points.length < 2 && spec.kind !== 'donut') return
        presets.push({ id: `p${i}_${spec.kind}_${spec.x}_${spec.y}`, title: chart.title, spec, chart })
    })

    /* KPI */
    const kpis: MetricSummary[] = []
    kpis.push({
        label: 'Всего записей',
        value: rows.length.toLocaleString('ru-RU'),
        subText: `Колонок: ${headers.length}`,
        icon: 'rows',
    })

    const time = analysis.find((c) => c.type === 'date' && c.dateRange)
    if (time?.dateRange) {
        const d = new Intl.DateTimeFormat('ru-RU')
        const days = Math.max(1, Math.round((time.dateRange.max - time.dateRange.min) / 864e5) + 1)
        kpis.push({
            label: `Период: ${time.header}`,
            value: `${d.format(time.dateRange.min)} – ${d.format(time.dateRange.max)}`,
            subText: `${days.toLocaleString('ru-RU')} дн.`,
            icon: 'period',
        })
    }

    const measures = analysis
        .filter((c) => c.type === 'number' && c.numericStats && c.numericStats.max !== c.numericStats.min)
        .sort((a, b) => (b.unit ? 1 : 0) - (a.unit ? 1 : 0))
        .slice(0, 2)

    measures.forEach((m, i) => {
        const st = m.numericStats!
        const useAvg = m.unit === '%'
        const kpi: MetricSummary = {
            label: `${useAvg ? 'Среднее' : 'Сумма'}: ${m.header}`,
            value: formatValue(useAvg ? st.avg : st.sum, m.unit ?? '', true),
            subText: useAvg
                ? `Медиана ${formatValue(st.median, m.unit ?? '')}`
                : `Среднее ${formatValue(st.avg, m.unit ?? '', true)} · медиана ${formatValue(st.median, m.unit ?? '', true)}`,
            icon: 'sum',
        }
        if (i === 0) {
            const dyn = presets
                .find((p) => p.spec.kind === 'area' && p.spec.y === m.index)
                ?.chart.highlights.find((h) => h.tone)
            if (dyn) {
                kpi.trend = dyn.tone
                kpi.delta = dyn.value
            }
        }
        kpis.push(kpi)
    })

    const dim = presets.find((p) => !p.chart.isTime && p.spec.y === -1 && p.spec.kind !== 'histogram')
    if (dim) {
        const lead = dim.chart.points.find((p) => !p.isOther)
        if (lead) {
            kpis.push({
                label: `Чаще всего: ${dim.chart.xTitle}`,
                value: lead.label,
                subText: lead.share !== null ? `${pct(lead.share, 0)} записей` : undefined,
                icon: 'leader',
            })
        }
    }

    return { presets, kpis }
}

export function useMoloGraph() {
    return {
        inspectMatrix,
        generatePresets,
        suggestSpecs,
        buildChart,
        chartTitle,
        kindsFor,
        defaultAgg,
        parseNumeric,
        parseDate,
        formatValue,
        niceScale,
    }
}