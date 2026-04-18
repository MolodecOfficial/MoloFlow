<script setup lang="ts">

</script>

<template>
  <NuxtLayout>

    <NuxtPage/>
  </NuxtLayout>
</template>

<style>

::-webkit-scrollbar {
  width: 8px;
  height: 4px;
}

/* Трек (фон) */
::-webkit-scrollbar-track {
  background: transparent; /* цвет фона трека */
  border-radius: 10px; /* скругление (опционально) */
}

/* Ползунок */
::-webkit-scrollbar-thumb {
  margin: 20px;
  background: var(--half_opacity_border); /* цвет ползунка */
  border-radius: 20px; /* скругление */
}

/* При наведении на ползунок можно добавить эффект */
::-webkit-scrollbar-thumb:hover {
  background: var(--borber-color_main);
}

</style>
