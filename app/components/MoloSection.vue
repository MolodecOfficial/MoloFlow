<script setup lang="ts">

</script>

<template>
<section class="form-section">
  <slot/>
</section>
</template>

<style scoped>
.form-section {
  padding: 20px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--half_opacity_bg);
  border-radius: 16px;
  border: 1px solid var(--half_opacity_border);
  & span {
    font-weight: bold;
  }
}
</style>