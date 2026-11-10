<!-- components/MoloModal.vue -->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean         // v-model: видимость модалки
  title?: string              // заголовок
  width?: string | number     // ширина (500px, 30rem...)
  hideCancel?: boolean        // скрыть кнопку "Отмена"
  confirmText?: string        // текст на кнопке подтверждения
  cancelText?: string         // текст на кнопке отмены
  closeOnOverlay?: boolean    // закрытие по клику на фон
  modalText?: string          // текст для модалки
  helpText?: boolean | string // текст для подсказок и помощи
  loading?: boolean           // состояние загрузки
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []               // нажали подтвердить
  'cancel': []                // нажали отмена / крестик / overlay
}>()

const { addLog } = useLogger('Модальное окно')
const { addNotification } = useNotifications('Модальное окно')

const isOpen = ref(false)
const internalLoading = ref(false)

// Внешний или внутренний loading
const isLoading = computed(() => props.loading || internalLoading.value)

watch(() => props.modelValue, async (val) => {
  if (val) {
    isOpen.value = true
    await nextTick()
  } else {
    isOpen.value = false
    internalLoading.value = false
  }
}, { immediate: true })

const close = () => {
  if (isLoading.value) return // Не даём закрыть во время загрузки
  emit('update:modelValue', false)
  emit('cancel')
}

const confirm = async () => {
  if (isLoading.value) return // Не даём повторно нажать

  addLog('info', `Подтверждение действия в модальном окне: ${props.title || 'Без названия'}`)

  // Включаем внутреннюю загрузку, если нет внешней
  if (!props.loading) {
    internalLoading.value = true
  }
  addLog('info', `Выполняю действие...`)

  try {
    const result = emit('confirm')
    if (result && typeof result === 'object' && 'then' in result) {
      await result
    }
    addLog('success', 'Действие успешно выполнено')
  } catch (error: any) {
    addLog('error', `Ошибка: ${error.message || 'Неизвестная ошибка'}`)
    addNotification('error', error.message || 'Ошибка при выполнении действия')
    internalLoading.value = false
    return
  } finally {
    if (!props.loading) {
      internalLoading.value = false
    }
  }

  // Закрываем только после успешного выполнения
  emit('update:modelValue', false)
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay && !isLoading.value) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="handleOverlayClick">
        <div
            class="modal-container"
            :style="{ width: typeof width === 'number' ? width + 'px' : width || '480px' }"
        >
          <!-- Шапка -->
          <div class="modal-header">
            <h3>{{ title || 'Подтверждение' }}</h3>
            <div class="btn-group">
              <slot name="header">
                <UIMoloButton
                    v-if="!hideCancel"
                    class="close small"
                    :disabled="isLoading"
                    @click="close"
                >
                  {{ cancelText || 'Отмена' }}
                </UIMoloButton>
                <UIMoloButton
                    class="confirm small"
                    :disabled="isLoading"
                    @click="confirm"
                >
                  <UIMoloLoaders v-if="isLoading" btnLoader />
                  <span v-else>{{ confirmText || 'Подтвердить' }}</span>
                </UIMoloButton>
              </slot>
            </div>
          </div>

          <!-- Контент -->
          <div class="modal-body">
            <slot name="body">
              <p class="modal-text">{{ modalText }}</p>
            </slot>
          </div>

          <!-- Подвал (футер внутри контейнера окна) -->
          <div v-if="$slots.footer" class="modal-footer">
            <slot
                name="footer"
                :close="close"
                :confirm="confirm"
                :is-loading="isLoading"
            />
          </div>
        </div>

        <!-- Подсказка под модальным окном -->
        <div
            v-if="helpText"
            class="help-overlay"
            :style="{ width: typeof width === 'number' ? width + 'px' : width || '480px' }"
        >
          <slot name="help">
            <p class="help-text">{{ helpText }}</p>
          </slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.45);
}

.modal-container {
  background: #1e1e1e;
  border: 1px solid var(--half_opacity_border, #2a2a3a);
  backdrop-filter: blur(4px);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  max-width: 90vw;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--half_opacity_border, #2a2a3a);
  flex-shrink: 0;
}

.modal-header h3 {
  color: #ffffff;
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-text {
  color: #e2e8f0;
  margin: 0;
  line-height: 1.5;
}

/* Футер окна */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--half_opacity_border, #2a2a3a);
  background: rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.help-overlay {
  border: 1px solid var(--half_opacity_border, #2a2a3a);
  padding: 14px 18px;
  border-radius: 10px;
  background: var(--half_opacity_bg, rgba(20, 20, 28, 0.7));
  box-sizing: border-box;
}

.help-text {
  color: #dadada;
  text-decoration: underline 1px dotted;
  text-underline-offset: 4px;
  white-space: pre-line;
  margin: 0;
  font-size: 13px;
}

/* Анимации */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.modal-fade-enter-from .modal-container {
  transform: scale(0.96) translateY(-10px);
}

.modal-fade-leave-to .modal-container {
  transform: scale(0.96) translateY(10px);
}

/* ========================================
   АДАПТИВНОСТЬ
======================================== */
@media (max-width: 600px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .modal-container {
    width: 100% !important;
    max-width: 100vw;
    max-height: 92vh;
    border-radius: 16px 16px 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .modal-header {
    padding: 14px 16px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .modal-header h3 {
    font-size: 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-footer {
    padding: 12px 16px;
    flex-wrap: wrap;
    justify-content: stretch;
  }

  .modal-footer :deep(.molo-btn) {
    flex: 1;
  }

  .help-overlay {
    width: 100% !important;
    max-width: 100vw;
    padding: 14px;
    border-radius: 0;
  }

  .modal-fade-enter-from .modal-container,
  .modal-fade-leave-to .modal-container {
    transform: translateY(30px);
  }
}
</style>