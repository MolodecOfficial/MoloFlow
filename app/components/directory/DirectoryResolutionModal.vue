<script setup lang="ts">
import { ref } from 'vue'
import type { DirectoryLookupItem } from '~/composables/useDirectoryInterpolator'

const props = defineProps<{
  modelValue: boolean
  title?: string
  candidates: DirectoryLookupItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', item: DirectoryLookupItem): void
}>()

const selectedId = ref<string | null>(null)

const handleConfirm = () => {
  const found = props.candidates.find((c) => c.id === selectedId.value)
  if (found) {
    emit('select', found)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <UIMoloModal
      :model-value="modelValue"
      :title="title || 'Найдено несколько вариантов'"
      width="540px"
      confirm-text="Вставить"
      cancel-text="Отмена"
      @update:model-value="(val) => emit('update:modelValue', val)"
      @confirm="handleConfirm"
  >
    <template #body>
      <div class="resolution-container">
        <p class="resolution-subtitle">
          По вашему запросу найдено несколько записей. Выберите нужную для подстановки:
        </p>

        <div class="candidate-list">
          <div
              v-for="item in candidates"
              :key="item.id"
              class="candidate-row"
              :class="{ selected: selectedId === item.id }"
              @click="selectedId = item.id"
              @dblclick="handleConfirm"
          >
            <div class="candidate-avatar">
              {{ (item.title || 'С')[0].toUpperCase() }}
            </div>

            <div class="candidate-meta">
              <strong class="candidate-name">{{ item.title }}</strong>
              <div class="candidate-sub">
                <span v-if="item.role" class="badge-role">{{ item.role }}</span>
                <span v-if="item.phone">📞 {{ item.phone }}</span>
                <span v-if="item.code" class="code-tag">ID: {{ item.code }}</span>
              </div>
            </div>

            <div class="select-radio">
              <input
                  type="radio"
                  :checked="selectedId === item.id"
                  name="candidate_select"
                  @change="selectedId = item.id"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UIMoloModal>
</template>

<style scoped>
.resolution-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.resolution-subtitle {
  font-size: 13px;
  color: #8c8c9e;
  margin: 0;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.candidate-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.candidate-row:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(100, 150, 255, 0.4);
}

.candidate-row.selected {
  background: rgba(100, 150, 255, 0.14);
  border-color: #6496ff;
}

.candidate-avatar {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: #3872ef;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.candidate-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.candidate-name {
  font-size: 13.5px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.candidate-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #8c8c9e;
}

.badge-role {
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #8fb1ff;
}

.code-tag {
  font-family: monospace;
  color: #aaa;
}

.select-radio input {
  cursor: pointer;
}
</style>