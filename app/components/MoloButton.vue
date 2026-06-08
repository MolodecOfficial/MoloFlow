<script setup lang="ts">
interface Props {
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'default',
  disabled: false,
  loading: false,
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
      class="molo-btn"
      :class="{
        'confirm': $attrs.variant === 'confirm',
        'close': $attrs.variant === 'close',
        'small': $attrs.variant === 'small',
        'action': $attrs.variant === 'action',
      }"
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
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--half_opacity_border);
  color: white;
  position: relative;
  overflow: hidden;
  transform: translateY(0);
}

/* Эффект нажатия - масштабирование */
.molo-btn:active {
  transform: scale(0.96);
}

/* Убираем масштабирование при disabled или loading */
.molo-btn:disabled:active,
.molo-btn.loading:active {
  transform: scale(1);
  cursor: wait;
}
.molo-btn:disabled {
  cursor: wait;
}

/* Ripple эффект при клике - улучшенный */
.molo-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%);
  transform: translate(-50%, -50%);
  transition: width 0.4s ease-out, height 0.4s ease-out;
  pointer-events: none;
}

.molo-btn:active::before {
  width: 200%;
  height: 200%;
}

/* Альтернативный эффект нажатия с тенью */
.molo-btn:hover {
  background: var(--half_opacity_border_hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.molo-btn:active {
  transform: translateY(1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.molo-btn.small {
  padding: 4px 12px;
}

.molo-btn.action {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.molo-btn.confirm {
  background: var(--borber-color_main);
  color: #020b18;
  border: 1px solid transparent;
  &:hover {
    border: 1px solid var(--borber-color_main);
    background: var(--border-color_hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--borber-color_main), 0.3);
  }
  &:active {
    transform: translateY(1px);
    box-shadow: 0 2px 6px rgba(var(--borber-color_main), 0.2);
  }
  &:disabled {
    background: var(--border-color_disabled);
    transform: translateY(0);
    box-shadow: none;
  }
}

.molo-btn.close {
  background: #e04141;
  color: white;
  border: 1px solid transparent;
  &:hover {
    background: #a61616;
    transform: translateY(-1px);
    border: 1px solid red;
  }
  &:active {
    transform: translateY(1px);
  }
  &:disabled {
    background: #600f0f;
    transform: translateY(0);
    box-shadow: none;
  }
}


.molo-btn__spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.molo-btn.confirm:hover:not(:disabled) {
  animation: pulse 0.5s ease-out;
}

/* Сглаживание для всех переходов */
.molo-btn * {
  pointer-events: none;
}
</style>