<script setup lang="ts">
export interface LoaderProps {
  wndLoader?: boolean
  btnLoader?: boolean
}

const props = defineProps<LoaderProps>()
</script>

<template>
  <div class="loading-overlay">
    <div v-if="wndLoader" class="loading-spinner"></div>
    <div v-if="btnLoader" class="modern-loader"></div>
  </div>

</template>

<style scoped>

</style>