<!-- components/apps/molo/ApiImportModal.vue -->
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  DEFAULT_MAX_ROWS,
  HARD_MAX_ROWS,
  guessSourceName,
  newSource,
  useApiTable,
  type ApiImportPayload,
  type ApiMatrix,
  type ApiSource,
} from '~/composables/table/useApiTable'

const props = defineProps<{
  modelValue: boolean
  sources: ApiSource[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'import', payload: ApiImportPayload): void
  (e: 'remove', id: string): void
}>()

const { fetchMatrix } = useApiTable()

const form = reactive<ApiSource>(newSource())
const target = ref<'new' | 'active'>('new')
const loading = ref(false)
const busyId = ref<string | null>(null)
const error = ref('')
const notice = ref('')
const matrix = ref<ApiMatrix | null>(null)
let matrixKey = ''

const api_methods = [
  { label: 'GET / Получить', value: 'GET' },
  { label: 'POST / Отправить', value: 'POST' }
]

const isEditing = computed(() => props.sources.some(s => s.id === form.id))
const currentKey = () => JSON.stringify([
  form.url,
  form.method,
  form.headers,
  form.body,
  form.dataPath,
  form.maxRows,
  form.authType,
  form.authLogin,
  form.authPassword
])

const previewHeaders = computed(() => matrix.value?.headers.slice(0, 8) ?? [])
const previewRows = computed(() => matrix.value?.rows.slice(0, 8).map(r => r.slice(0, 8)) ?? [])

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function resetForm() {
  Object.assign(form, newSource())
  target.value = 'new'
  matrix.value = null
  matrixKey = ''
  error.value = ''
  notice.value = ''
}

function startEdit(src: ApiSource) {
  Object.assign(form, clone(src))
  matrix.value = null
  matrixKey = ''
  error.value = ''
  notice.value = src.needsHeaders
      ? 'Значения заголовков или ключей авторизации не хранятся в документе — введите их заново.'
      : ''
}

function addHeader() {
  form.headers.push({ key: '', value: '' })
}

function removeHeader(i: number) {
  form.headers.splice(i, 1)
}

function applyYooKassaPreset() {
  form.authType = 'yookassa'
  form.method = 'GET'
  form.name = 'Платежи ЮKassa'
  form.url = 'https://api.yookassa.ru/v3/payments?limit=100'
  form.dataPath = 'items'
}

function setCustomApi() {
  form.authType = 'none'
  if (form.name === 'Платежи ЮKassa') {
    form.name = ''
    form.url = ''
    form.dataPath = ''
  }
}

function validate(): string | null {
  let url: URL
  try {
    url = new URL(form.url.trim())
  } catch {
    return 'Введите корректный URL, например https://api.yookassa.ru/v3/payments?limit=100'
  }
  if (!['http:', 'https:'].includes(url.protocol)) return 'Поддерживаются только http и https'

  if (form.authType === 'yookassa') {
    if (!form.authLogin?.trim()) return 'Для ЮKassa укажите Shop ID (логин магазина)'
    if (!form.authPassword?.trim()) return 'Для ЮKassa укажите секретный ключ (live_... или test_...)'
  }

  if (form.method === 'POST' && form.body.trim()) {
    try {
      JSON.parse(form.body)
    } catch {
      return 'Тело запроса должно быть валидным JSON'
    }
  }
  const max = Number(form.maxRows)
  if (!Number.isFinite(max) || max < 1 || max > HARD_MAX_ROWS) {
    return `Лимит строк — от 1 до ${HARD_MAX_ROWS}`
  }
  return null
}

function cleanedForm(): ApiSource {
  const src = clone(form) as ApiSource
  src.url = src.url.trim()
  src.headers = (src.headers || []).filter(h => h.key.trim()).map(h => ({ key: h.key.trim(), value: h.value }))
  src.name = src.name.trim() || guessSourceName(src.url)
  src.dataPath = src.dataPath.trim()
  src.maxRows = Math.floor(Number(src.maxRows))
  src.authLogin = src.authLogin?.trim() || ''
  src.authPassword = src.authPassword?.trim() || ''
  return src
}

async function check() {
  error.value = ''
  notice.value = ''
  const problem = validate()
  if (problem) {
    error.value = problem
    return false
  }
  loading.value = true
  try {
    const src = cleanedForm()
    matrix.value = await fetchMatrix(src)
    matrixKey = currentKey()
    if (!matrix.value.rows.length) {
      error.value = 'API ответил, но строк для таблицы не найдено'
      return false
    }
    return true
  } catch (e: any) {
    matrix.value = null
    error.value = e?.message || 'Не удалось выполнить запрос'
    return false
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (loading.value) return
  if (!matrix.value || matrixKey !== currentKey()) {
    const ok = await check()
    if (!ok) return
  }
  const source = cleanedForm()
  emit('import', {
    source,
    matrix: matrix.value!,
    target: isEditing.value ? 'refresh' : target.value,
  })
  emit('update:modelValue', false)
  resetForm()
}

async function refreshSaved(src: ApiSource) {
  if (src.needsHeaders && (!src.authPassword || src.headers.some(h => !h.value))) {
    startEdit(src)
    return
  }
  busyId.value = src.id
  error.value = ''
  try {
    const m = await fetchMatrix(src)
    if (!m.rows.length) throw new Error('API ответил, но данных для таблицы нет')
    emit('import', { source: clone(src), matrix: m, target: 'refresh' })
    emit('update:modelValue', false)
  } catch (e: any) {
    error.value = `«${src.name}»: ${e?.message || 'не удалось обновить'}`
  } finally {
    busyId.value = null
  }
}

function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

watch(() => props.modelValue, (open) => {
  if (!open) loading.value = false
})
</script>

<template>
  <UIMoloModal
      :model-value="modelValue"
      title="Подключить API"
      width="740px"
      :confirm-text="isEditing ? 'Сохранить и обновить' : 'Вставить в таблицу'"
      cancel-text="Отмена"
      @update:model-value="(val) => emit('update:modelValue', val)"
      @confirm="submit"
  >
    <template #body>
      <div class="api-modal">
        <!-- Уже подключённые источники -->
        <div v-if="sources.length" class="block">
          <div class="block-title">Подключённые источники</div>
          <div class="source-list">
            <div v-for="src in sources" :key="src.id" class="source-row" :class="{ active: src.id === form.id }">
              <div class="source-info">
                <strong class="source-name">{{ src.name }}</strong>
                <span class="source-url">{{ src.url }}</span>
                <span class="source-meta">
                  <template v-if="src.lastRows != null">{{ src.lastRows }} строк · </template>
                  <template v-if="src.sheetName">лист «{{ src.sheetName }}»</template>
                  <template v-if="src.lastSyncAt"> · {{ formatDate(src.lastSyncAt) }}</template>
                </span>
              </div>
              <div class="btn-group">
                <UIMoloButton type="button" class="small confirm" :loading="busyId === src.id" :disabled="busyId === src.id" @click="refreshSaved(src)">
                  {{ busyId === src.id ? "" : 'Обновить' }}
                </UIMoloButton>
                <UIMoloButton type="button" class="small confirm" @click="startEdit(src)">Изменить</UIMoloButton>
                <UIMoloButton type="button" class="small close" @click="emit('remove', src.id)">Удалить</UIMoloButton>
              </div>
            </div>
          </div>
        </div>

        <div class="block">
          <div class="block-title">
            {{ isEditing ? 'Редактирование источника' : 'Новое подключение' }}
            <button v-if="isEditing" type="button" class="link-btn" @click="resetForm">+ Новый</button>
          </div>

          <!-- Пресеты -->
          <div class="row presets">
            <span class="preset-label">Пресет:</span>
            <button
                type="button"
                class="preset-badge"
                :class="{ active: form.authType === 'yookassa' }"
                @click="applyYooKassaPreset"
            >
              ЮKassa (Платежи)
            </button>
            <button
                type="button"
                class="preset-badge"
                :class="{ active: form.authType === 'none' }"
                @click="setCustomApi"
            >
              Кастомный API
            </button>
          </div>

          <!-- Настройка авторизации ЮKassa -->
          <template v-if="form.authType === 'yookassa'">
            <div class="sub-title">Авторизация ЮKassa (Basic Auth)</div>
            <div class="row auth-box">
              <input
                  v-model="form.authLogin"
                  class="field login-field"
                  type="text"
                  placeholder="Shop ID (например, 123456)"
              />
              <input
                  v-model="form.authPassword"
                  class="field grow mono"
                  type="password"
                  placeholder="Секретный ключ (live_TYvQ... или test_...)"
              />
            </div>
          </template>

          <div class="row">
            <UIMoloSelect
                v-model="form.method"
                :parent="api_methods"
                children="label"
                value-key="value"
            />
            <UIMoloInput
                v-model="form.url"
                class="grow"
                type="text"
                placeholder="https://api.example.com/v1/items"
                @keydown.enter.prevent="check"
            />
          </div>

          <div class="row">
            <input v-model="form.name" class="field grow" type="text" placeholder="Название (по умолчанию — из URL)">
            <input v-model="form.dataPath" class="field grow" type="text" placeholder="Путь к данным, напр. items (необязательно)">
          </div>

          <!-- Кастомные заголовки (для не-ЮKassa) -->
          <template v-if="form.authType === 'none'">
            <div class="sub-title">
              <span>Заголовки запроса (Headers)</span>
              <button type="button" class="link-btn" @click="addHeader">+ Добавить</button>
            </div>
            <div v-for="(h, i) in form.headers" :key="i" class="row">
              <input v-model="h.key" class="field half" placeholder="Authorization / X-Api-Key" />
              <input v-model="h.value" class="field grow mono" type="text" placeholder="Значение" />
              <button type="button" class="icon-btn" @click="removeHeader(i)">×</button>
            </div>
          </template>

          <!-- Тело POST -->
          <template v-if="form.method === 'POST'">
            <div class="sub-title">Тело запроса (JSON)</div>
            <textarea v-model="form.body" class="field mono" rows="3" placeholder='{"filter": {"status": "active"}}'/>
          </template>

          <div class="row options">
            <label class="inline">
              Макс. строк
              <input v-model.number="form.maxRows" class="field num" type="number" min="1" :max="HARD_MAX_ROWS" :placeholder="String(DEFAULT_MAX_ROWS)">
            </label>
            <label class="check">
              <input v-model="form.saveHeaders" type="checkbox" />
              Сохранять секретные ключи в файле
            </label>
            <template v-if="!isEditing">
              <label class="radio"><input v-model="target" type="radio" value="new"> Новый лист</label>
              <label class="radio"><input v-model="target" type="radio" value="active"> Текущий лист</label>
            </template>
            <span v-else class="hint">Данные обновятся на листе «{{ form.sheetName }}»</span>
          </div>

          <div class="row">
            <button type="button" class="check-btn" :disabled="loading" @click="check">
              {{ loading ? 'Запрос…' : 'Проверить запрос' }}
            </button>
            <span v-if="matrix && !error" class="hint ok">
              Найдено: {{ matrix.totalRows }} строк, {{ matrix.headers.length }} колонок
              <template v-if="matrix.path"> · путь: <code>{{ matrix.path }}</code></template>
              <template v-if="matrix.truncated"> · будет вставлено {{ matrix.rows.length }}</template>
            </span>
          </div>

          <div v-if="notice" class="msg info">{{ notice }}</div>
          <div v-if="error" class="msg error">{{ error }}</div>

          <!-- Превью данных -->
          <div v-if="matrix && previewRows.length" class="preview">
            <table>
              <thead>
              <tr><th v-for="h in previewHeaders" :key="h">{{ h }}</th></tr>
              </thead>
              <tbody>
              <tr v-for="(r, ri) in previewRows" :key="ri">
                <td v-for="(c, ci) in r" :key="ci">{{ c === '' ? '—' : c }}</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </UIMoloModal>
</template>

<style scoped>
.api-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
  font-size: 13px;
}

.block { display: flex; flex-direction: column; gap: 8px; }

.block-title, .sub-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #8c8c9e;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sub-title { margin-top: 4px; }

.row { display: flex; align-items: center; gap: 8px; }
.row.presets { gap: 10px; margin-bottom: 2px; }
.row.options { flex-wrap: wrap; gap: 14px; margin-top: 4px; }

.preset-label { color: #8c8c9e; font-size: 12px; }
.preset-badge {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  color: #ccc;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}
.preset-badge:hover { color: #fff; border-color: #6496ff; }
.preset-badge.active {
  background: rgba(100, 150, 255, 0.2);
  border-color: #6496ff;
  color: #fff;
  font-weight: 500;
}

.auth-box {
  background: rgba(100, 150, 255, 0.06);
  border: 1px dashed rgba(100, 150, 255, 0.3);
  padding: 8px;
  border-radius: 6px;
}
.login-field { width: 200px; }

.field {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
  color: #fff;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  min-width: 0;
}
.field:focus { border-color: #6496ff; }
.field.grow { flex: 1; }
.field.half { width: 34%; }
.field.num { width: 84px; margin-left: 6px; }
.field.mono { font-family: monospace; width: 100%; resize: vertical; }

.inline, .radio, .check { display: inline-flex; align-items: center; gap: 6px; color: #ccc; cursor: pointer; }
.check { font-size: 12px; color: #8c8c9e; }

.link-btn {
  background: none;
  border: none;
  color: #8fb1ff;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
}
.link-btn:hover { color: #fff; }

.icon-btn {
  background: none;
  border: none;
  color: #8c8c9e;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}
.icon-btn:hover { color: #ff8a8a; }

.check-btn {
  background: rgba(100, 150, 255, 0.15);
  border: 1px solid #6496ff;
  color: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.check-btn:disabled { opacity: 0.6; cursor: default; }

.hint { color: #8c8c9e; font-size: 12px; }
.hint.ok { color: #7bd88f; }
.hint code { font-family: monospace; color: #ccc; }

.msg { padding: 8px 10px; border-radius: 6px; font-size: 12.5px; }
.msg.error { background: rgba(255, 90, 90, 0.12); border: 1px solid rgba(255, 90, 90, 0.4); color: #ffb3b3; }
.msg.info { background: rgba(100, 150, 255, 0.12); border: 1px solid rgba(100, 150, 255, 0.4); color: #bcd0ff; }

.source-list { display: flex; flex-direction: column; gap: 6px; }
.source-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
}
.source-row.active { border-color: #6496ff; background: rgba(100, 150, 255, 0.08); }
.source-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.source-name { color: #fff; font-size: 13px; }
.source-url, .source-meta { color: #8c8c9e; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.preview {
  overflow: auto;
  max-height: 220px;
  border: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
}
.preview table { border-collapse: collapse; width: 100%; font-size: 12px; }
.preview th, .preview td {
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  text-align: left;
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ccc;
}
.preview th { position: sticky; top: 0; background: #2a2a36; color: #fff; font-weight: 600; }
</style>