<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { rublesToWordsRu, numberToWordsRu } from '~~/app/utils/numberToWordsRu'

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
  // Поля для ТОРГ-2 (расхождения):
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

const doc = ref<TorgDocData>(props.modelValue && typeof props.modelValue === 'object' ? { ...defaultData, ...props.modelValue } : defaultData)

watch(doc, (val) => {
  emit('update:modelValue', val)
}, { deep: true })

/* ───────────────────────── Выбор нужного бланка ───────────────────────── */

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

  // Создаем скрытый фрейм исключительно для печати бланка
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

  // Определяем ориентацию: ТОРГ-12 и ТОРГ-2 — альбомные, ТОРГ-16 — книжный
  const isLandscape = doc.value.torgType !== 'torg16'
  const pageRule = isLandscape
      ? '@page { size: A4 landscape; margin: 8mm 10mm; }'
      : '@page { size: A4 portrait; margin: 10mm 12mm; }'

  // Копируем все стили приложения во фрейм, чтобы таблица и шрифты выглядели 1-в-1
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

  // Даем фрейму отрендерить шрифты и вызываем диалог печати
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }, 250)
}

</script>
<template>
  <div class="primary-doc-tool" :class="[`mode-${doc.torgType}`]">
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

            <!-- Доп. поля для ТОРГ-16 (Причина списания) -->
            <div v-if="doc.torgType === 'torg16'" class="stacked">
              <UIMoloInput v-if="doc.extra" v-model="doc.extra.cause" t-label="Причина списания" compact />
              <UIMoloInput v-if="doc.extra" v-model="doc.extra.fromWarehouse" t-label="Склад списания" compact />
            </div>

            <!-- Доп. поля для ТОРГ-2 (Сопроводительные документы) -->
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
            <span>{{ doc.torgType === 'torg16' ? 'Организация' : 'Поставщик' }}</span>
          </template>
          <template #main>
            <div class="stacked">
              <UIMoloInput v-model="doc.supplier.name" t-label="Наименование" compact />
              <div class="grid-2">
                <UIMoloInput v-model="doc.supplier.inn" t-label="ИНН" compact />
                <UIMoloInput v-model="doc.supplier.kpp" t-label="КПП" compact />
              </div>
              <div class="grid-2">
                <UIMoloInput v-model="doc.supplier.okpo" t-label="ОКПО" compact />
                <UIMoloInput v-model="doc.supplier.address" t-label="Адрес" compact />
              </div>
            </div>
          </template>
        </UIMoloSection>

        <!-- Плательщик / Получатель (Не нужен при списании ТОРГ-16) -->
        <UIMoloSection v-if="doc.torgType !== 'torg16'">
          <template #header>
            <span>Покупатель / Грузополучатель</span>
          </template>
          <template #main>
            <div class="stacked">
              <UIMoloInput v-model="doc.payer.name" t-label="Наименование" compact />
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

        <!-- Товарная номенклатура -->
        <UIMoloSection>
          <template #header>
            <span>Товары ({{ doc.items.length }})</span>
          </template>
          <template #main>
            <div class="items-list">
              <div v-for="(item, idx) in doc.items" :key="item.id" class="item-edit-card">
                <div class="card-head">
                  <strong>#{{ idx + 1 }} {{ item.name || 'Товар' }}</strong>
                  <button class="remove-btn" title="Удалить" @click="removeItem(idx)">✕</button>
                </div>

                <UIMoloInput v-model="item.name" placeholder="Наименование товара" compact />

                <div class="grid-3">
                  <UIMoloInput v-model.number="item.quantity" type="number" t-label="По док-там" compact />
                  <UIMoloInput v-model.number="item.price" type="number" t-label="Цена" compact />
                  <UIMoloSelect v-model.number="item.ndsRate" t-label="НДС" compact>
                    <option v-for="opt in ndsOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </UIMoloSelect>
                </div>

                <!-- Специфика для ТОРГ-2: Расхождения -->
                <div v-if="doc.torgType === 'torg2'" class="grid-2">
                  <UIMoloInput v-model.number="item.factQuantity" type="number" t-label="Фактически принято" compact />
                  <UIMoloInput v-model="item.defectDescription" placeholder="Причина расхождения / брак" t-label="Дефект" compact />
                </div>
              </div>
            </div>
          </template>
        </UIMoloSection>

        <!-- Ответственные лица и комиссия -->
        <UIMoloSection>
          <template #header>
            <span>Ответственные лица / Комиссия</span>
          </template>
          <template #main>
            <div class="stacked">
              <UIMoloInput v-model="doc.signers.directorName" t-label="Руководитель / Председатель" compact />
              <UIMoloInput v-model="doc.signers.accountantName" t-label="Главный бухгалтер" compact />
              <UIMoloInput
                  v-if="doc.torgType === 'torg16'"
                  v-model="doc.signers.responsiblePerson"
                  t-label="МОЛ (Материально ответственное лицо)"
                  compact
              />
              <UIMoloInput
                  v-if="doc.torgType === 'torg2' || doc.torgType === 'torg16'"
                  v-model="doc.signers.commissionMembers"
                  t-label="Члены комиссии (через запятую)"
                  compact
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

.toolbar-actions {
  display: flex;
  gap: 10px;
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

.icon-btn {
  padding: 2px 6px;
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

<!-- Глобальная ориентация страниц на печати: альбомная для ТОРГ-12 и ТОРГ-2, книжная для ТОРГ-16 -->
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