<!-- app/components/devtools/MoloCalculatorTool.vue -->
<script setup lang="ts">
import {ref} from 'vue'
import {usePersistentState} from '~/composables/window/usePersistentState'

interface HistoryEntry {
  id: string;
  expr: string;
  result: string
}

const display = ref('0')
const expression = ref('')
const history = usePersistentState<HistoryEntry[]>('calc-history', [])
const justEvaluated = ref(false)

const buttons = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '=',],
]

function sanitize(expr: string): string {
  return expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/%/g, '/100')
}

function evaluate() {
  if (!expression.value) return
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${sanitize(expression.value)})`)()
    if (!isFinite(result)) throw new Error('inf')
    const rounded = Math.round(result * 1e10) / 1e10
    history.value = [{
      id: crypto.randomUUID(),
      expr: expression.value,
      result: String(rounded)
    }, ...history.value].slice(0, 30)
    display.value = String(rounded)
    expression.value = String(rounded)
    justEvaluated.value = true
  } catch {
    display.value = 'Ошибка'
    expression.value = ''
    justEvaluated.value = false
  }
}

function press(key: string) {
  if (key === '') return
  if (key === 'C') {
    expression.value = ''
    display.value = '0'
    return
  }
  if (key === '⌫') {
    expression.value = expression.value.slice(0, -1)
    display.value = expression.value || '0'
    return
  }
  if (key === '=') {
    evaluate()
    return
  }

  if (justEvaluated.value && /[0-9.]/.test(key)) {
    expression.value = ''
    justEvaluated.value = false
  } else {
    justEvaluated.value = false
  }

  expression.value += key
  display.value = expression.value
}

function onKeydown(e: KeyboardEvent) {
  if (/[0-9.]/.test(e.key)) return press(e.key)
  if (e.key === '+') return press('+')
  if (e.key === '-') return press('−')
  if (e.key === '*') return press('×')
  if (e.key === '/') return press('÷')
  if (e.key === 'Enter' || e.key === '=') return press('=')
  if (e.key === 'Backspace') return press('⌫')
  if (e.key === 'Escape') return press('C')
}

const clearHistory = () => {
  history.value = []
}
const reuse = (entry: HistoryEntry) => {
  expression.value = entry.result
  display.value = entry.result
  justEvaluated.value = true
}
</script>

<template>
  <div class="tool" tabindex="0" @keydown="onKeydown">
    <div class="calc-body">
      <div class="calc-display">
        <div class="result">{{ display }}</div>
      </div>
      <div class="pad">
        <template v-for="(row, ri) in buttons" :key="ri">
          <UIMoloButton
              v-for="key in row" :key="key"
              v-show="key !== ''"
              class="key small"
              :class="{
                op: ['÷','×','−','+','%'].includes(key),
                confirm: key === '=',
                util: ['C','⌫'].includes(key)
              }"
              @click="press(key)"
          >{{ key }}
          </UIMoloButton>
        </template>
      </div>
    </div>
  </div>
  <hr>
  <div>
    <div class="history">
      <div class="history-head">
        <span>История</span>
        <UIMoloButton v-if="history.length" class="small" @click="clearHistory">Очистить</UIMoloButton>
      </div>
      <div v-if="!history.length" class="empty">Пока пусто</div>
      <button v-for="h in history" :key="h.id" class="history-item" @click="reuse(h)">
        <span class="h-expr">{{ h.expr }}</span>
        <span class="h-res">= {{ h.result }}</span>
      </button>
    </div>
  </div>

</template>

<style scoped>
.tool {
  display: flex;
  gap: 14px;
  padding: 12px;
  height: 100%;
  outline: none;
  flex-direction: column;
}

.calc-body {
  flex: 1.3;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.calc-display {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  padding: 14px 16px;
  text-align: right;
}

.expr {
  color: #888;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  min-height: 16px;
}

.result {
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 30px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  flex: 1;
}

.key {
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: #eee;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.key:hover {
  background: rgba(91, 141, 239, 0.15);
}

.key:active {
  transform: scale(0.95);
}

.key.op {
  color: var(--borber-color_main);
}

.key.confirm {
  background: var(--borber-color_main);
  grid-column-start: span 2;
}



.key.util {
  color: #ef5b8d;
}

.history {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  overflow-y: auto;
}

.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #999;
  font-size: 12px;
  text-transform: uppercase;
}

.history-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  text-align: right;
}

.history-item:hover {
  border-color: var(--half_opacity_border);
  background: rgba(91, 141, 239, 0.08);
}

.h-expr {
  color: #888;
  font-size: 11px;
  font-family: monospace;
}

.h-res {
  color: #eee;
  font-size: 14px;
  font-family: monospace;
  font-weight: 600;
}

.empty {
  color: #666;
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}
</style>