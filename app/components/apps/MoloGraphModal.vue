<!-- components/apps/molo/MoloGraphModal.vue -->
<script setup lang="ts">
import { computed, reactive, ref, shallowRef, toRaw, watch } from 'vue'
import MoloChart from './MoloChart.vue'
import {
  AGG_LABEL,
  GRAIN_LABEL,
  KIND_LABEL,
  useMoloGraph,
  type Aggregation,
  type ChartKind,
  type ChartPreset,
  type ChartSpec,
  type ColumnAnalysis,
  type MetricSummary,
  type TimeGrain,
} from '~/composables/table/useMoloGraph'

const props = defineProps<{
  modelValue: boolean
  headers: string[]
  rows: any[][]
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

/** Имена стикеров из components/ui/MoloSticker.vue */
const STICKER = {
  area: 'chart-area',
  line: 'chart-line',
  bar: 'chart-bar',
  hbar: 'chart-hbar',
  donut: 'chart-donut',
  histogram: 'chart-histogram',
  rows: 'table',
  sum: 'sigma',
  period: 'dev-calendar',
  leader: 'trophy',
  up: 'trend-up',
  down: 'trend-down',
  empty: 'chart-empty',
} as const

const { inspectMatrix, generatePresets, buildChart, kindsFor, defaultAgg } = useMoloGraph()

const analysis = shallowRef<ColumnAnalysis[]>([])
const kpis = ref<MetricSummary[]>([])
const presets = ref<ChartPreset[]>([])
const activeId = ref<string | null>(null)

const spec = reactive<ChartSpec>({ kind: 'bar', x: 0, y: -1, agg: 'count', topN: 10, grain: 'auto' })

function applySpec(s: ChartSpec) {
  Object.assign(spec, s)
}

function pickPreset(p: ChartPreset) {
  applySpec(p.spec)
  activeId.value = p.id
}

function recompute() {
  const rows = toRaw(props.rows)
  if (!rows.length || !props.headers.length) {
    analysis.value = []
    kpis.value = []
    presets.value = []
    return
  }
  analysis.value = inspectMatrix(props.headers, rows)
  const result = generatePresets(props.headers, rows, analysis.value)
  kpis.value = result.kpis
  presets.value = result.presets

  if (result.presets[0]) {
    pickPreset(result.presets[0])
    return
  }
  // автоподбор ничего не нашёл — даём собрать вручную с первой пригодной колонкой
  const first = analysis.value.find((c) => ['date', 'category', 'number'].includes(c.type))
  if (first) {
    applySpec({ kind: kindsFor(first)[0] ?? 'bar', x: first.index, y: -1, agg: 'count', topN: 10, grain: 'auto' })
    activeId.value = null
  }
}

watch(() => [props.modelValue, props.rows, props.headers], ([open]) => {
  if (open) recompute()
}, { immediate: true })

/* ───────── Конструктор ───────── */

const xCol = computed(() => analysis.value[spec.x])
const additive = computed(() => spec.y < 0 || spec.agg === 'sum' || spec.agg === 'count')
const allowedKinds = computed(() => kindsFor(xCol.value, additive.value))

const isHistogram = computed(() => spec.kind === 'histogram' || (xCol.value?.type === 'number' && !xCol.value.discrete))
const showMeasure = computed(() => !isHistogram.value)
const showAgg = computed(() => showMeasure.value && spec.y >= 0)
const showGrain = computed(() => xCol.value?.type === 'date')
const showTop = computed(() => !isHistogram.value && xCol.value?.type === 'category')

/* Списки для UIMoloSelect (parent + children + value-key) */
const xItems = computed(() =>
    analysis.value
        .filter((c) => ['date', 'category', 'number'].includes(c.type))
        .map((c) => ({ value: c.index, label: c.header })),
)
const yItems = computed(() => [
  { value: -1, label: 'Количество записей' },
  ...analysis.value.filter((c) => c.type === 'number').map((c) => ({ value: c.index, label: c.header })),
])
const AGG_OPTIONS: Aggregation[] = ['sum', 'avg', 'median', 'min', 'max', 'count']
const aggItems = AGG_OPTIONS.map((a) => ({ value: a, label: AGG_LABEL[a] }))
const GRAIN_OPTIONS: TimeGrain[] = ['auto', 'day', 'week', 'month', 'year']
const grainItems = GRAIN_OPTIONS.map((g) => ({ value: g, label: GRAIN_LABEL[g] }))
const topItems = [5, 8, 10, 15, 25].map((n) => ({ value: n, label: `Топ ${n}` }))

function ensureKind() {
  if (!allowedKinds.value.includes(spec.kind)) spec.kind = allowedKinds.value[0] ?? 'bar'
}

function touch() {
  activeId.value = null
}

// UIMoloSelect отдаёт строку — приводим к нужному типу
function onX(v: any) {
  spec.x = Number(v)
  ensureKind()
  touch()
}

function onY(v: any) {
  spec.y = Number(v)
  if (spec.y < 0) spec.agg = 'count'
  else if (spec.agg === 'count') spec.agg = defaultAgg(analysis.value[spec.y])
  ensureKind()
  touch()
}

function onAgg(v: any) {
  spec.agg = v as Aggregation
  ensureKind()
  touch()
}

function onGrain(v: any) {
  spec.grain = v as TimeGrain
  touch()
}

function onTop(v: any) {
  spec.topN = Number(v)
  touch()
}

function setKind(k: ChartKind) {
  spec.kind = k
  touch()
}

/* ───────── График ───────── */

const chart = computed(() => {
  if (!analysis.value.length) return null
  return buildChart({ ...spec }, props.headers, toRaw(props.rows), analysis.value)
})

const chartKey = computed(() => JSON.stringify(spec))

const usageNote = computed(() => {
  const c = chart.value
  if (!c) return ''
  const parts = [`Учтено строк: ${c.usedRows.toLocaleString('ru-RU')} из ${props.rows.length.toLocaleString('ru-RU')}`]
  if (c.hiddenCount) parts.push(`скрыто групп: ${c.hiddenCount}`)
  return parts.join(' · ')
})

const trendSticker = (t?: string) => (t === 'down' ? STICKER.down : STICKER.up)
</script>

<template>
  <UIMoloModal
      :model-value="modelValue"
      :title="`MoloGraph: ${title || 'Аналитический отчёт'}`"
      width="960px"
      confirm-text="Закрыть"
      @update:model-value="(v) => emit('update:modelValue', v)"
      @confirm="emit('update:modelValue', false)"
  >
    <template #body>
      <div class="molo-graph-modal">
        <!-- Сводка -->
        <div v-if="kpis.length" class="kpi-grid">
          <div v-for="(kpi, i) in kpis" :key="i" class="kpi-card">
            <span class="kpi-ico">
              <UIMoloSticker :name="STICKER[kpi.icon]" :size="22" />
            </span>
            <div class="kpi-body">
              <span class="kpi-label" :title="kpi.label">{{ kpi.label }}</span>
              <strong class="kpi-value" :class="{ long: String(kpi.value).length > 14 }" :title="String(kpi.value)">
                {{ kpi.value }}
              </strong>
              <div class="kpi-foot">
                <span v-if="kpi.subText" class="kpi-sub" :title="kpi.subText">{{ kpi.subText }}</span>
                <span v-if="kpi.delta" class="kpi-delta" :class="kpi.trend">
                  <UIMoloSticker :name="trendSticker(kpi.trend)" :size="14" />
                  {{ kpi.delta }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!analysis.length" class="empty-state">
          <UIMoloSticker :name="STICKER.empty" :size="44" />
          <span>В таблице нет данных для анализа.</span>
        </div>

        <template v-else>
          <!-- Быстрые срезы -->
          <div v-if="presets.length" class="section">
            <div class="section-title">Подобрано по данным</div>
            <div class="preset-selector">
              <UIMoloButton
                  v-for="p in presets"
                  :key="p.id"
                  variant="action"
                  class="chip"
                  :class="{ active: p.id === activeId }"
                  :title="p.title"
                  @click="pickPreset(p)"
              >
                <UIMoloSticker :name="STICKER[p.spec.kind]" :size="16" />
                <span class="chip-text">{{ p.title }}</span>
              </UIMoloButton>
            </div>
          </div>

          <!-- Конструктор -->
          <div class="section">
            <div class="section-title">Конструктор</div>
            <div class="builder">
              <div class="kind-switch">
                <UIMoloButton
                    v-for="k in allowedKinds"
                    :key="k"
                    variant="action"
                    class="seg"
                    :class="{ active: spec.kind === k }"
                    @click="setKind(k)"
                >
                  <UIMoloSticker :name="STICKER[k]" :size="18" />
                  <span>{{ KIND_LABEL[k] }}</span>
                </UIMoloButton>
              </div>

              <div class="fields">
                <UIMoloSelect
                    compact
                    :t-label="isHistogram ? 'Колонка' : 'По оси X'"
                    :model-value="spec.x"
                    :parent="xItems"
                    children="label"
                    value-key="value"
                    @update:model-value="onX"
                />
                <UIMoloSelect
                    v-if="showMeasure"
                    compact
                    t-label="Показатель"
                    :model-value="spec.y"
                    :parent="yItems"
                    children="label"
                    value-key="value"
                    @update:model-value="onY"
                />
                <UIMoloSelect
                    v-if="showAgg"
                    compact
                    t-label="Расчёт"
                    :model-value="spec.agg"
                    :parent="aggItems"
                    children="label"
                    value-key="value"
                    @update:model-value="onAgg"
                />
                <UIMoloSelect
                    v-if="showGrain"
                    compact
                    t-label="Период"
                    :model-value="spec.grain"
                    :parent="grainItems"
                    children="label"
                    value-key="value"
                    @update:model-value="onGrain"
                />
                <UIMoloSelect
                    v-if="showTop"
                    compact
                    t-label="Показать"
                    :model-value="spec.topN"
                    :parent="topItems"
                    children="label"
                    value-key="value"
                    @update:model-value="onTop"
                />
              </div>
            </div>
          </div>

          <!-- Рабочая зона -->
          <div v-if="chart" class="chart-viewport">
            <div class="chart-header">
              <strong class="chart-title">{{ chart.title }}</strong>
              <span class="chart-note">{{ usageNote }}</span>
            </div>

            <MoloChart :key="chartKey" :chart="chart" />

            <div v-if="chart.highlights.length" class="highlights">
              <div v-for="(h, i) in chart.highlights" :key="i" class="hl">
                <span class="hl-label">{{ h.label }}</span>
                <strong class="hl-value" :class="h.tone">
                  <UIMoloSticker v-if="h.tone === 'up' || h.tone === 'down'" :name="trendSticker(h.tone)" :size="14" />
                  <span class="hl-text">{{ h.value }}</span>
                </strong>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </UIMoloModal>
</template>

<style scoped>
.molo-graph-modal {
  --accent: #38bdf8;
  --panel: #181a24;
  --border: var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  --muted: #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 13px;
  color: #e2e8f0;
  max-height: 74vh;
  overflow-y: auto;
  padding-right: 4px;
}

.section { display: flex; flex-direction: column; gap: 8px; }
.section-title { font-size: 12px; color: var(--muted); }

/* ───── KPI ───── */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.kpi-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  min-width: 0;
}
.kpi-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.16);
}
.kpi-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.kpi-label { font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi-value {
  font-size: 19px;
  font-weight: 700;
  color: #fff;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.kpi-value.long { font-size: 15px; }
.kpi-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 16px; }
.kpi-sub { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.kpi-delta { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; font-weight: 600; flex-shrink: 0; }
.kpi-delta.up { color: #34d399; }
.kpi-delta.down { color: #f87171; }
.kpi-delta.neutral { color: var(--muted); }

/* ───── Чипы-пресеты (UIMoloButton) ───── */
.preset-selector { display: flex; flex-wrap: wrap; gap: 8px; }
.molo-graph-modal .molo-btn.chip {
  max-width: 100%;
  padding: 6px 12px 6px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  gap: 8px;
  color: #cbd5e1;
}
.molo-graph-modal .molo-btn.chip.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }

/* ───── Конструктор ───── */
.builder {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.kind-switch { display: flex; flex-wrap: wrap; gap: 6px; }
.molo-graph-modal .molo-btn.seg {
  padding: 6px 12px 6px 10px;
  font-size: 12px;
  font-weight: 500;
  gap: 8px;
  color: var(--muted);
}
.molo-graph-modal .molo-btn.seg.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }

/* ───── График ───── */
.chart-viewport {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.chart-header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.chart-title { font-size: 14.5px; color: #fff; }
.chart-note { font-size: 11.5px; color: #64748b; }

.highlights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}
.hl { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hl-label { font-size: 11px; color: var(--muted); }
.hl-value { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: #fff; min-width: 0; }
.hl-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hl-value.up { color: #34d399; }
.hl-value.down { color: #f87171; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px;
  color: #64748b;
}
</style>