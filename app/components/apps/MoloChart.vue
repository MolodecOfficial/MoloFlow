<!-- components/apps/molo/MoloChart.vue -->
<script setup lang="ts">
import {computed, ref} from 'vue'
import {type ChartData, formatValue, niceScale} from '~/composables/table/useMoloGraph'

const props = defineProps<{ chart: ChartData }>()

const PALETTE = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf']
const OTHER_COLOR = '#64748b'

const fmt = (v: number) => formatValue(v, props.chart.unit)
const fmtC = (v: number) => formatValue(v, props.chart.unit, true)
const pctText = (s: number | null) => (s === null ? '' : `${(s * 100).toFixed(s < 0.1 ? 1 : 0).replace('.', ',')}%`)

const hover = ref<number | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)

const points = computed(() => props.chart.points)
const isEmpty = computed(() => !points.value.length)

/* ───────────── Декартова геометрия (столбцы, гистограмма, линия, область) ───────────── */

const W = 720
const H = 300
const isCartesian = computed(() => ['bar', 'histogram', 'line', 'area'].includes(props.chart.kind))
const isBars = computed(() => props.chart.kind === 'bar' || props.chart.kind === 'histogram')
const isLine = computed(() => props.chart.kind === 'line' || props.chart.kind === 'area')

const scale = computed(() => {
  const vals = points.value.map((p) => p.value)
  const mn = Math.min(...vals)
  const mx = Math.max(...vals)
  let lo = Math.min(0, mn)
  const hi = Math.max(0, mx)
  // линия: если данные «висят» высоко над нулём, не прижимаем ось к нулю
  if (props.chart.kind === 'line' && mn > 0 && mn > mx * 0.5) lo = mn
  return niceScale(lo, hi, 5)
})

const M = computed(() => {
  const longest = Math.max(...scale.value.ticks.map((t) => fmtC(t).length), 3)
  return {l: Math.min(92, 14 + longest * 6.6), r: 18, t: 16, b: 32}
})
const plotW = computed(() => W - M.value.l - M.value.r)
const plotH = computed(() => H - M.value.t - M.value.b)

const yPos = (v: number) => M.value.t + plotH.value * (1 - (v - scale.value.lo) / (scale.value.hi - scale.value.lo || 1))
const baseY = computed(() => yPos(Math.min(Math.max(0, scale.value.lo), scale.value.hi)))

const band = computed(() => plotW.value / Math.max(1, points.value.length))

const bars = computed(() => {
  if (!isBars.value) return []
  const hist = props.chart.kind === 'histogram'
  const bw = Math.min(hist ? band.value * 0.94 : 56, band.value * (hist ? 0.94 : 0.64))
  return points.value.map((p, i) => {
    const x = M.value.l + i * band.value + (band.value - bw) / 2
    const y = yPos(p.value)
    return {
      x,
      w: bw,
      y: Math.min(y, baseY.value),
      h: Math.max(p.value === 0 ? 0 : 2, Math.abs(baseY.value - y)),
      cx: x + bw / 2,
    }
  })
})

const linePts = computed(() => {
  if (!isLine.value) return []
  const n = points.value.length
  return points.value.map((p, i) => ({
    x: n === 1 ? M.value.l + plotW.value / 2 : M.value.l + (i * plotW.value) / (n - 1),
    y: yPos(p.value),
  }))
})

/** Монотонная кубическая интерполяция: гладко, но без «перелётов» через значения */
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (!n) return ''
  const f = (v: number) => v.toFixed(1)
  if (n === 1) return `M${f(pts[0]!.x)} ${f(pts[0]!.y)}`
  if (n === 2) return `M${f(pts[0]!.x)} ${f(pts[0]!.y)}L${f(pts[1]!.x)} ${f(pts[1]!.y)}`

  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1]!.x - pts[i]!.x
    m[i] = (pts[i + 1]!.y - pts[i]!.y) / (dx[i] || 1)
  }
  const t: number[] = [m[0]!]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2
  t[n - 1] = m[n - 2]!
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
    } else {
      const a = t[i]! / m[i]!
      const b = t[i + 1]! / m[i]!
      const s = a * a + b * b
      if (s > 9) {
        const tau = 3 / Math.sqrt(s)
        t[i] = tau * a * m[i]!
        t[i + 1] = tau * b * m[i]!
      }
    }
  }
  let d = `M${f(pts[0]!.x)} ${f(pts[0]!.y)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]! / 3
    const p0 = pts[i]!
    const p1 = pts[i + 1]!
    d += `C${f(p0.x + h)} ${f(p0.y + t[i]! * h)} ${f(p1.x - h)} ${f(p1.y - t[i + 1]! * h)} ${f(p1.x)} ${f(p1.y)}`
  }
  return d
}

const linePath = computed(() => smoothPath(linePts.value))
const areaPath = computed(() => {
  const pts = linePts.value
  if (pts.length < 2) return ''
  return `${linePath.value}L${pts[pts.length - 1]!.x.toFixed(1)} ${baseY.value.toFixed(1)}L${pts[0]!.x.toFixed(1)} ${baseY.value.toFixed(1)}Z`
})

const xLabels = computed(() => {
  const n = points.value.length
  const slot = isBars.value ? band.value : n > 1 ? plotW.value / (n - 1) : plotW.value
  const maxChars = props.chart.kind === 'histogram' ? 8 : Math.max(4, Math.floor(slot / 6.2))
  const minSlotPx = props.chart.isTime || props.chart.kind === 'histogram' ? 52 : 40
  const step = Math.max(1, Math.ceil(minSlotPx / Math.max(1, slot)))
  const out: { x: number; text: string }[] = []
  for (let i = 0; i < n; i += step) {
    const label = points.value[i]!.label
    const x = isBars.value ? bars.value[i]!.cx : linePts.value[i]!.x
    out.push({x, text: label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label})
  }
  return out
})

const showDots = computed(() => isLine.value && points.value.length <= 31)

function onMove(e: MouseEvent) {
  const svg = svgEl.value
  if (!svg || !isLine.value) return
  const rect = svg.getBoundingClientRect()
  const vx = ((e.clientX - rect.left) / rect.width) * W
  const n = points.value.length
  if (n === 1) {
    hover.value = 0
    return
  }
  const i = Math.round(((vx - M.value.l) / plotW.value) * (n - 1))
  hover.value = Math.min(n - 1, Math.max(0, i))
}

const tip = computed(() => {
  const i = hover.value
  if (i === null || !isCartesian.value) return null
  const p = points.value[i]
  if (!p) return null
  const x = isBars.value ? bars.value[i]!.cx : linePts.value[i]!.x
  const y = isBars.value ? bars.value[i]!.y : linePts.value[i]!.y
  return {
    left: Math.min(88, Math.max(12, (x / W) * 100)),
    top: (y / H) * 100,
    label: p.fullLabel,
    value: fmt(p.value),
    share: pctText(p.share),
  }
})

/* ───────────── Рейтинг (горизонтальные полосы) ───────────── */

const hbarMax = computed(() => Math.max(...points.value.map((p) => Math.abs(p.value)), 1))

/* ───────────── Кольцо ───────────── */

const D = {c: 110, R: 100, r: 66}
const colorOf = (i: number) => (points.value[i]?.isOther ? OTHER_COLOR : PALETTE[i % PALETTE.length]!)

const slices = computed(() => {
  if (props.chart.kind !== 'donut') return []
  const vals = points.value.map((p) => Math.max(0, p.value))
  const sum = vals.reduce((a, b) => a + b, 0)
  if (!sum) return []
  const gap = vals.length > 1 ? 0.018 : 0
  let acc = -Math.PI / 2
  return vals.map((v, i) => {
    const full = (v / sum) * Math.PI * 2
    const a0 = acc + gap / 2
    const a1 = Math.max(a0 + 0.004, Math.min(acc + full - gap / 2, a0 + Math.PI * 2 - 0.001))
    acc += full
    const pt = (r: number, a: number) => `${(D.c + r * Math.cos(a)).toFixed(2)} ${(D.c + r * Math.sin(a)).toFixed(2)}`
    const large = a1 - a0 > Math.PI ? 1 : 0
    const path = `M${pt(D.R, a0)}A${D.R} ${D.R} 0 ${large} 1 ${pt(D.R, a1)}L${pt(D.r, a1)}A${D.r} ${D.r} 0 ${large} 0 ${pt(D.r, a0)}Z`
    return {path, share: v / sum, i}
  })
})

const donutCenter = computed(() => {
  const i = hover.value
  const p = i !== null ? points.value[i] : null
  if (p) return {top: fmtC(p.value), bottom: p.label, share: pctText(slices.value[i!]?.share ?? null)}
  return {top: fmtC(props.chart.total), bottom: props.chart.agg === 'count' ? 'всего' : 'итого', share: ''}
})
</script>

<template>
  <div class="molo-chart">
    <div v-if="isEmpty" class="chart-empty">
      <slot name="empty">Для выбранных колонок нет данных</slot>
    </div>

    <!-- Рейтинг -->
    <div v-else-if="chart.kind === 'hbar'" class="hbar-list">
      <div
          v-for="(p, i) in points"
          :key="i"
          class="hbar-row"
          :class="{ dim: hover !== null && hover !== i }"
          @mouseenter="hover = i"
          @mouseleave="hover = null"
      >
        <span class="hbar-label" :title="p.fullLabel">{{ p.label }}</span>
        <span class="hbar-track">
          <span
              class="hbar-fill"
              :class="{ other: p.isOther }"
              :style="{ width: `${Math.max(p.value === 0 ? 0 : 1.2, (Math.abs(p.value) / hbarMax) * 100)}%`, animationDelay: `${Math.min(i, 12) * 28}ms` }"
          />
        </span>
        <span class="hbar-value">
          {{ fmt(p.value) }}<em v-if="p.share !== null">{{ pctText(p.share) }}</em>
        </span>
      </div>
    </div>

    <!-- Кольцо -->
    <div v-else-if="chart.kind === 'donut'" class="donut-box">
      <div class="donut-wrap">
        <svg viewBox="0 0 220 220" class="donut-svg" role="img" :aria-label="chart.title">
          <path
              v-for="s in slices"
              :key="s.i"
              :d="s.path"
              :fill="colorOf(s.i)"
              class="slice"
              :class="{ dim: hover !== null && hover !== s.i }"
              :style="{ animationDelay: `${s.i * 45}ms` }"
              @mouseenter="hover = s.i"
              @mouseleave="hover = null"
          />
        </svg>
        <div class="donut-center">
          <strong>{{ donutCenter.top }}</strong>
          <span class="dc-label" :title="donutCenter.bottom">{{ donutCenter.bottom }}</span>
          <span v-if="donutCenter.share" class="dc-share">{{ donutCenter.share }}</span>
        </div>
      </div>

      <div class="legend">
        <div
            v-for="(p, i) in points"
            :key="i"
            class="legend-row"
            :class="{ dim: hover !== null && hover !== i }"
            @mouseenter="hover = i"
            @mouseleave="hover = null"
        >
          <span class="dot" :style="{ background: colorOf(i) }"/>
          <span class="legend-name" :title="p.fullLabel">{{ p.label }}</span>
          <span class="legend-val">{{ fmt(p.value) }}</span>
          <span class="legend-pct">{{ pctText(p.share) }}</span>
        </div>
      </div>
    </div>

    <!-- Столбцы / гистограмма / линия / область -->
    <div v-else class="cart-wrap">
      <svg
          ref="svgEl"
          :viewBox="`0 0 ${W} ${H}`"
          class="cart-svg"
          role="img"
          :aria-label="chart.title"
          @mousemove="onMove"
          @mouseleave="hover = null"
      >
        <defs>
          <linearGradient id="mc-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#38bdf8"/>
            <stop offset="1" stop-color="#6366f1"/>
          </linearGradient>
          <linearGradient id="mc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#38bdf8" stop-opacity="0.38"/>
            <stop offset="1" stop-color="#38bdf8" stop-opacity="0"/>
          </linearGradient>
        </defs>

        <!-- сетка и подписи оси Y -->
        <g class="grid">
          <template v-for="t in scale.ticks" :key="t">
            <line :x1="M.l" :x2="W - M.r" :y1="yPos(t)" :y2="yPos(t)" :class="{ zero: t === 0 }"/>
            <text :x="M.l - 8" :y="yPos(t) + 3.5" text-anchor="end">{{ fmtC(t) }}</text>
          </template>
        </g>

        <!-- столбцы -->
        <g v-if="isBars">
          <rect
              v-for="(b, i) in bars"
              :key="i"
              :x="b.x"
              :y="b.y"
              :width="b.w"
              :height="b.h"
              :rx="chart.kind === 'histogram' ? 1.5 : 4"
              class="bar"
              :class="{ dim: hover !== null && hover !== i }"
              :style="{ animationDelay: `${Math.min(i, 24) * 18}ms` }"
          />
          <rect
              v-for="(b, i) in bars"
              :key="`h${i}`"
              :x="M.l + i * band"
              :y="M.t"
              :width="band"
              :height="plotH"
              fill="transparent"
              @mouseenter="hover = i"
          />
        </g>

        <!-- линия / область -->
        <g v-else>
          <path v-if="chart.kind === 'area' && areaPath" :d="areaPath" fill="url(#mc-area)" class="area"/>
          <path :d="linePath" class="line" pathLength="1"/>
          <template v-if="showDots">
            <circle v-for="(p, i) in linePts" :key="i" :cx="p.x" :cy="p.y" r="2.6" class="dot-pt"/>
          </template>
          <template v-if="hover !== null && linePts[hover]">
            <line :x1="linePts[hover]!.x" :x2="linePts[hover]!.x" :y1="M.t" :y2="baseY" class="cross"/>
            <circle :cx="linePts[hover]!.x" :cy="linePts[hover]!.y" r="5" class="dot-hover"/>
          </template>
        </g>

        <!-- подписи оси X -->
        <g class="xlabels">
          <text v-for="(l, i) in xLabels" :key="i" :x="l.x" :y="H - 10" text-anchor="middle">{{ l.text }}</text>
        </g>
      </svg>

      <div
          v-if="tip"
          class="tip"
          :style="{ left: `${tip.left}%`, top: `${tip.top}%` }"
      >
        <span class="tip-label">{{ tip.label }}</span>
        <strong>{{ tip.value }}</strong>
        <span v-if="tip.share" class="tip-share">{{ tip.share }} от итога</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.molo-chart {
  --accent: #38bdf8;
  --muted: #94a3b8;
  --line: rgba(255, 255, 255, 0.07);
  position: relative;
  font-variant-numeric: tabular-nums;
}

.chart-empty {
  padding: 48px 0;
  text-align: center;
  color: #64748b;
}

/* ───── Декартовы графики ───── */
.cart-wrap {
  position: relative;
}

.cart-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.grid line {
  stroke: var(--line);
  stroke-width: 1;
}

.grid line.zero {
  stroke: rgba(255, 255, 255, 0.18);
}

.grid text, .xlabels text {
  fill: var(--muted);
  font-size: 11px;
}

.bar {
  fill: url(#mc-bar);
  transform-box: fill-box;
  transform-origin: bottom;
  animation: grow-y 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  transition: opacity 0.15s;
}

.bar.dim {
  opacity: 0.45;
}

.line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  animation: draw 0.9s ease-out both;
}

.area {
  animation: fade 0.9s ease-out both;
}

.dot-pt {
  fill: #181a24;
  stroke: var(--accent);
  stroke-width: 1.6;
}

.dot-hover {
  fill: var(--accent);
  stroke: #181a24;
  stroke-width: 2.5;
}

.cross {
  stroke: rgba(255, 255, 255, 0.25);
  stroke-dasharray: 3 3;
}

.tip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
  background: #0f1118;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  padding: 7px 10px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  z-index: 2;
}

.tip-label {
  font-size: 11px;
  color: var(--muted);
}

.tip strong {
  font-size: 14px;
  color: #fff;
}

.tip-share {
  font-size: 11px;
  color: var(--accent);
}

/* ───── Рейтинг ───── */
.hbar-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.hbar-row {
  display: grid;
  grid-template-columns: minmax(90px, 28%) 1fr minmax(96px, auto);
  align-items: center;
  gap: 12px;
  transition: opacity 0.15s;
}

.hbar-row.dim {
  opacity: 0.5;
}

.hbar-label {
  color: #cbd5e1;
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hbar-track {
  height: 14px;
  background: rgba(255, 255, 255, 0.045);
  border-radius: 7px;
  overflow: hidden;
}

.hbar-fill {
  display: block;
  height: 100%;
  border-radius: 7px;
  background: linear-gradient(90deg, #6366f1, #38bdf8);
  transform-origin: left;
  animation: grow-x 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.hbar-fill.other {
  background: #475569;
}

.hbar-value {
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}

.hbar-value em {
  font-style: normal;
  font-weight: 400;
  color: var(--muted);
  margin-left: 8px;
  display: inline-block;
  min-width: 34px;
}

/* ───── Кольцо ───── */
.donut-box {
  display: flex;
  align-items: center;
  gap: 32px;
  min-height: 240px;
}

.donut-wrap {
  position: relative;
  width: 220px;
  height: 220px;
  flex-shrink: 0;
}

.donut-svg {
  width: 100%;
  height: 100%;
}

.slice {
  transition: opacity 0.15s, transform 0.15s;
  transform-origin: 110px 110px;
  animation: fade 0.5s ease-out both;
  cursor: default;
}

.slice.dim {
  opacity: 0.4;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 52px;
  text-align: center;
  pointer-events: none;
}

.donut-center strong {
  font-size: 22px;
  color: #fff;
  line-height: 1.1;
}

.dc-label {
  font-size: 11.5px;
  color: var(--muted);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-share {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
}

.legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
}

.legend-row {
  display: grid;
  grid-template-columns: 10px 1fr auto 48px;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 12.5px;
  transition: background 0.15s, opacity 0.15s;
}

.legend-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.legend-row.dim {
  opacity: 0.5;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-name {
  color: #cbd5e1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-val {
  color: #fff;
  font-weight: 600;
}

.legend-pct {
  color: var(--muted);
  text-align: right;
}

@keyframes grow-y {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

@keyframes grow-x {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@keyframes draw {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .donut-box {
    flex-direction: column;
    align-items: stretch;
  }

  .donut-wrap {
    align-self: center;
  }

  .hbar-row {
    grid-template-columns: minmax(70px, 34%) 1fr auto;
    gap: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar, .line, .area, .hbar-fill, .slice {
    animation: none;
  }
}
</style>