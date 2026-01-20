<script setup lang="ts">
const props = defineProps( {
  groupId: String,
  subGroupId: String,
  windowId: String,
})
</script>

<template>
  <section>
    <span>Тут тестируют предприятия бля</span>
    <span>id группы: {{ props.groupId }} </span>
    <span>sub-id группы: {{ props.subGroupId }} </span>

    <span>id окна: {{ props.windowId }}</span>
  </section>
</template>

<style scoped>

</style>