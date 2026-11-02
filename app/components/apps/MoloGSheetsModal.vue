<!-- components/apps/MoloGSheetsModal.vue -->
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { parseSpreadsheetId, type GSheetsLink, type LinkMode } from '~/utils/gsheetsSync'
import { errorMessage, resolveEnterpriseId, type LinkStatus } from '~/composables/table/useGoogleSheetsSync'

interface SheetOption { sheetId: number; title: string; rowCount: number; columnCount: number }

export interface GSheetsLinkPayload {
  spreadsheetId: string
  spreadsheetTitle: string
  sheetTitle: string
  mode: LinkMode
}

const props = defineProps<{
  modelValue: boolean
  /** Все связи документа (для списка внизу) */
  links: GSheetsLink[]
  /** Связь для активного листа MoloTable, если есть */
  activeLink: GSheetsLink | null
  activeSheetName: string
  statuses: Record<string, LinkStatus>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'link', payload: GSheetsLinkPayload): void
  (e: 'unlink', id: string): void
  (e: 'sync', id: string): void
}>()

const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1CTE1Xx-NdiMon18iRfqBfzqZww-50dfMzZlTZj5d1e8/edit?gid=0#gid=0'
const url = ref(DEFAULT_SPREADSHEET_URL)
const checking = ref(false)
const error = ref('')
const meta = reactive<{ spreadsheetId: string; title: string; sheets: SheetOption[] }>({
  spreadsheetId: '',
  title: '',
  sheets: [],
})
const selectedTab = ref('')
const mode = ref<LinkMode>('merge')

const tabOptions = computed(() => meta.sheets.map(s => ({ label: `${s.title} (${s.rowCount}×${s.columnCount})`, value: s.title })))
const modeOptions = [
  { label: 'Объединить: при конфликте побеждает MoloTable', value: 'merge' },
  { label: 'Взять из Google: локальные данные листа заменятся', value: 'replace-local' },
  { label: 'Отправить в Google: таблица станет копией листа', value: 'replace-remote' },
]

const activeStatus = computed(() => (props.activeLink ? props.statuses[props.activeLink.id] : undefined))

const canLink = computed(() => !!meta.spreadsheetId && !!selectedTab.value && !props.activeLink)

function reset() {
  url.value = DEFAULT_SPREADSHEET_URL
  error.value = ''
  meta.spreadsheetId = ''
  meta.title = ''
  meta.sheets = []
  selectedTab.value = ''
  mode.value = 'merge'
}

watch(() => props.modelValue, (open) => {
  if (open) reset()
})

async function check() {
  error.value = ''
  const id = parseSpreadsheetId(url.value)
  if (!id) {
    error.value = 'Вставьте ссылку на Google Таблицу или её ID'
    return
  }
  checking.value = true
  try {
    const res = await $fetch<{ spreadsheetId: string; title: string; sheets: SheetOption[] }>('/api/gsheets/meta', {
      query: { enterpriseId: resolveEnterpriseId(), spreadsheetId: id },
    })
    meta.spreadsheetId = res.spreadsheetId
    meta.title = res.title
    meta.sheets = res.sheets
    selectedTab.value = res.sheets[0]?.title ?? ''
  } catch (e) {
    meta.sheets = []
    meta.spreadsheetId = ''
    error.value = errorMessage(e)
  } finally {
    checking.value = false
  }
}

function confirm() {
  if (!canLink.value) return
  emit('link', {
    spreadsheetId: meta.spreadsheetId,
    spreadsheetTitle: meta.title,
    sheetTitle: selectedTab.value,
    mode: mode.value,
  })
  emit('update:modelValue', false)
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <UIMoloModal
      :model-value="modelValue"
      title="Google Таблицы"
      width="620px"
      confirm-text="Закрыть"
      cancel-text="Отмена"
      hide-cancel
      @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <template #body>
    <div class="gs-body">
      <!-- Связь активного листа -->
      <div v-if="activeLink" class="gs-status">
        <div class="gs-row">
          <span class="gs-label">Лист MoloTable</span>
          <span>{{ activeLink.localSheetName }}</span>
        </div>
        <div class="gs-row">
          <span class="gs-label">Google Таблица</span>
          <span>{{ activeLink.spreadsheetTitle || activeLink.spreadsheetId }} → {{ activeLink.sheetTitle }}</span>
        </div>
        <div class="gs-row">
          <span class="gs-label">Синхронизация</span>
          <span>
            <template v-if="activeStatus?.busy">Синхронизация…</template>
            <template v-else-if="activeStatus?.lastError">
              <span class="gs-error">Ошибка: {{ activeStatus.lastError }}</span>
            </template>
            <template v-else>
              Последняя: {{ formatDate(activeStatus?.lastSyncAt) }}
              <template v-if="activeStatus?.lastConflicts"> · конфликтов: {{ activeStatus.lastConflicts }} (приоритет у MoloTable)</template>
            </template>
          </span>
        </div>
        <p class="gs-hint">Изменения синхронизируются автоматически: правки уходят в Google, а изменения из таблицы подтягиваются раз в 30 секунд.</p>
        <div class="gs-actions">
          <UIMoloButton class="small" :disabled="activeStatus?.busy" @click="emit('sync', activeLink.id)">Синхронизировать сейчас</UIMoloButton>
          <UIMoloButton class="small close" @click="emit('unlink', activeLink.id)">Отвязать лист</UIMoloButton>
        </div>
      </div>

      <!-- Новая связь -->
      <template v-else>
        <p class="gs-hint">
          Для работы один раз подключите Google Apps Script Web App на сервере (инструкция в docs/google-sheets-sync/README.md).
          Лист MoloTable: <b>{{ activeSheetName || '—' }}</b>
        </p>

        <div class="gs-row-input">
          <UIMoloInput
              v-model="url"
              class="grow"
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              @keydown.enter.prevent="check"
          />
          <UIMoloButton class="small" :loading="checking" :disabled="checking || !url" @click="check">Проверить</UIMoloButton>
        </div>

        <p v-if="error" class="gs-error">{{ error }}</p>

        <template v-if="meta.sheets.length">
          <div class="gs-row">
            <span class="gs-label">Таблица</span>
            <span>{{ meta.title }}</span>
          </div>
          <UIMoloSelect
              v-model="selectedTab"
              :parent="tabOptions"
              children="label"
              value-key="value"
          />
          <UIMoloSelect
              v-model="mode"
              :parent="modeOptions"
              children="label"
              value-key="value"
          />
          <div class="gs-actions">
            <UIMoloButton class="small confirm" :disabled="!canLink" @click="confirm">Связать лист</UIMoloButton>
          </div>
        </template>
      </template>

      <!-- Все связи документа -->
      <div v-if="links.length" class="gs-list">
        <div class="gs-label">Связанные листы в этом документе</div>
        <div v-for="l in links" :key="l.id" class="gs-list-item">
          <span>{{ l.localSheetName }} ⇄ {{ l.spreadsheetTitle || l.spreadsheetId }} / {{ l.sheetTitle }}</span>
        </div>
      </div>
    </div>
    </template>
  </UIMoloModal>
</template>

<style scoped>
.gs-body { display: flex; flex-direction: column; gap: 12px; }
.gs-row { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
.gs-label { color: var(--muted, #8b949e); min-width: 140px; }
.gs-row-input { display: flex; gap: 8px; align-items: center; }
.gs-row-input .grow { flex: 1; }
.gs-hint { margin: 0; color: var(--muted, #8b949e); font-size: 13px; line-height: 1.5; }
.gs-error { margin: 0; color: #f85149; font-size: 13px; }
.gs-actions { display: flex; gap: 8px; }
.gs-list { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid rgba(128, 128, 128, 0.25); padding-top: 12px; }
.gs-list-item { font-size: 13px; }
</style>
