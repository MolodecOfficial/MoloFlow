<script setup lang="ts">
import {usePinnedItems} from '~/composables/window/usePinnedItems'
</script>

<template>
  <div class="pinned-layer">
    <DekstopMoloPinnedShell v-for="item in usePinnedItems().pinnedItems.value" :key="item.id" :item="item">
      <div class="pinned-html" v-html="item.data.html"/>
    </DekstopMoloPinnedShell>
  </div>
</template>

<style scoped>
.pinned-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pinned-layer > * {
  pointer-events: auto;
}

.pinned-html {
  width: 100%;
  height: 100%;
  overflow: inherit;
}
</style>