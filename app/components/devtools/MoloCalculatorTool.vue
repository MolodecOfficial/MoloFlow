<!-- app/components/devtools/MoloCalculatorTool.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePersistentState } from '~/composables/window/usePersistentState'
import MoloSticker from '~/components/ui/MoloSticker.vue'

interface HistoryEntry {
  id: string
  expr: string
  result: string
  timestamp: number
}

type CalcMode = 'standard' | 'scientific' | 'business' | 'programmer'

const mode = usePersistentState<CalcMode>('calc-mode', 'standard')
const expression = ref('')
const display = ref('0')
const memory = usePersistentState<number>('calc-memory', 0)
const history = usePersistentState<HistoryEntry[]>('calc-history', [])
const justEvaluated = ref(false)
const baseMode = ref<10 | 16 | 2 | 8>(10)

// -------------------------------------------------------------
// Математический движок с защитой от плавающей точки
// -------------------------------------------------------------
function roundPrecision(num: number, precision = 12): number {
  if (!isFinite(num) || isNaN(num)) return num
  const factor = Math.pow(10, precision)
  return Math.round((num + Number.EPSILON) * factor) / factor
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN
  if (n === 0 || n === 1) return 1
  let res = 1
  for (let i = 2; i <= n; i++) res *= i
  return res
}

function sanitizeForEval(expr: string): string {
  let s = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'Math.PI')
      .replace(/e/g, 'Math.E')
      .replace(/sin\(/g, 'Math.sin(')
      .replace(/cos\(/g, 'Math.cos(')
      .replace(/tan\(/g, 'Math.tan(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/log\(/g, 'Math.log10(')
      .replace(/sqrt\(/g, 'Math.sqrt(')
      .replace(/\^/g, '**')
      .replace(/%/g, '*0.01')

  return s
}

function evaluate() {
  if (!expression.value.trim()) return

  try {
    const raw = expression.value
    const sanitized = sanitizeForEval(raw)

    // eslint-disable-next-line no-new-func
    const computedVal = Function(`"use strict"; return (${sanitized})`)()

    if (typeof computedVal !== 'number' || isNaN(computedVal)) {
      throw new Error('NaN')
    }

    const finalVal = roundPrecision(computedVal)
    const resultStr = String(finalVal)

    history.value = [
      {
        id: crypto.randomUUID(),
        expr: raw,
        result: resultStr,
        timestamp: Date.now()
      },
      ...history.value
    ].slice(0, 50)

    display.value = resultStr
    expression.value = resultStr
    justEvaluated.value = true
  } catch {
    display.value = 'Ошибка'
    expression.value = ''
    justEvaluated.value = false
  }
}

// -------------------------------------------------------------
// Ввод и клавиатура
// -------------------------------------------------------------
function inputChar(char: string) {
  if (justEvaluated.value) {
    if (/[0-9.]/.test(char)) {
      expression.value = ''
      display.value = '0'
    }
    justEvaluated.value = false
  }

  if (display.value === '0' && /[0-9]/.test(char) && !expression.value) {
    expression.value = char
  } else {
    expression.value += char
  }
  display.value = expression.value
}

function clearAll() {
  expression.value = ''
  display.value = '0'
  justEvaluated.value = false
}

function backspace() {
  if (justEvaluated.value) {
    clearAll()
    return
  }
  expression.value = expression.value.slice(0, -1)
  display.value = expression.value || '0'
}

function inputFunc(fnName: string) {
  if (justEvaluated.value) {
    expression.value = `${fnName}(${display.value})`
    justEvaluated.value = false
  } else {
    expression.value += `${fnName}(`
  }
  display.value = expression.value
}

function applyInstantMath(type: 'sqr' | 'sqrt' | 'recip' | 'fact' | 'neg') {
  try {
    const cur = Number(display.value)
    if (isNaN(cur)) return

    let res = 0
    let label = ''

    if (type === 'sqr') {
      res = cur * cur
      label = `sqr(${cur})`
    } else if (type === 'sqrt') {
      res = Math.sqrt(cur)
      label = `sqrt(${cur})`
    } else if (type === 'recip') {
      res = 1 / cur
      label = `1/(${cur})`
    } else if (type === 'fact') {
      res = factorial(cur)
      label = `fact(${cur})`
    } else if (type === 'neg') {
      res = -cur
      label = `neg(${cur})`
    }

    res = roundPrecision(res)
    history.value = [
      { id: crypto.randomUUID(), expr: label, result: String(res), timestamp: Date.now() },
      ...history.value
    ].slice(0, 50)

    display.value = String(res)
    expression.value = String(res)
    justEvaluated.value = true
  } catch {
    display.value = 'Ошибка'
  }
}

// -------------------------------------------------------------
// Бизнес и НДС операции
// -------------------------------------------------------------
function applyVat(rate: number, mode: 'add' | 'extract') {
  const base = Number(display.value)
  if (isNaN(base) || base === 0) return

  let res = 0
  let exprName = ''

  if (mode === 'add') {
    // Начислить НДС (Сумма * 1.20)
    res = roundPrecision(base * (1 + rate / 100), 2)
    exprName = `${base} + НДС ${rate}%`
  } else {
    // Выделить НДС из суммы (Сумма * rate / (100 + rate))
    const vatOnly = roundPrecision((base * rate) / (100 + rate), 2)
    res = vatOnly
    exprName = `НДС ${rate}% из ${base}`
  }

  history.value = [
    { id: crypto.randomUUID(), expr: exprName, result: String(res), timestamp: Date.now() },
    ...history.value
  ].slice(0, 50)

  display.value = String(res)
  expression.value = String(res)
  justEvaluated.value = true
}

// -------------------------------------------------------------
// Память
// -------------------------------------------------------------
function memoryAction(act: 'MC' | 'MR' | 'M+' | 'M-' | 'MS') {
  const current = Number(display.value) || 0
  if (act === 'MC') memory.value = 0
  if (act === 'MR') {
    display.value = String(memory.value)
    expression.value = String(memory.value)
    justEvaluated.value = true
  }
  if (act === 'M+') memory.value = roundPrecision(memory.value + current)
  if (act === 'M-') memory.value = roundPrecision(memory.value - current)
  if (act === 'MS') memory.value = current
}

// -------------------------------------------------------------
// Программистский режим
// -------------------------------------------------------------
const programmerValues = computed(() => {
  const n = parseInt(display.value, baseMode.value) || 0
  return {
    hex: (n >>> 0).toString(16).toUpperCase(),
    dec: n.toString(10),
    oct: (n >>> 0).toString(8),
    bin: (n >>> 0).toString(2).padStart(8, '0').replace(/(.{4})/g, '$1 ').trim()
  }
})

function applyBitwise(op: 'AND' | 'OR' | 'XOR' | 'NOT' | 'SHL' | 'SHR') {
  if (op === 'NOT') {
    const n = parseInt(display.value, baseMode.value) || 0
    const res = (~n) >>> 0
    display.value = res.toString(baseMode.value).toUpperCase()
    expression.value = display.value
    justEvaluated.value = true
    return
  }

  const opSymbols: Record<string, string> = {
    AND: '&',
    OR: '|',
    XOR: '^',
    SHL: '<<',
    SHR: '>>'
  }
  inputChar(` ${opSymbols[op]} `)
}

// -------------------------------------------------------------
// Горячие клавиши
// -------------------------------------------------------------
function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

  if (/[0-9]/.test(e.key)) {
    inputChar(e.key)
    return
  }
  if (e.key === '.') { inputChar('.'); return }
  if (e.key === '+') { inputChar('+'); return }
  if (e.key === '-') { inputChar('−'); return }
  if (e.key === '*') { inputChar('×'); return }
  if (e.key === '/') { inputChar('÷'); return }
  if (e.key === '(' || e.key === ')') { inputChar(e.key); return }
  if (e.key === 'Enter' || e.key === '=') { evaluate(); return }
  if (e.key === 'Backspace') { backspace(); return }
  if (e.key === 'Escape') { clearAll(); return }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text)
}
</script>

<template>
  <div class="molo-calc-app">
    <!-- Верхний переключатель режимов -->
    <header class="calc-topbar">
      <div class="mode-tabs">
        <UIMoloButton
            class="mode-btn"
            :class="{ active: mode === 'standard' }"
            @click="mode = 'standard'"
        >
          Базовый
        </UIMoloButton>
        <UIMoloButton
            class="mode-btn"
            :class="{ active: mode === 'scientific' }"
            @click="mode = 'scientific'"
        >
          Инженерный
        </UIMoloButton>
        <UIMoloButton
            class="mode-btn"
            :class="{ active: mode === 'business' }"
            @click="mode = 'business'"
        >
          НДС / Финансы
        </UIMoloButton>
        <UIMoloButton
            class="mode-btn"
            :class="{ active: mode === 'programmer' }"
            @click="mode = 'programmer'"
        >
          HEX / BIN
        </UIMoloButton>
      </div>

      <div class="calc-top-actions">
        <span v-if="memory !== 0" class="mem-indicator" title="В памяти есть значение">
          M = {{ memory }}
        </span>
      </div>
    </header>

    <div class="calc-layout">
      <!-- Основной блок вычислений -->
      <main class="calc-main-panel">
        <!-- Экран -->
        <div class="calc-screen">
          <div class="screen-expr" :title="expression">
            {{ expression || '&nbsp;' }}
          </div>
          <div class="screen-result">
            <span class="result-text">{{ display }}</span>
            <UIMoloButton
                class="copy-quick-btn"
                title="Скопировать результат"
                @click="copyToClipboard(display)"
            >
              <MoloSticker name="edit" :size="12" />
            </UIMoloButton>
          </div>
        </div>

        <!-- Дополнительная панель для Программиста (HEX / DEC / OCT / BIN) -->
        <div v-if="mode === 'programmer'" class="programmer-radix-box">
          <div
              class="radix-row"
              :class="{ active: baseMode === 16 }"
              @click="baseMode = 16"
          >
            <span class="radix-name">HEX</span>
            <span class="radix-val">{{ programmerValues.hex }}</span>
          </div>
          <div
              class="radix-row"
              :class="{ active: baseMode === 10 }"
              @click="baseMode = 10"
          >
            <span class="radix-name">DEC</span>
            <span class="radix-val">{{ programmerValues.dec }}</span>
          </div>
          <div
              class="radix-row"
              :class="{ active: baseMode === 8 }"
              @click="baseMode = 8"
          >
            <span class="radix-name">OCT</span>
            <span class="radix-val">{{ programmerValues.oct }}</span>
          </div>
          <div
              class="radix-row"
              :class="{ active: baseMode === 2 }"
              @click="baseMode = 2"
          >
            <span class="radix-name">BIN</span>
            <span class="radix-val mono-bin">{{ programmerValues.bin }}</span>
          </div>
        </div>

        <!-- Кнопки памяти -->
        <div class="memory-bar">
          <UIMoloButton class="mem-btn" @click="memoryAction('MC')">MC</UIMoloButton>
          <UIMoloButton class="mem-btn" @click="memoryAction('MR')">MR</UIMoloButton>
          <UIMoloButton class="mem-btn" @click="memoryAction('M+')">M+</UIMoloButton>
          <UIMoloButton class="mem-btn" @click="memoryAction('M-')">M−</UIMoloButton>
          <UIMoloButton class="mem-btn" @click="memoryAction('MS')">MS</UIMoloButton>
        </div>

        <!-- Бизнес / НДС панель -->
        <div v-if="mode === 'business'" class="business-panel">
          <div class="biz-group">
            <span class="biz-label">Начислить НДС:</span>
            <div class="biz-btns">
              <UIMoloButton class="biz-btn" @click="applyVat(20, 'add')">+20% НДС</UIMoloButton>
              <UIMoloButton class="biz-btn" @click="applyVat(10, 'add')">+10% НДС</UIMoloButton>
            </div>
          </div>
          <div class="biz-group">
            <span class="biz-label">Выделить из суммы:</span>
            <div class="biz-btns">
              <UIMoloButton class="biz-btn" @click="applyVat(20, 'extract')">В т.ч. 20%</UIMoloButton>
              <UIMoloButton class="biz-btn" @click="applyVat(10, 'extract')">В т.ч. 10%</UIMoloButton>
            </div>
          </div>
        </div>

        <!-- Клавиатурный блок -->
        <div class="keypad-grid" :class="[`grid-${mode}`]">
          <!-- Инженерный блок дополнительных кнопок -->
          <template v-if="mode === 'scientific'">
            <UIMoloButton class="btn fn" @click="inputFunc('sin')">sin</UIMoloButton>
            <UIMoloButton class="btn fn" @click="inputFunc('cos')">cos</UIMoloButton>
            <UIMoloButton class="btn fn" @click="inputFunc('tan')">tan</UIMoloButton>
            <UIMoloButton class="btn fn" @click="inputChar('π')">π</UIMoloButton>
            <UIMoloButton class="btn fn" @click="inputChar('e')">e</UIMoloButton>

            <UIMoloButton class="btn fn" @click="inputFunc('ln')">ln</UIMoloButton>
            <UIMoloButton class="btn fn" @click="inputFunc('log')">log</UIMoloButton>
            <UIMoloButton class="btn fn" @click="inputChar('^')">xʸ</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyInstantMath('sqr')">x²</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyInstantMath('sqrt')">√x</UIMoloButton>

            <UIMoloButton class="btn fn" @click="applyInstantMath('recip')">1/x</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyInstantMath('fact')">n!</UIMoloButton>
            <UIMoloButton class="btn fn" @click="inputChar('(')">(</UIMoloButton>
            <UIMoloButton class="btn fn" @click="inputChar(')')">)</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyInstantMath('neg')">±</UIMoloButton>
          </template>

          <!-- Программистский блок битвайзов -->
          <template v-if="mode === 'programmer'">
            <UIMoloButton class="btn fn" @click="applyBitwise('AND')">AND</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyBitwise('OR')">OR</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyBitwise('XOR')">XOR</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyBitwise('NOT')">NOT</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyBitwise('SHL')">&lt;&lt;</UIMoloButton>
            <UIMoloButton class="btn fn" @click="applyBitwise('SHR')">&gt;&gt;</UIMoloButton>
          </template>

          <!-- Основные математические клавиши -->
          <UIMoloButton class="btn util" @click="clearAll">C</UIMoloButton>
          <UIMoloButton class="btn util" @click="backspace">⌫</UIMoloButton>
          <UIMoloButton class="btn op" @click="inputChar('%')">%</UIMoloButton>
          <UIMoloButton class="btn op" @click="inputChar('÷')">÷</UIMoloButton>

          <UIMoloButton class="btn num" @click="inputChar('7')">7</UIMoloButton>
          <UIMoloButton class="btn num" @click="inputChar('8')">8</UIMoloButton>
          <UIMoloButton class="btn num" @click="inputChar('9')">9</UIMoloButton>
          <UIMoloButton class="btn op" @click="inputChar('×')">×</UIMoloButton>

          <UIMoloButton class="btn num" @click="inputChar('4')">4</UIMoloButton>
          <UIMoloButton class="btn num" @click="inputChar('5')">5</UIMoloButton>
          <UIMoloButton class="btn num" @click="inputChar('6')">6</UIMoloButton>
          <UIMoloButton class="btn op" @click="inputChar('−')">−</UIMoloButton>

          <UIMoloButton class="btn num" @click="inputChar('1')">1</UIMoloButton>
          <UIMoloButton class="btn num" @click="inputChar('2')">2</UIMoloButton>
          <UIMoloButton class="btn num" @click="inputChar('3')">3</UIMoloButton>
          <UIMoloButton class="btn op" @click="inputChar('+')">+</UIMoloButton>

          <UIMoloButton class="btn num zero" @click="inputChar('0')">0</UIMoloButton>
          <UIMoloButton class="btn num" @click="inputChar('.')">.</UIMoloButton>
          <UIMoloButton class="btn equals" @click="evaluate">=</UIMoloButton>
        </div>
      </main>

      <!-- Боковая панель истории -->
      <aside class="calc-history-panel">
        <div class="history-top">
          <span class="history-title">Журнал расчетов</span>
          <UIMoloButton
              v-if="history.length"
              class="history-clear-btn"
              title="Очистить журнал"
              @click="history = []"
          >
            Очистить
          </UIMoloButton>
        </div>

        <div v-if="!history.length" class="history-empty">
          <MoloSticker name="history" :size="32" glow />
          <span>История вычислений пуста</span>
        </div>

        <div v-else class="history-scroll-list">
          <div
              v-for="entry in history"
              :key="entry.id"
              class="history-card"
              @click="expression = entry.result; display = entry.result; justEvaluated = true"
          >
            <div class="h-card-top">
              <span class="h-expr">{{ entry.expr }}</span>
              <UIMoloButton
                  class="h-copy-btn small"
                  title="Скопировать"
                  @click.stop="copyToClipboard(entry.result)"
              >
                Копировать
              </UIMoloButton>
            </div>
            <div class="h-res">= {{ entry.result }}</div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.molo-calc-app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--half_opacity_bg, #12131a);
  color: #e2e8f0;
  overflow: hidden;
  box-sizing: border-box;
  user-select: none;
}

/* ---------------- Верхняя панель режимов ---------------- */
.calc-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid var(--half_opacity_border);
  flex-shrink: 0;
}

.mode-tabs {
  display: flex;
  gap: 4px;
}

.mode-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
  color: #94a3b8;
  font-size: 11.5px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.mode-btn.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  font-weight: 600;
}

.mem-indicator {
  font-size: 11px;
  font-family: monospace;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid rgba(251, 191, 36, 0.25);
}

/* ---------------- Разметка ---------------- */
.calc-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.calc-main-panel {
  flex: 1.4;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
}

/* ---------------- Экран калькулятора ---------------- */
.calc-screen {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--half_opacity_border);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 80px;
}

.screen-expr {
  font-size: 12px;
  color: #64748b;
  font-family: 'JetBrains Mono', monospace;
  min-height: 16px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screen-result {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.result-text {
  font-size: 32px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.5px;
}

.copy-quick-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.copy-quick-btn:hover {
  opacity: 1;
}

/* ---------------- Панель памяти ---------------- */
.memory-bar {
  display: flex;
  gap: 6px;
}

.mem-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--half_opacity_border);
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.mem-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

/* ---------------- Блок программиста ---------------- */
.programmer-radix-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 6px 10px;
}

.radix-row {
  display: flex;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  color: #64748b;
}

.radix-row.active {
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  font-weight: 600;
}

.radix-name {
  width: 40px;
}

.radix-val {
  flex: 1;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mono-bin {
  font-size: 10px;
  letter-spacing: 0.5px;
}

/* ---------------- Бизнес / НДС ---------------- */
.business-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 8px;
}

.biz-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.biz-label {
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
}

.biz-btns {
  display: flex;
  gap: 4px;
}

.biz-btn {
  flex: 1;
  background: rgba(30, 239, 111, 0.1);
  border: 1px solid rgba(30, 239, 111, 0.3);
  color: #4ade80;
  font-size: 11px;
  padding: 6px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.biz-btn:hover {
  background: rgba(30, 239, 111, 0.2);
  transform: translateY(-1px);
}

/* ---------------- Кнопочная сетка ---------------- */
.keypad-grid {
  display: grid;
  gap: 6px;
  flex: 1;
}

.keypad-grid.grid-standard,
.keypad-grid.grid-business {
  grid-template-columns: repeat(4, 1fr);
}

.keypad-grid.grid-scientific {
  grid-template-columns: repeat(5, 1fr);
}

.keypad-grid.grid-programmer {
  grid-template-columns: repeat(6, 1fr);
}

.btn {
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  color: #f1f5f9;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  transition: all 0.12s ease;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.09);
  transform: translateY(-1px);
}

.btn:active {
  transform: scale(0.96);
}

.btn.num {
  background: rgba(255, 255, 255, 0.05);
}

.btn.op {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.06);
}

.btn.op:hover {
  background: rgba(56, 189, 248, 0.15);
}

.btn.util {
  color: #fb7185;
}

.btn.fn {
  font-size: 12.5px;
  color: #c084fc;
  background: rgba(192, 132, 252, 0.06);
}

.btn.equals {
  grid-column: span 2;
  background: #3b82f6;
  color: #ffffff;
  border-color: #60a5fa;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
}

.btn.equals:hover {
  background: #2563eb;
}

/* ---------------- Журнал истории ---------------- */
.calc-history-panel {
  flex: 1;
  border-left: 1px solid var(--half_opacity_border);
  background: rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.history-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--half_opacity_border);
}

.history-title {
  font-size: 11.5px;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.history-clear-btn {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.history-clear-btn:hover {
  background: rgba(239, 68, 68, 0.12);
}

.history-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #64748b;
  font-size: 12px;
}

.history-scroll-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-card {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.history-card:hover {
  background: rgba(56, 189, 248, 0.08);
  border-color: rgba(56, 189, 248, 0.3);
}

.h-card-top {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.h-expr {
  font-size: 11px;
  color: #64748b;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.h-copy-btn {
  background: none;
  border: none;
  color: #38bdf8;
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.history-card:hover .h-copy-btn {
  opacity: 1;
}

.h-res {
  font-size: 15px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: #f1f5f9;
  margin-top: 2px;
}

@media (max-width: 680px) {
  .calc-layout {
    flex-direction: column;
  }
  .calc-history-panel {
    border-left: none;
    border-top: 1px solid var(--half_opacity_border);
    max-height: 180px;
  }
}
</style>