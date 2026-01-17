<script setup lang="ts">
interface Props {
  windowId?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="test-component">
    <h3>А вот здесь бассейн))))))))))))))</h3>
    <p>ID окна: {{ windowId }}</p>
    <p>Это тестовый контент для отладки</p>
  </div>
</template>


<style scoped>
.test-component {
  padding: 20px;
  color: white;
}
</style>