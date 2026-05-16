<!-- components/MenuItemTree.vue -->
<script setup lang="ts">
const props = defineProps<{
  item: any
  groupId: string
  depth: number
  deletingItem: string | null
}>()

const emit = defineEmits<{
  'delete-item': [itemId: string]
  'add-module': [itemId: string]
}>()

const isExpanded = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const getPaddingLeft = () => `${props.depth * 20}px`

const getItemIcon = (item: any) => {
  if (item.isModule) return '🧩'
  if (item.componentName) return '⚡'
  if (item.items?.length) return '📂'
  return '📄'
}

const getItemType = (item: any) => {
  if (item.isModule) return 'модуль'
  if (item.componentName) return 'компонент'
  if (item.items?.length) return 'папка'
  return 'пункт'
}
</script>

<template>
  <div class="tree-item-wrapper">
    <!-- Элемент -->
    <div
        class="tree-item"
        :style="{ paddingLeft: getPaddingLeft() }"
    >
      <div class="tree-item-info">
        <span
            v-if="item.items?.length"
            class="tree-toggle"
            @click="toggleExpand"
        >
          {{ isExpanded ? '▾' : '▸' }}
        </span>
        <span v-else class="tree-toggle-spacer"></span>

        <span class="tree-item-icon">{{ getItemIcon(item) }}</span>

        <div class="tree-item-details">
          <span class="tree-item-title">{{ item.title }}</span>
          <span class="tree-item-type">{{ getItemType(item) }}</span>
          <span v-if="item.isActive === false" class="tree-item-inactive">неактивен</span>
        </div>
      </div>

      <div class="tree-item-actions">
        <button
            v-if="item.isModule"
            class="tree-action-btn add"
            @click="emit('add-module', item.id)"
            title="Добавить модуль сюда"
        >
          +
        </button>
        <button
            class="tree-action-btn delete"
            @click="emit('delete-item', item.id)"
            :disabled="deletingItem === item.id"
            title="Удалить"
        >
          <span v-if="deletingItem !== item.id">×</span>
          <span v-else class="deleting-spinner">⋯</span>
        </button>
      </div>
    </div>

    <!-- Вложенные элементы -->
    <div v-if="isExpanded && item.items?.length" class="tree-children">
      <MoloMenuItemTree
          v-for="child in item.items"
          :key="child.id"
          :item="child"
          :groupId="groupId"
          :depth="depth + 1"
          :deletingItem="deletingItem"
          @delete-item="(id) => emit('delete-item', id)"
          @add-module="(id) => emit('add-module', id)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { ref } from 'vue'
</script>

<style scoped>
.tree-item-wrapper {
  display: flex;
  flex-direction: column;
}

.tree-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.tree-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.tree-item-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.tree-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #888;
  font-size: 10px;
  flex-shrink: 0;
  transition: color 0.2s;
}

.tree-toggle:hover {
  color: #fff;
}

.tree-toggle-spacer {
  width: 16px;
  flex-shrink: 0;
}

.tree-item-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.tree-item-details {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.tree-item-title {
  font-size: 12px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-item-type {
  font-size: 9px;
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: #888;
  white-space: nowrap;
  flex-shrink: 0;
}

.tree-item-inactive {
  font-size: 9px;
  padding: 1px 5px;
  background: rgba(239, 68, 68, 0.15);
  border-radius: 8px;
  color: #ef4444;
  white-space: nowrap;
  flex-shrink: 0;
}

.tree-item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-item:hover .tree-item-actions {
  opacity: 1;
}

.tree-action-btn {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: none;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
}

.tree-action-btn.add:hover {
  background: rgba(30, 239, 111, 0.1);
  border-color: rgba(30, 239, 111, 0.3);
  color: #1eef6f;
}

.tree-action-btn.delete:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.tree-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tree-children {
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  margin-left: 8px;
}

.deleting-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>