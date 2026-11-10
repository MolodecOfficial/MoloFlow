<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'button' | 'submit' | 'reset'
  variant?: 'default' | 'confirm' | 'close' | 'small' | 'action' | 'pinned' | 'full' | 'fit' | 'transparent'
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
  event.stopPropagation()
  emit('click', event)
}

const handleMouseDown = (event: MouseEvent) => {
  event.stopPropagation()
}

// Поддерживаем как проп variant, так и классы из $attrs
const variantClass = computed(() => {
  return props.variant !== 'default' ? props.variant : ''
})
</script>

<template>
  <button
      :type="type"
      class="molo-btn"
      :class="[
      variantClass,
      {
        'is-loading': loading,
        'is-disabled': disabled
      }
    ]"
      :disabled="disabled || loading"
      draggable="false"
      @mousedown="handleMouseDown"
      @click="handleClick"
  >
    <!-- Световой блик стекла -->
    <span class="molo-btn__sheen" aria-hidden="true" />

    <!-- Спиннер загрузки -->
    <span v-if="loading" class="molo-btn__spinner">
      <slot name="loader">
       <UIMoloLoaders btn-loader/>
      </slot>
    </span>

    <!-- Контент -->
    <span class="molo-btn__content">
      <slot>{{ loading ? 'Загрузка...' : 'Кнопка' }}</slot>
    </span>
  </button>
</template>

<style scoped>
/* ==========================================================================
   БАЗОВАЯ СТРУКТУРА КНОПКИ (LIQUID GLASS CORE)
   ========================================================================== */
.molo-btn {
  --btn-glass-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.03) 100%);
  --btn-glass-border: rgba(255, 255, 255, 0.16);
  --btn-specular: rgba(255, 255, 255, 0.35);
  --btn-text-color: #f1f5f9;
  --btn-glow: rgba(255, 255, 255, 0.05);

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 18px;
  min-height: 36px;
  box-sizing: border-box;

  font-family: inherit;
  font-size: 13.5px;
  font-weight: 550;
  letter-spacing: 0.01em;
  color: var(--btn-text-color);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);

  background: var(--btn-glass-bg);
  border: 1px solid var(--btn-glass-border);
  border-radius: 7px;
  outline: none;
  cursor: pointer;
  user-select: none;
  overflow: hidden;

  /* Оптическое преломление стекла */
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);

  /* Призматический свет: верхняя фаска + мягкая подложка */
  box-shadow:
      inset 0 1px 0 0 var(--btn-specular),
      inset 0 -1px 0 0 rgba(0, 0, 0, 0.25),
      0 4px 14px -2px rgba(0, 0, 0, 0.3);

  transition:
      transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
      background 0.25s ease,
      border-color 0.25s ease,
      box-shadow 0.25s ease,
      opacity 0.2s ease;
}

/* Бегущий блик (каустическое скольжение света) */
.molo-btn__sheen {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
      105deg,
      transparent 20%,
      rgba(255, 255, 255, 0.14) 45%,
      rgba(255, 255, 255, 0.28) 50%,
      rgba(255, 255, 255, 0.14) 55%,
      transparent 80%
  );
  transform: translateX(-130%);
  transition: transform 0.65s cubic-bezier(0.19, 1, 0.22, 1);
  opacity: 0.7;
}

.molo-btn__content {
  display: flex;
  align-items: center;
  gap: 7px;
  z-index: 1;
}

/* ==========================================================================
   СОСТОЯНИЯ: HOVER & ACTIVE
   ========================================================================== */
.molo-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  --btn-glass-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%);
  --btn-glass-border: rgba(255, 255, 255, 0.28);
  --btn-specular: rgba(255, 255, 255, 0.55);

  box-shadow:
      inset 0 1px 0 0 var(--btn-specular),
      inset 0 0 16px 0 var(--btn-glow),
      0 6px 20px -2px rgba(0, 0, 0, 0.45);
}

.molo-btn:hover:not(:disabled) .molo-btn__sheen {
  transform: translateX(130%);
}

.molo-btn:active:not(:disabled) {
  transform: scale(0.975) translateY(1px);
  --btn-glass-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  --btn-glass-border: rgba(255, 255, 255, 0.18);
  --btn-specular: rgba(255, 255, 255, 0.2);

  box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.35),
      0 2px 6px rgba(0, 0, 0, 0.25);
  transition-duration: 0.06s;
}

/* ==========================================================================
   ВАРИАНТЫ КНОПОК
   ========================================================================== */

/* 1. Confirm / Primary (Лазурное неоновое стекло) */
.molo-btn.confirm {
  --btn-glass-bg: linear-gradient(180deg, rgba(56, 189, 248, 0.28) 0%, rgba(14, 116, 144, 0.2) 100%);
  --btn-glass-border: rgba(56, 189, 248, 0.45);
  --btn-specular: rgba(186, 230, 253, 0.65);
  --btn-glow: rgba(56, 189, 248, 0.25);
  --btn-text-color: #f0f9ff;
}

.molo-btn.confirm:hover:not(:disabled) {
  --btn-glass-bg: linear-gradient(180deg, rgba(56, 189, 248, 0.4) 0%, rgba(14, 116, 144, 0.3) 100%);
  --btn-glass-border: rgba(56, 189, 248, 0.7);

}

/* 2. Close / Danger (Рубиновое стекло) */
.molo-btn.close {
  --btn-glass-bg: linear-gradient(180deg, rgba(244, 63, 94, 0.28) 0%, rgba(159, 18, 57, 0.2) 100%);
  --btn-glass-border: rgba(251, 113, 133, 0.45);
  --btn-specular: rgba(254, 205, 211, 0.65);
  --btn-glow: rgba(244, 63, 94, 0.25);
  --btn-text-color: #fff1f2;
}

.molo-btn.close:hover:not(:disabled) {
  --btn-glass-bg: linear-gradient(180deg, rgba(244, 63, 94, 0.42) 0%, rgba(159, 18, 57, 0.32) 100%);
  --btn-glass-border: rgba(251, 113, 133, 0.7);
}

/* 3. Action / Toolbar (Минималистичное стекло для тулбаров) */
.molo-btn.action {
  --btn-glass-bg: rgba(255, 255, 255, 0.04);
  --btn-glass-border: rgba(255, 255, 255, 0.1);
  --btn-specular: rgba(255, 255, 255, 0.2);
  padding: 6px 12px;
}

.molo-btn.action:hover:not(:disabled) {
  --btn-glass-bg: rgba(255, 255, 255, 0.09);
  --btn-glass-border: rgba(255, 255, 255, 0.22);
}

/* 4. Small (Компактный режим) */
.molo-btn.small {
  padding: 4px 10px;
  min-height: 28px;
  font-size: 12px;
  border-radius: 5px;
}

/* 5. Утилитарные модификаторы */
.molo-btn.full { width: 100%; }
.molo-btn.fit { width: fit-content; }
.molo-btn.pinned {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 20;
}
.molo-btn.transparent {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  backdrop-filter: none;
  padding: 4px;
}

/* ==========================================================================
   DISABLED & LOADING
   ========================================================================== */
.molo-btn:disabled,
.molo-btn.is-disabled {
  opacity: 0.42;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
  pointer-events: none;
}

.molo-btn.is-loading {
  cursor: wait;
}

.molo-btn__spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.loader-circle {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==========================================================================
   ТАЧ-УСТРОЙСТВА
   ========================================================================== */
@media (hover: none) and (pointer: coarse) {
  .molo-btn {
    min-height: 42px;
  }
  .molo-btn.small {
    min-height: 34px;
  }
  .molo-btn:hover {
    transform: none;
    box-shadow: inset 0 1px 0 0 var(--btn-specular);
  }
  .molo-btn__sheen {
    display: none;
  }
}
</style>