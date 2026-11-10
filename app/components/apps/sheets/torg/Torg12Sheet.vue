<script setup lang="ts">
defineProps<{
  doc: any
  computedRows: any[]
  totals: any
  totalWords: string
  positionsCountWords: string
}>()
</script>

<template>
  <div class="a4-landscape-page printable-sheet">
    <div class="torg-header">
      <div class="torg-header-left">
        <div class="row-underline">
          <span class="label">Грузоотправитель:</span>
          <span class="val">{{ doc.supplier.name }}, ИНН/КПП {{ doc.supplier.inn }}/{{ doc.supplier.kpp }}, {{ doc.supplier.address }}</span>
        </div>
        <div class="row-underline">
          <span class="label">Поставщик:</span>
          <span class="val">{{ doc.supplier.name }}</span>
        </div>
        <div class="row-underline">
          <span class="label">Плательщик:</span>
          <span class="val">{{ doc.payer.name }}, ИНН/КПП {{ doc.payer.inn }}/{{ doc.payer.kpp }}, {{ doc.payer.address }}</span>
        </div>
        <div class="row-underline">
          <span class="label">Основание:</span>
          <span class="val">Договор № {{ doc.contractNumber }} от {{ doc.contractDate }}</span>
        </div>
      </div>

      <div class="torg-header-codes">
        <table class="codes-table">
          <tr><td>Форма по ОКУД</td><td class="bold">0330212</td></tr>
          <tr><td>по ОКПО (поставщик)</td><td>{{ doc.supplier.okpo }}</td></tr>
          <tr><td>по ОКПО (плательщик)</td><td>{{ doc.payer.okpo }}</td></tr>
          <tr><td>Вид деятельности по ОКДП</td><td></td></tr>
          <tr><td>Транспортная накладная</td><td></td></tr>
          <tr><td>Вид операции</td><td></td></tr>
        </table>
      </div>
    </div>

    <div class="title-block">
      <span class="main-title">ТОВАРНАЯ НАКЛАДНАЯ</span>
      <table class="doc-number-table">
        <thead>
        <tr>
          <th>Номер документа</th>
          <th>Дата составления</th>
        </tr>
        </thead>
        <tbody>
        <tr>
          <td>{{ doc.docNumber }}</td>
          <td>{{ doc.docDate }}</td>
        </tr>
        </tbody>
      </table>
    </div>

    <table class="torg-table">
      <thead>
      <tr>
        <th rowspan="2">№</th>
        <th rowspan="2">Товар (наименование)</th>
        <th rowspan="2">Код</th>
        <th colspan="2">Единица изм.</th>
        <th rowspan="2">Вид упаковки</th>
        <th rowspan="2">В одном месте</th>
        <th rowspan="2">Мест, штук</th>
        <th rowspan="2">Масса брутто</th>
        <th rowspan="2">Количество</th>
        <th rowspan="2">Цена, руб. коп.</th>
        <th rowspan="2">Сумма без НДС</th>
        <th colspan="2">НДС</th>
        <th rowspan="2">Сумма с НДС</th>
      </tr>
      <tr>
        <th>наим.</th>
        <th>ОКЕИ</th>
        <th>ставка</th>
        <th>сумма</th>
      </tr>
      <tr class="columns-number-row">
        <th v-for="c in 15" :key="c">{{ c }}</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(row, idx) in computedRows" :key="row.id">
        <td class="text-center">{{ idx + 1 }}</td>
        <td class="text-left">{{ row.name }}</td>
        <td class="text-center">{{ row.code || '-' }}</td>
        <td class="text-center">{{ row.unitName }}</td>
        <td class="text-center">{{ row.unitOkei }}</td>
        <td class="text-center">{{ row.packageType }}</td>
        <td class="text-right">1</td>
        <td class="text-right">{{ row.placesCount }}</td>
        <td class="text-right">{{ row.grossWeight || '-' }}</td>
        <td class="text-right">{{ row.quantity }}</td>
        <td class="text-right">{{ row.price.toFixed(2) }}</td>
        <td class="text-right">{{ row.sumWithoutNds.toFixed(2) }}</td>
        <td class="text-center">{{ row.ndsRate ? row.ndsRate + '%' : 'без НДС' }}</td>
        <td class="text-right">{{ row.ndsAmount.toFixed(2) }}</td>
        <td class="text-right bold">{{ row.totalWithNds.toFixed(2) }}</td>
      </tr>
      <tr class="total-row">
        <td colspan="7" class="text-right bold">Итого:</td>
        <td class="text-right bold">{{ totals.placesCount }}</td>
        <td></td>
        <td class="text-right bold">{{ totals.quantity }}</td>
        <td>X</td>
        <td class="text-right bold">{{ totals.sumWithoutNds.toFixed(2) }}</td>
        <td>X</td>
        <td class="text-right bold">{{ totals.ndsAmount.toFixed(2) }}</td>
        <td class="text-right bold">{{ totals.totalWithNds.toFixed(2) }}</td>
      </tr>
      </tbody>
    </table>

    <div class="torg-footer">
      <div class="words-summary">
        <p>Товарная накладная имеет приложение на <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u> листах</p>
        <p>и содержит <strong>{{ positionsCountWords }}</strong> порядковых номеров записей</p>
        <p>Всего отпущено на сумму: <strong>{{ totalWords }}</strong></p>
      </div>

      <div class="signatures-grid">
        <div class="sig-col">
          <div class="sig-row">
            <span>Отпуск разрешил:</span>
            <span class="underline">{{ doc.signers.directorName }}</span>
          </div>
          <div class="sig-row">
            <span>Главный бухгалтер:</span>
            <span class="underline">{{ doc.signers.accountantName }}</span>
          </div>
          <div class="sig-row">
            <span>Отпуск произвел:</span>
            <span class="underline">{{ doc.signers.releasedByName }}</span>
          </div>
          <div class="seal-mark">М.П.</div>
        </div>

        <div class="sig-col">
          <div class="sig-row">
            <span>По доверенности №</span>
            <span class="underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span>от</span>
            <span class="underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
          <div class="sig-row">
            <span>Груз принял:</span>
            <span class="underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
          <div class="sig-row">
            <span>Груз получил грузополучатель:</span>
            <span class="underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
          <div class="seal-mark">М.П.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.a4-landscape-page {
  width: 297mm;
  min-height: 210mm;
  background: #ffffff;
  color: #000000;
  padding: 12mm 15mm;
  box-sizing: border-box;
  font-family: "Times New Roman", Times, serif;
  font-size: 9pt;
  line-height: 1.15;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.torg-header {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 8px;
}

.torg-header-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row-underline {
  display: flex;
  border-bottom: 1px solid #000;
  font-size: 8pt;
}

.row-underline .label {
  font-weight: bold;
  white-space: nowrap;
  margin-right: 4px;
}

.codes-table {
  border-collapse: collapse;
  font-size: 7.5pt;
}

.codes-table td {
  border: 1px solid #000;
  padding: 1px 4px;
  text-align: center;
}

.codes-table td:first-child {
  border: none;
  text-align: right;
  padding-right: 8px;
}

.title-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin: 12px 0 8px;
}

.main-title {
  font-size: 12pt;
  font-weight: bold;
}

.doc-number-table {
  border-collapse: collapse;
  font-size: 8pt;
}

.doc-number-table th, .doc-number-table td {
  border: 1px solid #000;
  padding: 2px 8px;
  text-align: center;
}

.torg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 7.5pt;
  margin-bottom: 8px;
}

.torg-table th, .torg-table td {
  border: 1px solid #000;
  padding: 2px 3px;
}

.torg-table thead th {
  text-align: center;
  background: #f9f9f9;
}

.columns-number-row th {
  font-weight: normal;
  font-size: 6.5pt;
  background: #eee;
}

.torg-footer {
  font-size: 8pt;
  margin-top: 10px;
}

.words-summary p {
  margin: 3px 0;
}

.signatures-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-top: 15px;
}

.sig-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.underline {
  border-bottom: 1px solid #000;
  flex: 1;
  text-align: center;
  margin-left: 6px;
}

.seal-mark {
  margin-top: 8px;
  font-size: 10pt;
  font-weight: bold;
  text-align: center;
}

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }
.bold { font-weight: bold; }
</style>