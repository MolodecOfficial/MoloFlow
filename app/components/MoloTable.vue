<script lang="ts" setup>
defineProps<{
  columns: any[]
  data: any[]
  settings?: any
}>()

const emit = defineEmits(['rowClick', 'sort'])
</script>

<template>
  <table class="molo-table">
    <thead>
    <tr>
      <th v-for="col in columns" :key="col.field" @click="emit('sort', col.field)">
        {{ col.label }}
      </th>
    </tr>
    </thead>
    <tbody>
    <tr v-for="row in data" :key="row._id" @click="emit('rowClick', row)">
      <td v-for="col in columns" :key="col.field">
        {{ row[col.field] }}
      </td>
    </tr>
    </tbody>
  </table>
</template>

<style scoped>
.molo-table {
  width: 100%;
  border-collapse: collapse;
}
.molo-table th {
  padding: 10px;
  text-align: left;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
}
.molo-table td {
  padding: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.molo-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}
</style>