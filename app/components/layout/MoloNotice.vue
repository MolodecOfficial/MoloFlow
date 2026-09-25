<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
    defineProps<{
      notice_type?: 'success' | 'error' | 'warning' | 'notice' | 'info' | string
      notice_title?: string
      notice_text?: string
      duration?: number
      index?: number
      total?: number
    }>(),
    {
      notice_type: 'notice',
      notice_title: '',
      notice_text: '',
      duration: 4000
    }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isClosing = ref(false)
const isPaused = ref(false)
const remainingTime = ref(props.duration)
let timerStartTime = 0
let timerTimeout: ReturnType<typeof setTimeout> | null = null

const meta = computed(() => {
  switch (props.notice_type) {
    case 'error':
      return {
        accent: '#fb7185', // мягкий розово-коралловый
        accentRgb: '251, 113, 133',
        badge: 'Ошибка'
      }
    case 'warning':
      return {
        accent: '#fbbf24', // мягкий янтарный
        accentRgb: '251, 191, 36',
        badge: 'Внимание'
      }
    case 'success':
      return {
        accent: '#34d399', // мягкий изумрудно-мятный
        accentRgb: '52, 211, 153',
        badge: 'Готово'
      }
    case 'notice':
    case 'info':
    default:
      return {
        accent: '#38bdf8', // чистый небесно-голубой
        accentRgb: '56, 189, 248',
        badge: 'Инфо'
      }
  }
})

const handleClose = () => {
  if (isClosing.value) return
  isClosing.value = true
  if (timerTimeout) clearTimeout(timerTimeout)
  setTimeout(() => {
    emit('close')
  }, 220)
}

const startTimer = () => {
  timerStartTime = Date.now()
  timerTimeout = setTimeout(() => {
    handleClose()
  }, remainingTime.value)
}

const pauseTimer = () => {
  isPaused.value = true
  if (timerTimeout) {
    clearTimeout(timerTimeout)
    remainingTime.value -= Date.now() - timerStartTime
  }
}

const resumeTimer = () => {
  isPaused.value = false
  if (remainingTime.value > 0) {
    startTimer()
  } else {
    handleClose()
  }
}

onMounted(() => {
  if (props.duration > 0) {
    startTimer()
  }
})

onUnmounted(() => {
  if (timerTimeout) clearTimeout(timerTimeout)
})
</script>

<template>
  <div
      class="liquid-notice-wrapper"
      :class="{ closing: isClosing }"
      @mouseenter="pauseTimer"
      @mouseleave="resumeTimer"
  >
    <div
        class="liquid-glass-card"
        :style="{
        '--notice-accent': meta.accent,
        '--notice-accent-rgb': meta.accentRgb,
        '--duration-ms': `${props.duration}ms`
      }"
    >
      <!-- Световой блик преломления жидкого стекла -->
      <div class="specular-highlight" />

      <div class="content-row">
        <!-- Тонкая векторная иконка -->
        <div class="liquid-icon-wrapper">
          <svg v-if="props.notice_type === 'success'" viewBox="0 0 24 24" class="svg-icon">
            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>

          <svg v-else-if="props.notice_type === 'error'" viewBox="0 0 24 24" class="svg-icon">
            <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>

          <svg v-else-if="props.notice_type === 'warning'" viewBox="0 0 24 24" class="svg-icon">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>

          <svg v-else viewBox="0 0 24 24" class="svg-icon">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 16v-4m0-4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>

        <!-- Текстовая колонка -->
        <div class="text-column">
          <div class="header-line">
            <span class="liquid-title">{{ props.notice_title }}</span>
          </div>
          <p class="liquid-text">{{ props.notice_text }}</p>
        </div>

        <!-- Кнопка закрытия -->
        <UIMoloButton class="small" @click.stop="handleClose" aria-label="Закрыть">
          <svg viewBox="0 0 16 16" width="12" height="12">
            <path d="M4 4l8 8M4 12L12 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </UIMoloButton>
      </div>

      <!-- Деликатный индикатор оставшегося времени -->
      <div v-if="props.duration > 0" class="progress-track">
        <div class="progress-bar" :class="{ paused: isPaused }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.liquid-notice-wrapper {
  position: relative;
  width: 380px;
  min-width: 380px;
  max-width: calc(100vw - 32px);
  user-select: none;
  animation: liquidIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.liquid-notice-wrapper.closing {
  animation: liquidOut 0.22s ease-in forwards;
}

@keyframes liquidIn {
  0% {
    transform: translateX(30px) scale(0.97);
    opacity: 0;
  }
  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
}

@keyframes liquidOut {
  0% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateX(40px) scale(0.95);
    opacity: 0;
  }
}

/* Эффект жидкого стекла */
.liquid-glass-card {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  /* Многослойное чистое стекло без глубокой серости */
  background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.08) 0%,
      rgba(255, 255, 255, 0.02) 100%
  ), rgba(13, 16, 23, 0.72);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  /* Тончайшая стеклянная кромка */
  border: 1px solid rgba(255, 255, 255, 0.12);
  /* Без тяжелых внешних теней — только внутренний рефлекс */

  transition: border-color 0.2s ease, transform 0.2s ease;
}

.liquid-glass-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

/* Зеркальная полоса преломления в верхней части */
.specular-highlight {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.3) 25%,
      rgba(255, 255, 255, 0.45) 50%,
      rgba(255, 255, 255, 0.3) 75%,
      transparent 100%
  );
  pointer-events: none;
}

.content-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  position: relative;
  z-index: 2;
}

/* Иконка в мягкой стеклянной капле */
.liquid-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(var(--half_opacity_bg), 0.1);
  border: 1px solid rgba(var(--notice-accent-rgb), 0.2);
  color: var(--notice-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.svg-icon {
  width: 17px;
  height: 17px;
}

.text-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.header-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.liquid-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #f3f4f6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.15px;
}

.liquid-text {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.42;
  word-break: break-word;
  max-height: 64px;
  overflow-y: auto;
}

/* Аккуратная стеклянная кнопка закрытия */
.liquid-close {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
  margin-top: -2px;
  margin-right: -4px;
}

.liquid-close:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.16);
}

.liquid-close:active {
  transform: scale(0.92);
}

/* Прогресс-бар */
.progress-track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.03);
}

.progress-bar {
  height: 100%;
  background: var(--notice-accent);
  opacity: 0.65;
  width: 100%;
  animation: drain var(--duration-ms) linear forwards;
}

.progress-bar.paused {
  animation-play-state: paused;
}

@keyframes drain {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

/* Адаптивность */
@media (max-width: 500px) {
  .liquid-notice-wrapper {
    width: calc(100vw - 32px);
    min-width: unset;
  }
  .content-row {
    padding: 12px 14px;
  }
}
</style>