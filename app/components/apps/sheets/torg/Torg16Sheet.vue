<!-- components/apps/molo/sheets/torg/Torg16Sheet.vue -->
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
  <div class="a4-portrait-page printable-sheet">
    <!-- Гриф утверждения руководителем -->
    <div class="torg16-top">
      <div class="org-info">
        <div class="row-underline">
          <span class="label">Организация:</span>
          <span class="val">{{ doc.supplier.name }}</span>
        </div>
        <div class="row-underline">
          <span class="label">Подразделение / Склад:</span>
          <span class="val">{{ doc.extra?.fromWarehouse || 'Основной склад' }}</span>
        </div>
      </div>

      <div class="approve-block">
        <table class="codes-table okud-code">
          <tr><td>Форма по ОКУД</td><td class="bold">0330216</td></tr>
          <tr><td>по ОКПО</td><td>{{ doc.supplier.okpo }}</td></tr>
        </table>

        <div class="approve-stamp">
          <div>УТВЕРЖДАЮ</div>
          <div class="stamp-post">Руководитель организации</div>
          <div class="stamp-line">
            <span class="underline">{{ doc.signers.directorName }}</span>
          </div>
          <div class="stamp-date">«____» _______________ 202___ г.</div>
        </div>
      </div>
    </div>

    <div class="title-block">
      <span class="main-title">АКТ О СПИСАНИИ ТОВАРОВ (ТОРГ-16)</span>
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

    <div class="act-cause">
      Причина списания: <strong>{{ doc.extra?.cause || 'Порча, истечение срока годности, бой' }}</strong>
    </div>

    <!-- Табличная часть списания -->
    <table class="items-table">
      <thead>
      <tr>
        <th>№</th>
        <th>Товар (наименование)</th>
        <th>Код / артикул</th>
        <th>Ед. изм.</th>
        <th>Кол-во</th>
        <th>Учетная цена, руб.</th>
        <th>Сумма, руб.</th>
        <th>Примечание</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(row, idx) in computedRows" :key="row.id">
        <td class="text-center">{{ idx + 1 }}</td>
        <td class="text-left">{{ row.name }}</td>
        <td class="text-center">{{ row.code || '-' }}</td>
        <td class="text-center">{{ row.unitName }}</td>
        <td class="text-right bold">{{ row.quantity }}</td>
        <td class="text-right">{{ row.price.toFixed(2) }}</td>
        <td class="text-right bold">{{ row.sumWithoutNds.toFixed(2) }}</td>
        <td class="text-left">{{ row.packageType || '-' }}</td>
      </tr>
      <tr class="total-row">
        <td colspan="4" class="text-right bold">Итого подлежит списанию:</td>
        <td class="text-right bold">{{ totals.quantity }}</td>
        <td>X</td>
        <td class="text-right bold">{{ totals.sumWithoutNds.toFixed(2) }}</td>
        <td></td>
      </tr>
      </tbody>
    </table>

    <div class="torg16-footer">
      <div class="words-line">
        Всего списано на сумму: <strong>{{ totalWords }}</strong>
      </div>

      <div class="commission-block">
        <div class="comm-title bold">Члены комиссии:</div>
        <div class="sig-row">
          <span>Председатель комиссии:</span>
          <span class="underline">{{ doc.signers.directorName }}</span>
        </div>
        <div class="sig-row">
          <span>Бухгалтер:</span>
          <span class="underline">{{ doc.signers.accountantName }}</span>
        </div>
        <div class="sig-row">
          <span>Материально ответственное лицо:</span>
          <span class="underline">{{ doc.signers.responsiblePerson || doc.signers.releasedByName }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.a4-portrait-page {
  width: 210mm;
  min-height: 297mm;
  background: #ffffff;
  color: #000000;
  padding: 15mm 20mm;
  box-sizing: border-box;
  font-family: "Times New Roman", Times, serif;
  font-size: 9pt;
  line-height: 1.2;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.torg16-top {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 12px;
}

.org-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row-underline {
  display: flex;
  border-bottom: 1px solid #000;
  font-size: 8.5pt;
}

.row-underline .label {
  font-weight: bold;
  margin-right: 4px;
}

.approve-block {
  width: 220px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.codes-table {
  border-collapse: collapse;
  font-size: 7.5pt;
  margin-bottom: 8px;
}

.codes-table td {
  border: 1px solid #000;
  padding: 1px 4px;
}

.approve-stamp {
  font-size: 8.5pt;
  text-align: left;
  width: 100%;
}

.stamp-post {
  font-size: 7.5pt;
  color: #444;
}

.stamp-line {
  margin: 4px 0;
}

.title-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 8px;
}

.main-title {
  font-size: 11pt;
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

.act-cause {
  margin-bottom: 10px;
  font-size: 8.5pt;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
  margin-bottom: 12px;
}

.items-table th, .items-table td {
  border: 1px solid #000;
  padding: 4px;
}

.items-table th {
  background: #f4f4f4;
  text-align: center;
}

.torg16-footer {
  margin-top: 15px;
  font-size: 8.5pt;
}

.words-line {
  margin-bottom: 15px;
}

.commission-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sig-row {
  display: flex;
  justify-content: space-between;
}

.underline {
  border-bottom: 1px solid #000;
  flex: 1;
  text-align: center;
  margin-left: 8px;
}

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }
.bold { font-weight: bold; }
</style>