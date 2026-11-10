<!-- app/components/directory/DirectoryResolutionModal.vue -->
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
  (e: 'select', item: DirectoryLookupItem, selectedValue?: string): void
}>()

const selectedId = ref<string | null>(null)
const selectedProp = ref<string | null>(null)

const handleConfirm = () => {
  const found = props.candidates.find((c) => c.id === selectedId.value)
  if (found) {
    emit('select', found, selectedProp.value || found.title)
    emit('update:modelValue', false)
  }
}

function selectCandidate(item: DirectoryLookupItem, propVal?: string) {
  selectedId.value = item.id
  selectedProp.value = propVal || null
}
</script>

<template>
  <UIMoloModal
      :model-value="modelValue"
      :title="title || 'Найдено несколько совпадений'"
      width="680px"
      confirm-text="Вставить значение"
      cancel-text="Отмена"
      @update:model-value="(val) => emit('update:modelValue', val)"
      @confirm="handleConfirm"
  >
    <template #body>
      <div class="resolution-container">
        <p class="resolution-subtitle">
          Выберите нужную запись. Вы можете вставить название целиком либо кликнуть на конкретный реквизит:
        </p>

        <div class="candidate-list">
          <div
              v-for="item in candidates"
              :key="item.id"
              class="candidate-card"
              :class="{ selected: selectedId === item.id }"
              @click="selectCandidate(item)"
              @dblclick="handleConfirm"
          >
            <div class="card-header-line">
              <div class="candidate-avatar">
                {{ (item.title || 'С')[0].toUpperCase() }}
              </div>

              <div class="candidate-meta">
                <strong class="candidate-name">{{ item.title }}</strong>
                <div class="candidate-sub">
                  <span v-if="item.role" class="badge-role">{{ item.role }}</span>
                  <span v-if="item.inn" class="code-tag">ИНН: {{ item.inn }}</span>
                  <span v-if="item.code" class="code-tag">Код: {{ item.code }}</span>
                  <span v-if="item.phone">📞 {{ item.phone }}</span>
                </div>
              </div>

              <div class="select-radio">
                <input
                    type="radio"
                    :checked="selectedId === item.id"
                    name="candidate_select"
                    @change="selectCandidate(item)"
                />
              </div>
            </div>

            <!-- Доступные реквизиты сущности для выборочной вставки -->
            <div class="entity-props-chips">
              <button
                  v-for="field in item.availableFields"
                  :key="field.key"
                  type="button"
                  class="chip-btn"
                  :class="{ active: selectedId === item.id && selectedProp === field.value }"
                  @click.stop="selectCandidate(item, field.value)"
              >
                <span class="chip-k">{{ field.label }}:</span>
                <span class="chip-v">{{ field.value }}</span>
              </button>
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
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

.candidate-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.candidate-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(100, 150, 255, 0.4);
}

.candidate-card.selected {
  background: rgba(100, 150, 255, 0.12);
  border-color: #6496ff;
}

.card-header-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.candidate-avatar {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #3872ef;
  color: #fff;
  font-size: 14px;
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
  font-size: 14px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.candidate-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
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

.entity-props-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 11px;
  color: #ccc;
  transition: all 0.1s ease;
}

.chip-btn:hover {
  background: rgba(100, 150, 255, 0.15);
  border-color: #6496ff;
  color: #fff;
}

.chip-btn.active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #fff;
}

.chip-k {
  color: #7b7b8f;
}

.chip-btn.active .chip-k {
  color: #bfdbfe;
}

.chip-v {
  font-weight: 500;
}
</style>