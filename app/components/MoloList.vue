<script lang="ts" setup>
defineProps<{
  items: any[]
  settings: any
}>()

const emit = defineEmits(['itemClick'])
</script>

<template>
  <div class="molo-list">
    <div v-for="item in items" :key="item._id" class="list-item" @click="emit('itemClick', item)">
      <h4>{{ item[settings?.title] }}</h4>
      <p>{{ item[settings?.subtitle] }}</p>
    </div>
  </div>
</template>

<style scoped>
.molo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
}
.list-item h4 {
  margin: 0;
}
.list-item p {
  margin: 4px 0 0 0;
  color: rgba(255, 255, 255, 0.5);
}
</style>