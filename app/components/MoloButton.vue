<script setup lang="ts">
interface Props {
  // Тип кнопки
  type?: 'button' | 'submit' | 'reset'
  // Вариант стиля
  variant?: 'confirm' | 'default' | 'close'

  // Состояния
  disabled?: boolean
  loading?: boolean

  // Размер
  size?: 'small' | 'medium' | 'large'

  // Полная ширина
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'default',
  disabled: false,
  loading: false,
  size: 'medium',
  block: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<template>
  <button
      :type="type"
      class="molo-btn"
      :disabled="disabled || loading"
      @click="handleClick"
  >
    <!-- Спиннер при загрузке -->
    <span v-if="loading" class="molo-btn__spinner"></span>

    <!-- Слот для содержимого -->
    <slot>{{ loading ? 'Загрузка...' : 'Кнопка' }}</slot>
  </button>
</template>

<style scoped>

.molo-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  background: var(--half_opacity_border);
  color: white;
  &:hover {
    background: var(--half_opacity_border_hover);
  }
  &:disabled {
    background: var(--half_opacity_border_disabled);
    cursor: not-allowed;
  }
}

.molo-btn.confirm {
  background: var(--borber-color_main);
  color: #020b18;
  &:hover {
    background: var(--border-color_hover);
  }
  &:disabled {
    background: var(--border-color_disabled);
  }
}

.molo-btn.close {
  background: #ef1e1e;
  color: white;
  &:hover {
    background: #a61616;
  }
  &:disabled {
    background: #600f0f;
  }
}

/* Ripple эффект при клике */
.molo-btn {
  position: relative;
  overflow: hidden;
}

.molo-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(24, 24, 24, 0.21);
  transform: translate(-50%, -50%);
  transition: width 0.3s, height 0.3s;
}

.molo-btn:active::after {
  width: 100%;
  height: 100%;
  padding-top: 100%;
}
</style>