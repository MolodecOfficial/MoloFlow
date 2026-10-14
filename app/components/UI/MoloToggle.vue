<!-- components/ui/MoloToggle.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import MoloSticker from '~/components/ui/MoloSticker.vue'

const props = withDefaults(
    defineProps<{
      modelValue?: boolean
      label?: string
      tLabel?: string
      lRequired?: boolean
      trueLabel?: string
      falseLabel?: string
      disabled?: boolean
      compact?: boolean
    }>(),
    {
      modelValue: false,
      label: '',
      tLabel: '',
      lRequired: false,
      trueLabel: 'Выполнено (Да)',
      falseLabel: 'Не выполнено (Нет)',
      disabled: false,
      compact: false
    }
)

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  change: [val: boolean]
}>()

const isChecked = computed(() => Boolean(props.modelValue))

function toggle() {
  if (props.disabled) return
  const next = !isChecked.value
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <div class="molo-toggle-wrapper" :class="{ compact, disabled }">
    <label v-if="tLabel" class="top-label">
      {{ tLabel }}
      <span v-if="lRequired" class="required">*</span>
    </label>

    <div
        class="toggle-container"
        :class="{ active: isChecked }"
        tabindex="0"
        role="switch"
        :aria-checked="isChecked"
        @click="toggle"
        @keydown.space.prevent="toggle"
        @keydown.enter.prevent="toggle"
    >
      <div class="switch-capsule">
        <span class="switch-thumb">
          <MoloSticker
              :name="isChecked ? 'sigma' : 'x'"
              :size="8"
              :color="isChecked ? '#059669' : '#64748b'"
          />
        </span>
      </div>

      <div class="toggle-info">
        <span v-if="label" class="toggle-title">{{ label }}</span>
        <span class="toggle-status-text" :class="{ 'is-true': isChecked }">
          {{ isChecked ? trueLabel : falseLabel }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.molo-toggle-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  user-select: none;
}

.molo-toggle-wrapper.compact {
  gap: 0.1rem;
}

.top-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.molo-toggle-wrapper.compact .top-label {
  font-size: 11px;
  color: #8c8c9e;
}

.required {
  color: #ff4d4d;
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}



.toggle-container:focus-visible {
  border-color: var(--borber-color_main);
  box-shadow: 0 0 0 2px rgba(56, 114, 239, 0.2);
}

.switch-capsule {
  width: 32px;
  height: 16px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 16px;
  position: relative;
  transition: background 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.toggle-container.active .switch-capsule {
  background: #10b981;
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.toggle-container.active .switch-thumb {
  transform: translateX(16px);
}

.toggle-info {
  display: flex;
  flex: 1;
  min-width: 0;
  justify-content: space-between;
}

.toggle-title {
  font-size: 12.5px;
  color: #f1f5f9;
  font-weight: 500;
  line-height: 1.2;
}

.toggle-status-text {
  font-size: 9px;
  color: #94a3b8;
  transition: color 0.2s ease;
}


.disabled {
  opacity: 0.55;
  pointer-events: none;
}
</style>