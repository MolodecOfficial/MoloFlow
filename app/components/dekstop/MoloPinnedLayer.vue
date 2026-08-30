<script setup lang="ts">
import { usePinnedItems } from '~/composables/window/usePinnedItems'
import MoloPinnedNote from './MoloPinnedNote.vue'

const { pinnedItems } = usePinnedItems()
</script>

<template>
  <div class="pinned-layer">
    <template v-for="item in pinnedItems" :key="item.id">
      <MoloPinnedNote v-if="item.type === 'note'" :item="item" />
    </template>
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
</style>