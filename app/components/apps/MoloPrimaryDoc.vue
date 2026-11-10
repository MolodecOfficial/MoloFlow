<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, reactive } from 'vue'
import { rublesToWordsRu, numberToWordsRu } from '~~/app/utils/numberToWordsRu'
import { useDirectoryInterpolator, type DirectoryLookupItem } from '~/composables/useDirectoryInterpolator'
import DirectorySuggestDropdown from '~/components/directory/DirectorySuggestDropdown.vue'
import DirectoryResolutionModal from '~/components/directory/DirectoryResolutionModal.vue'

import Torg12Sheet from './sheets/torg/Torg12Sheet.vue'
import Torg2Sheet from './sheets/torg/Torg2Sheet.vue'
import Torg16Sheet from './sheets/torg/Torg16Sheet.vue'

export type TorgType = 'torg12' | 'torg2' | 'torg16'

export interface TorgItem {
  id: string
  name: string
  code: string
  unitName: string
  unitOkei: string
  packageType: string
  placesCount: number
  grossWeight: number
  quantity: number
  price: number
  ndsRate: number
  factQuantity?: number
  diffQuantity?: number
  defectDescription?: string
}

export interface TorgDocData {
  torgType: TorgType
  docNumber: string
  docDate: string
  supplier: {
    name: string
    inn: string
    kpp: string
    address: string
    bankName: string
    bik: string
    corrAccount: string
    settlementAccount: string
    okpo: string
  }
  payer: {
    name: string
    inn: string
    kpp: string
    address: string
    bankName: string
    bik: string
    settlementAccount: string
    okpo: string
  }
  contractNumber: string
  contractDate: string
  items: TorgItem[]
  signers: {
    directorName: string
    accountantName: string
    releasedByName: string
    responsiblePerson?: string
    commissionMembers?: string
  }
  extra?: {
    cause?: string
    waybillNumber?: string
    fromWarehouse?: string
    toWarehouse?: string
  }
}

const props = defineProps<{
  modelValue?: any
}>()

const emit = defineEmits<{
  'update:modelValue': [val: any]
}>()

const { fetchAllDirectories, resolveVariable } = useDirectoryInterpolator()

/* ── Состояние подсказчика и модалки справочников ── */
const suggestDropdownRef = ref<InstanceType<typeof DirectorySuggestDropdown> | null>(null)
const suggestVisible = ref(false)
const suggestCoords = reactive({ x: 0, y: 0 })
const suggestQuery = ref('')
const allDirectoryItems = ref<DirectoryLookupItem[]>([])

const resolutionModalOpen = ref(false)
const resolutionCandidates = ref<DirectoryLookupItem[]>([])
let currentActiveInput: HTMLInputElement | null = null
let resolving = false
let currentApplyCallback: ((resolvedText: string, item?: DirectoryLookupItem) => void) | null = null

const defaultData: TorgDocData = {
  torgType: 'torg12',
  docNumber: '1',
  docDate: new Date().toISOString().split('T')[0]!,
  supplier: {
    name: 'ООО "МолоФлоу Предприятие"',
    inn: '7701234567',
    kpp: '770101001',
    address: 'г. Москва, ул. Складская, д. 10',
    bankName: 'АО "ТИНЬКОФФ БАНК"',
    bik: '044525974',
    corrAccount: '30101810145250000974',
    settlementAccount: '40702810900000001234',
    okpo: '12345678',
  },
  payer: {
    name: 'ООО "Партнёр Ритейл"',
    inn: '7801987654',
    kpp: '780101001',
    address: 'г. Санкт-Петербург, пр. Невский, д. 1',
    bankName: 'ПАО "СБЕРБАНК"',
    bik: '044030653',
    settlementAccount: '40702810123456789012',
    okpo: '87654321',
  },
  contractNumber: 'ОСН-2026/1',
  contractDate: new Date().toISOString().split('T')[0]!,
  items: [
    {
      id: '1',
      name: 'Строительные смеси / Материалы',
      code: 'МАТ-001',
      unitName: 'шт',
      unitOkei: '796',
      packageType: 'мешок',
      placesCount: 10,
      grossWeight: 250,
      quantity: 10,
      price: 1200,
      ndsRate: 20,
      factQuantity: 8,
      diffQuantity: 2,
      defectDescription: 'Бой тары'
    }
  ],
  signers: {
    directorName: 'Иванов И.И.',
    accountantName: 'Смирнова А.В.',
    releasedByName: 'Иванов И.И.',
    responsiblePerson: 'Петров С.Н.',
    commissionMembers: 'Сидоров А.П., Васильев Д.О.'
  },
  extra: {
    cause: 'Бой при разгрузке / естественная убыль',
    waybillNumber: '1-ТТН',
    fromWarehouse: 'Центральный склад'
  }
}

const doc = ref<TorgDocData>(
    props.modelValue && typeof props.modelValue === 'object'
        ? { ...defaultData, ...props.modelValue }
        : defaultData
)

watch(doc, (val) => {
  emit('update:modelValue', val)
}, { deep: true })

/* ───────────────────────── Перехват {@...} в инпутах ТОРГ ───────────────────────── */

async function onFieldInput(
    e: Event,
    applyFn: (resolvedText: string, item?: DirectoryLookupItem) => void
) {
  const target = e.target as HTMLInputElement
  if (!target) return

  const val = target.value || ''
  currentActiveInput = target
  currentApplyCallback = applyFn

  // 1. Проверяем полное закрытое выражение {@...}
  const exactMatch = val.match(/\{@[^}]+}/)
  if (exactMatch) {
    suggestVisible.value = false
    if (resolving || resolutionModalOpen.value) return
    resolving = true
    try {
      const expr = exactMatch[0]
      const res = await resolveVariable(expr)

      if (res.directValue) {
        const replaced = val.replace(expr, res.directValue)
        applyFn(replaced)
        target.value = replaced
      } else if (res.candidates && res.candidates.length > 0) {
        resolutionCandidates.value = res.candidates
        resolutionModalOpen.value = true
      }
    } finally {
      resolving = false
    }
    return
  }

  // 2. Проверяем незакрытый префикс {@ для живого автодополнения
  const match = val.match(/\{@([^}]*)$/)
  if (match) {
    suggestQuery.value = match[1] || ''
    const rect = target.getBoundingClientRect()
    suggestCoords.x = Math.max(16, rect.left)
    suggestCoords.y = rect.bottom
    suggestVisible.value = true
  } else {
    suggestVisible.value = false
  }
}

function handleFieldKeyDown(e: KeyboardEvent) {
  if (!suggestVisible.value) return
  if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
    suggestDropdownRef.value?.handleKeyDown(e)
  }
}

// Обработчик выбора из выпадающего саджеста
function handleSuggestSelect(item: DirectoryLookupItem, fieldValue?: string) {
  if (currentApplyCallback && currentActiveInput) {
    const rawVal = currentActiveInput.value || ''
    // Если пользователь кликнул по конкретному реквизиту (например, ИНН)
    const replacement = fieldValue || item.title
    const replaced = rawVal.replace(/\{@[^}]*$/, replacement)

    currentApplyCallback(replaced, item)
    currentActiveInput.value = replaced
  }
  suggestVisible.value = false
}

// Обработчик подтверждения из модального окна
function handleModalSelect(item: DirectoryLookupItem, fieldValue?: string) {
  resolutionModalOpen.value = false
  if (currentApplyCallback && currentActiveInput) {
    const rawVal = currentActiveInput.value || ''
    const replacement = fieldValue || item.title
    const replaced = rawVal.replace(/\{@[^}]+}/, replacement)

    currentApplyCallback(replaced, item)
    currentActiveInput.value = replaced
    currentActiveInput.focus()
  }
}

// Каскадное заполнение поставщика
function applySupplierEntity(name: string, item?: DirectoryLookupItem) {
  doc.value.supplier.name = name
  if (item) {
    if (item.inn) doc.value.supplier.inn = item.inn
    if (item.kpp) doc.value.supplier.kpp = item.kpp
    if (item.address) doc.value.supplier.address = item.address
    if (item.raw.bankName) doc.value.supplier.bankName = String(item.raw.bankName)
    if (item.bik) doc.value.supplier.bik = item.bik
    if (item.accountNumber) doc.value.supplier.settlementAccount = item.accountNumber
    if (item.raw.corrAccount) doc.value.supplier.corrAccount = String(item.raw.corrAccount)
    if (item.raw.okpo) doc.value.supplier.okpo = String(item.raw.okpo)
  }
}

// Каскадное заполнение плательщика / покупателя
function applyPayerEntity(name: string, item?: DirectoryLookupItem) {
  doc.value.payer.name = name
  if (item) {
    if (item.inn) doc.value.payer.inn = item.inn
    if (item.kpp) doc.value.payer.kpp = item.kpp
    if (item.address) doc.value.payer.address = item.address
    if (item.raw.bankName) doc.value.payer.bankName = String(item.raw.bankName)
    if (item.bik) doc.value.payer.bik = item.bik
    if (item.accountNumber) doc.value.payer.settlementAccount = item.accountNumber
    if (item.raw.okpo) doc.value.payer.okpo = String(item.raw.okpo)
  }
}

// Каскадное заполнение позиции номенклатуры
function applyItemEntity(idx: number, name: string, item?: DirectoryLookupItem) {
  doc.value.items[idx].name = name
  if (item) {
    if (item.code) doc.value.items[idx].code = item.code
    if (item.price !== undefined) doc.value.items[idx].price = item.price
    if (item.unit) doc.value.items[idx].unitName = item.unit
    if (item.raw.vatRate !== undefined) doc.value.items[idx].ndsRate = Number(item.raw.vatRate)
  }
}

/* ───────────────────────── Выбор бланка ───────────────────────── */
const TORG_SHEETS = {
  torg12: Torg12Sheet,
  torg2: Torg2Sheet,
  torg16: Torg16Sheet
}

const currentSheetComponent = computed(() => TORG_SHEETS[doc.value.torgType] || Torg12Sheet)

const TORG_OPTIONS = [
  { label: 'ТОРГ-12: Товарная накладная', value: 'torg12' },
  { label: 'ТОРГ-2: Акт об установленном расхождении (брак / недостача)', value: 'torg2' },
  { label: 'ТОРГ-16: Акт о списании товаров', value: 'torg16' },
]

/* ───────────────────────── Расчеты ───────────────────────── */
const computedRows = computed(() => {
  return doc.value.items.map(item => {
    const sumWithoutNds = +(item.quantity * item.price).toFixed(2)
    const ndsAmount = item.ndsRate > 0 ? +((sumWithoutNds * item.ndsRate) / 100).toFixed(2) : 0
    const totalWithNds = +(sumWithoutNds + ndsAmount).toFixed(2)
    return {
      ...item,
      sumWithoutNds,
      ndsAmount,
      totalWithNds
    }
  })
})

const totals = computed(() => {
  return computedRows.value.reduce((acc, row) => {
    acc.placesCount += Number(row.placesCount) || 0
    acc.quantity += Number(row.quantity) || 0
    acc.sumWithoutNds += row.sumWithoutNds
    acc.ndsAmount += row.ndsAmount
    acc.totalWithNds += row.totalWithNds
    return acc
  }, {
    placesCount: 0,
    quantity: 0,
    sumWithoutNds: 0,
    ndsAmount: 0,
    totalWithNds: 0
  })
})

const totalWords = computed(() => rublesToWordsRu(totals.value.totalWithNds))
const positionsCountWords = computed(() => numberToWordsRu(doc.value.items.length))

const ndsOptions = [
  { label: '20%', value: 20 },
  { label: '10%', value: 10 },
  { label: 'Без НДС', value: 0 },
]

function addItem() {
  doc.value.items.push({
    id: String(Date.now()),
    name: 'Новый товар',
    code: '',
    unitName: 'шт',
    unitOkei: '796',
    packageType: '-',
    placesCount: 1,
    grossWeight: 0,
    quantity: 1,
    price: 0,
    ndsRate: 20,
    factQuantity: 1,
    diffQuantity: 0
  })
}

function removeItem(idx: number) {
  if (doc.value.items.length > 1) {
    doc.value.items.splice(idx, 1)
  }
}

function handlePrint() {
  const sheetEl = document.querySelector('.printable-sheet')
  if (!sheetEl) {
    window.print()
    return
  }

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const docFrame = iframe.contentWindow?.document
  if (!docFrame) return

  const isLandscape = doc.value.torgType !== 'torg16'
  const pageRule = isLandscape
      ? '@page { size: A4 landscape; margin: 8mm 10mm; }'
      : '@page { size: A4 portrait; margin: 10mm 12mm; }'

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n')

  docFrame.open()
  docFrame.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${doc.value.docNumber ? 'Документ №' + doc.value.docNumber : 'Печать'}</title>
        ${styles}
        <style>
.molo-dir-modal-host {
  position: relative;
  z-index: 10100;
}

          ${pageRule}
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          .printable-sheet {
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
          }
        </style>
      </head>
      <body>
        ${sheetEl.outerHTML}
      </body>
    </html>
  `)
  docFrame.close()

  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }, 250)
}

// Справочники грузим один раз (раньше — на каждое изменение modelValue, т.е. на каждый символ)
onMounted(async () => {
  allDirectoryItems.value = await fetchAllDirectories()
})
</script>

<template>
  <div class="primary-doc-tool" :class="[`mode-${doc.torgType}`]">
    <!-- Саджест подсказок прямо под инпутом -->
    <DirectorySuggestDropdown
        ref="suggestDropdownRef"
        :visible="suggestVisible"
        :x="suggestCoords.x"
        :y="suggestCoords.y"
        :query="suggestQuery"
        :items="allDirectoryItems"
        @select="handleSuggestSelect"
        @close="suggestVisible = false"
    />

    <!-- Модалка выбора при нескольких кандидатах -->
    <!-- Телепортируем в body: внутри .primary-doc-tool (overflow:hidden) и окна приложения модалка обрезается -->
    <Teleport to="body">
      <div class="molo-dir-modal-host">
        <DirectoryResolutionModal
            v-model="resolutionModalOpen"
            :candidates="resolutionCandidates"
            @select="handleModalSelect"
        />
      </div>
    </Teleport>

    <!-- Верхний тулбар -->
    <header class="doc-toolbar no-print">
      <div class="toolbar-left">
        <span class="toolbar-badge">СЕМЕЙСТВО ТОРГ</span>

        <UIMoloSelect
            v-model="doc.torgType"
            :parent="TORG_OPTIONS"
            children="label"
            value-key="value"
            compact
            style="width: 360px;"
        />
      </div>

      <div class="btn-group">
        <UIMoloButton class="small" @click="addItem">Добавить товар</UIMoloButton>
        <UIMoloButton class="confirm small" @click="handlePrint">Печать / PDF</UIMoloButton>
      </div>
    </header>

    <div class="doc-workspace">
      <!-- ЛЕВАЯ КОЛОНКА (Инпуты) -->
      <aside class="doc-inputs-panel no-print">

        <!-- Общие параметры -->
        <UIMoloSection>
          <template #header>
            <span>Параметры акта / накладной</span>
          </template>
          <template #main>
            <div class="grid-2">
              <UIMoloInput v-model="doc.docNumber" t-label="Номер" compact />
              <UIMoloInput v-model="doc.docDate" type="date" t-label="Дата" compact />
            </div>

            <div v-if="doc.torgType === 'torg16'" class="stacked">
              <UIMoloInput v-if="doc.extra" v-model="doc.extra.cause" t-label="Причина списания" compact />
              <UIMoloInput v-if="doc.extra" v-model="doc.extra.fromWarehouse" t-label="Склад списания" compact />
            </div>

            <div v-else-if="doc.torgType === 'torg2'" class="grid-2">
              <UIMoloInput v-if="doc.extra" v-model="doc.extra.waybillNumber" t-label="№ ТТН / Накладной" compact />
              <UIMoloInput v-model="doc.contractNumber" t-label="№ Договора" compact />
            </div>

            <div v-else class="grid-2">
              <UIMoloInput v-model="doc.contractNumber" t-label="№ Договора" compact />
              <UIMoloInput v-model="doc.contractDate" type="date" t-label="Дата договора" compact />
            </div>
          </template>
        </UIMoloSection>

        <!-- Поставщик / Организация -->
        <UIMoloSection>
          <template #header>
            <span>{{ doc.torgType === 'torg16' ? 'Организация' : 'Поставщик' }} ({@ для поиска)</span>
          </template>
          <template #main>
            <div class="stacked">
              <UIMoloInput
                  v-model="doc.supplier.name"
                  t-label="Наименование"
                  compact
                  @input="onFieldInput($event, applySupplierEntity)"
                  @keydown="handleFieldKeyDown"
              />
              <div class="grid-2">
                <UIMoloInput v-model="doc.supplier.inn" t-label="ИНН" compact />
                <UIMoloInput v-model="doc.supplier.kpp" t-label="КПП" compact />
              </div>
              <div class="grid-2">
                <UIMoloInput v-model="doc.supplier.okpo" t-label="ОКПО" compact />
                <UIMoloInput v-model="doc.supplier.address" t-label="Адрес" compact />
              </div>
              <div class="grid-2">
                <UIMoloInput
                    v-model="doc.supplier.bankName"
                    t-label="Банк"
                    compact
                    @input="onFieldInput($event, (v) => doc.supplier.bankName = v)"
                    @keydown="handleFieldKeyDown"
                />
                <UIMoloInput v-model="doc.supplier.bik" t-label="БИК" compact />
              </div>
            </div>
          </template>
        </UIMoloSection>

        <!-- Покупатель / Получатель -->
        <UIMoloSection v-if="doc.torgType !== 'torg16'">
          <template #header>
            <span>Покупатель / Грузополучатель ({@ для поиска)</span>
          </template>
          <template #main>
            <div class="stacked">
              <UIMoloInput
                  v-model="doc.payer.name"
                  t-label="Наименование"
                  compact
                  @input="onFieldInput($event, applyPayerEntity)"
                  @keydown="handleFieldKeyDown"
              />
              <div class="grid-2">
                <UIMoloInput v-model="doc.payer.inn" t-label="ИНН" compact />
                <UIMoloInput v-model="doc.payer.kpp" t-label="КПП" compact />
              </div>
              <div class="grid-2">
                <UIMoloInput v-model="doc.payer.okpo" t-label="ОКПО" compact />
                <UIMoloInput v-model="doc.payer.address" t-label="Адрес" compact />
              </div>
            </div>
          </template>
        </UIMoloSection>

        <!-- Номенклатура -->
        <UIMoloSection>
          <template #header>
            <span>Товары ({{ doc.items.length }}) · Введите {@ в название</span>
          </template>
          <template #main>
            <div class="items-list">
              <div v-for="(item, idx) in doc.items" :key="item.id" class="item-edit-card">
                <div class="card-head">
                  <strong>#{{ idx + 1 }} {{ item.name || 'Товар' }}</strong>
                  <button class="remove-btn" title="Удалить" @click="removeItem(idx)">✕</button>
                </div>

                <UIMoloInput
                    v-model="item.name"
                    placeholder="Наименование товара (напр: {@Товары)"
                    compact
                    @input="onFieldInput($event, (name, it) => applyItemEntity(idx, name, it))"
                    @keydown="handleFieldKeyDown"
                />

                <div class="grid-3">
                  <UIMoloInput v-model.number="item.quantity" type="number" t-label="По док-там" compact />
                  <UIMoloInput v-model.number="item.price" type="number" t-label="Цена" compact />
                  <UIMoloSelect v-model.number="item.ndsRate" t-label="НДС" compact>
                    <option v-for="opt in ndsOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </UIMoloSelect>
                </div>

                <div v-if="doc.torgType === 'torg2'" class="grid-2">
                  <UIMoloInput v-model.number="item.factQuantity" type="number" t-label="Фактически принято" compact />
                  <UIMoloInput v-model="item.defectDescription" placeholder="Причина расхождения" t-label="Дефект" compact />
                </div>
              </div>
            </div>
          </template>
        </UIMoloSection>

        <!-- Ответственные лица и комиссия -->
        <UIMoloSection>
          <template #header>
            <span>Ответственные лица ({@Сотрудники)</span>
          </template>
          <template #main>
            <div class="stacked">
              <UIMoloInput
                  v-model="doc.signers.directorName"
                  t-label="Руководитель / Председатель"
                  compact
                  @input="onFieldInput($event, (v) => doc.signers.directorName = v)"
                  @keydown="handleFieldKeyDown"
              />
              <UIMoloInput
                  v-model="doc.signers.accountantName"
                  t-label="Главный бухгалтер"
                  compact
                  @input="onFieldInput($event, (v) => doc.signers.accountantName = v)"
                  @keydown="handleFieldKeyDown"
              />
              <UIMoloInput
                  v-if="doc.torgType === 'torg16'"
                  v-model="doc.signers.responsiblePerson"
                  t-label="МОЛ"
                  compact
                  @input="onFieldInput($event, (v) => doc.signers.responsiblePerson = v)"
                  @keydown="handleFieldKeyDown"
              />
              <UIMoloInput
                  v-if="doc.torgType === 'torg2' || doc.torgType === 'torg16'"
                  v-model="doc.signers.commissionMembers"
                  t-label="Члены комиссии"
                  compact
                  @input="onFieldInput($event, (v) => doc.signers.commissionMembers = v)"
                  @keydown="handleFieldKeyDown"
              />
            </div>
          </template>
        </UIMoloSection>
      </aside>

      <!-- ПРАВАЯ КОЛОНКА (Интерактивный бланк) -->
      <main class="doc-preview-viewport">
        <component
            :is="currentSheetComponent"
            :doc="doc"
            :computed-rows="computedRows"
            :totals="totals"
            :total-words="totalWords"
            :positions-count-words="positionsCountWords"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.primary-doc-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--half_opacity_bg);
  color: #d1d1db;
  overflow: hidden;
  position: relative;
}

.doc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--half_opacity_bg);
  border-bottom: 1px solid var(--half_opacity_border);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-badge {
  background: #2563eb;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 4px;
}

.doc-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.doc-inputs-panel {
  width: 380px;
  flex-shrink: 0;
  border-right: 1px solid var(--half_opacity_border);
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stacked {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  gap: 6px;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item-edit-card {
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.remove-btn {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
}

.doc-preview-viewport {
  flex: 1;
  background: var(--half_opacity_bg);
  overflow: auto;
  padding: 24px;
  display: flex;
  justify-content: center;
}

@media print {
  body * {
    visibility: hidden;
  }
  .no-print {
    display: none !important;
  }
  .doc-preview-viewport {
    padding: 0 !important;
    background: white !important;
  }
  .printable-sheet, .printable-sheet * {
    visibility: visible;
  }
  .printable-sheet {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    box-shadow: none !important;
  }
}
</style>

<style>
@media print {
  .mode-torg12 @page,
.mode-torg2 @page {
  size: A4 landscape;
  margin: 10mm;
}
  .mode-torg16 @page {
  size: A4 portrait;
  margin: 12mm;
}
}
</style>