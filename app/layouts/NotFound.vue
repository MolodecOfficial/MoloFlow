<script setup lang="ts">
import type { MenuItem } from '~/utils/menuConfig'

interface Props {
  item: MenuItem
  groupId: string
  groupTitle: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'open-window': [groupId: string, itemId: string, groupTitle: string, itemTitle: string]
}>()

const hasChildren = computed(() =>
    props.item.items && props.item.items.length > 0
)

const handleClick = () => {
  if (hasChildren.value && props.item.items) {
    // Открываем первый дочерний элемент
    const firstChild = props.item.items[0]
    emit('open-window', props.groupId, firstChild.id, props.groupTitle, firstChild.title)
  } else {
    // Открываем сам элемент
    emit('open-window', props.groupId, props.item.id, props.groupTitle, props.item.title)
  }
}
</script>

<template>
  <a
      href="#"
      class="link"
      @click.prevent="handleClick"
  >
    <span class="link-text">{{ item.title }}</span>
    <span v-if="hasChildren" class="children-indicator">▶</span>
  </a>
</template>