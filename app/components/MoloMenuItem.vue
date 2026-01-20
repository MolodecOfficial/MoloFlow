<script setup lang="ts">
import type { MenuItem } from '~/utils/menuConfig'

const props = defineProps<{
  item: MenuItem
  groupId: string
  groupTitle: string
  depth?: number
}>()

const emit = defineEmits<{
  'open-window': [
    groupId: string,
    itemId: string,
    groupTitle: string,
    itemTitle: string,
    subGroupId?: string,    // добавляем
    subGroupTitle?: string  // добавляем
  ]
}>()

const isExpanded = ref(false)

const handleClick = (event: Event) => {
  event.preventDefault()

  if (props.item.items && props.item.items.length > 0) {
    isExpanded.value = !isExpanded.value
    // НЕ открываем окно для родительского элемента с подменю
    return
  }

  // Если это конечный элемент, эмитим событие БЕЗ subGroupId
  emit('open-window',
      props.groupId,
      props.item.id,
      props.groupTitle,
      props.item.title
      // НЕТ subGroupId для обычных элементов
  )
}

// Функция для открытия дочернего элемента с передачей subGroupId
const openChildItem = (childItem: MenuItem) => {
  console.log('📤 MoloMenuItem открывает дочерний элемент:', {
    groupId: props.groupId,
    childId: childItem.id,
    subGroupId: props.item.id, // ← это должно быть 'enterprise'
    subGroupTitle: props.item.title
  })
  // Для дочерних элементов передаем текущий item как subGroupId
  emit('open-window',
      props.groupId,           // groupId: 'settings'
      childItem.id,            // itemId: 'control'
      props.groupTitle,        // groupTitle: 'Общие настройки'
      childItem.title,         // itemTitle: 'Управление предприятием'
      props.item.id,           // subGroupId: 'enterprise'
      props.item.title         // subGroupTitle: 'Предприятие'
  )
}

const getPaddingLeft = () => {
  const basePadding = 10
  return basePadding + (props.depth || 0) * 20 + 'px'
}
</script>

<template>
  <div class="menu-item-wrapper">
    <a
        href="#"
        class="link"
        :class="{ 'has-children': item.items && item.items.length > 0 }"
        :style="{ paddingLeft: getPaddingLeft() }"
        @click="handleClick"
    >
      <span class="item-title">{{ item.title }}</span>
      <span
          v-if="item.items && item.items.length > 0"
          class="expand-icon"
          :class="{ 'expanded': isExpanded }"
      >
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </a>

    <transition name="expand">
      <div v-if="item.items && item.items.length > 0 && isExpanded" class="submenu">
        <div
            v-for="childItem in item.items"
            :key="childItem.id"
            class="child-link"
            :style="{ paddingLeft: getPaddingLeft() }"
            @click="openChildItem(childItem)"
        >
          {{ childItem.title }}
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.menu-item-wrapper {
  position: relative;
}

.link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.2s ease;
  padding: 8px 10px 8px 20px;
  font-size: 14px;
  border-radius: 6px;
  margin: 2px 0;
}

.link:hover {
  color: var(--half_opacity_border_hover);
  background: rgba(56, 239, 125, 0.1);
}

.link.has-children {
  cursor: pointer;
}

.item-title {
  flex: 1;
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 8px;
  transition: transform 0.3s ease;
  opacity: 0.7;
}

.expand-icon.expanded {
  transform: rotate(180deg);
  color: var(--half_opacity_border_hover);
}

.submenu {
  margin-left: 10px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.child-link {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.2s ease;
  padding: 8px 10px 8px 40px;
  font-size: 14px;
  border-radius: 6px;
  margin: 2px 0;
  cursor: pointer;
  display: block;
}

.child-link:hover {
  color: var(--half_opacity_border_hover);
}

.link.is-group {
  color: white;
  font-weight: 600;
}

.link.is-group:hover {
  color: var(--half_opacity_border_hover);
  background-color: rgba(56, 239, 125, 0.2);
  border-color: rgba(56, 239, 125, 0.4);
}

/* Родитель с подменю (есть children и componentName) */
.link.is-parent {
  color: rgba(255, 255, 255, 0.9);
  background-color: transparent;
  border: none;
}

.link.is-parent:hover {
  color: var(--half_opacity_border_hover);
  background-color: rgba(56, 239, 125, 0.05);
}

/* Листовой элемент (нет children) */
.link.is-leaf {
  color: rgba(255, 255, 255, 0.8);
}

.link.is-leaf:hover {
  color: var(--half_opacity_border_hover);
}
</style>