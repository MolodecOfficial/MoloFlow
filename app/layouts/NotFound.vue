<script setup lang="ts">
interface Props {
  windowId?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="not-found">
    <h3>Компонент не найден</h3>
    <p>ID: {{ windowId }}</p>
    <p>Пожалуйста, проверьте конфигурацию компонентов</p>
  </div>
</template>



<style scoped>
.not-found {
  padding: 30px;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
}

h3 {
  color: #ff6b6b;
  margin-bottom: 10px;
}

p {
  margin-bottom: 5px;
}
</style>