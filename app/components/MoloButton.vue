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
        'full': $attrs.variant === 'full',
        'fit': $attrs.variant === 'fit',
        'transparent': $attrs.variant === 'transparent'
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
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 18px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, .18);
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, .12) 0%,
      rgba(255, 255, 255, .04) 100%
  );
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35),
  inset 0 -1px 0 rgba(255, 255, 255, .05),
  0 10px 30px rgba(0, 0, 0, .15);
  transition: transform .25s ease,
  box-shadow .25s ease,
  border-color .25s ease,
  background .25s ease;
}

.molo-btn::before {
  backdrop-filter:
      blur(24px)
      saturate(200%)
      contrast(110%);
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, .35) 0%,
      rgba(255, 255, 255, .12) 20%,
      transparent 55%
  );
  pointer-events: none;
}

.molo-btn::after {
  content: '';
  position: absolute;
  width: 180%;
  height: 180%;
  left: -140%;
  top: -40%;
  background: radial-gradient(
      circle,
      rgba(255, 255, 255, .25) 0%,
      rgba(255, 255, 255, .08) 25%,
      transparent 65%
  );
  transition: left .7s cubic-bezier(.2, .8, .2, 1);
  pointer-events: none;
}

.molo-btn:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, .3);
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, .16),
      rgba(255, 255, 255, .06)
  );
  box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .45),
      inset 0 -1px 0 rgba(255, 255, 255, .08),
      0 16px 40px rgba(0, 0, 0, .22);
  animation: liquidBorder 2s infinite;

}


@keyframes liquidBorder {
  0% {
    border-color: rgba(255,255,255,.15);
  }
  50% {
    border-color: rgba(255,255,255,.35);
  }
  100% {
    border-color: rgba(255,255,255,.15);
  }
}

.molo-btn:hover::after {
  left: 100%;
}

.molo-btn:active {
  transform: scale(.97);
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
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 100%);
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

.molo-btn.full {
  width: 100%;
}

.molo-btn.fit {
  width: fit-content;
}

.molo-btn.transparent {
  background: transparent;
  border: 1px solid rgba(30, 30, 30, 0.1);
  padding: 0;

  &:hover {
    border: transparent;
    background: rgba(224, 224, 224, 0.09);
  }
}


.molo-btn.action {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 10px;

  &:hover {
    border: 1px solid #b9b9b9;
  }

  &:disabled {
    background: rgba(117, 117, 117, 0.58);

    &:hover {
      border: 1px solid red;
      cursor: not-allowed;
    }
  }
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
  to {
    transform: rotate(360deg);
  }
}

.molo-btn.confirm:hover:not(:disabled) {
  animation: pulse 0.5s ease-out;
}

.molo-btn * {
  pointer-events: none;
}
</style>