<!-- components/apps/molo/sheets/torg/Torg2Sheet.vue -->
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
          <span class="label">Организация (получатель):</span>
          <span class="val">{{ doc.payer.name }}, ИНН {{ doc.payer.inn }}</span>
        </div>
        <div class="row-underline">
          <span class="label">Поставщик:</span>
          <span class="val">{{ doc.supplier.name }}</span>
        </div>
        <div class="row-underline">
          <span class="label">Сопроводительный документ:</span>
          <span class="val">Накладная № {{ doc.extra?.waybillNumber || doc.docNumber }} от {{ doc.docDate }}</span>
        </div>
      </div>

      <div class="torg-header-codes">
        <table class="codes-table">
          <tr><td>Форма по ОКУД</td><td class="bold">0330202</td></tr>
          <tr><td>по ОКПО (получатель)</td><td>{{ doc.payer.okpo }}</td></tr>
          <tr><td>по ОКПО (поставщик)</td><td>{{ doc.supplier.okpo }}</td></tr>
        </table>
      </div>
    </div>

    <div class="title-block">
      <div class="center-text">
        <span class="main-title">АКТ ОБ УСТАНОВЛЕННОМ РАСХОЖДЕНИИ ПО КОЛИЧЕСТВУ И КАЧЕСТВУ (ТОРГ-2)</span>
      </div>
      <table class="doc-number-table">
        <thead>
        <tr>
          <th>Номер акта</th>
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

    <div class="act-intro">
      Место составления акта: <u>{{ doc.payer.address }}</u>.
      Комиссия в составе: председатель <u>{{ doc.signers.directorName }}</u>,
      члены комиссии: <u>{{ doc.signers.commissionMembers || doc.signers.releasedByName }}</u> установила расхождение:
    </div>

    <!-- Сетка сличений ТОРГ-2 -->
    <table class="torg-table">
      <thead>
      <tr>
        <th rowspan="2">№</th>
        <th rowspan="2">Товар</th>
        <th rowspan="2">Ед.</th>
        <th colspan="2">По документам поставщика</th>
        <th colspan="2">Фактически принято</th>
        <th colspan="2">Расхождение (недостача / брак)</th>
        <th rowspan="2">Цена</th>
        <th rowspan="2">Сумма недостачи, руб.</th>
      </tr>
      <tr>
        <th>Кол-во</th>
        <th>Сумма с НДС</th>
        <th>Кол-во</th>
        <th>Сумма с НДС</th>
        <th>Кол-во</th>
        <th>Бой / брак</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(row, idx) in computedRows" :key="row.id">
        <td class="text-center">{{ idx + 1 }}</td>
        <td class="text-left">{{ row.name }}</td>
        <td class="text-center">{{ row.unitName }}</td>
        <td class="text-right">{{ row.quantity }}</td>
        <td class="text-right">{{ row.totalWithNds.toFixed(2) }}</td>
        <!-- Фактическое количество (по умолчанию совпадает или берется из factQuantity) -->
        <td class="text-right bold">{{ row.factQuantity ?? row.quantity }}</td>
        <td class="text-right">{{ ((row.factQuantity ?? row.quantity) * row.price * (1 + row.ndsRate/100)).toFixed(2) }}</td>
        <!-- Расхождение -->
        <td class="text-right text-red bold">
          {{ row.diffQuantity ?? (row.quantity - (row.factQuantity ?? row.quantity)) }}
        </td>
        <td class="text-center">{{ row.defectDescription || '-' }}</td>
        <td class="text-right">{{ row.price.toFixed(2) }}</td>
        <td class="text-right bold">
          {{ (((row.diffQuantity ?? (row.quantity - (row.factQuantity ?? row.quantity)))) * row.price * (1 + row.ndsRate/100)).toFixed(2) }}
        </td>
      </tr>
      </tbody>
    </table>

    <div class="torg-footer">
      <div class="words-summary">
        <p>Заключение комиссии: <strong>{{ doc.extra?.cause || 'Выявлены расхождения при приемке продукции на складе' }}</strong></p>
      </div>

      <div class="signatures-grid">
        <div class="sig-col">
          <div class="sig-row">
            <span>Председатель комиссии:</span>
            <span class="underline">{{ doc.signers.directorName }}</span>
          </div>
          <div class="sig-row">
            <span>Члены комиссии:</span>
            <span class="underline">{{ doc.signers.commissionMembers || doc.signers.accountantName }}</span>
          </div>
        </div>
        <div class="sig-col">
          <div class="sig-row">
            <span>Представитель поставщика / перевозчика:</span>
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
  font-size: 8.5pt;
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

.title-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0;
}

.main-title {
  font-size: 10pt;
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

.act-intro {
  margin-bottom: 8px;
  font-size: 8pt;
}

.torg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 7.5pt;
  margin-bottom: 8px;
}

.torg-table th, .torg-table td {
  border: 1px solid #000;
  padding: 3px;
}

.torg-table thead th {
  text-align: center;
  background: #f9f9f9;
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
  font-size: 9pt;
  font-weight: bold;
  text-align: center;
}

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }
.bold { font-weight: bold; }
.text-red { color: #b91c1c; }
</style>