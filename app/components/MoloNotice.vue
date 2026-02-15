<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps({
  notice_type: String,
  notice_title: String,
  notice_text: String,
  index: { type: Number, default: 0 },
  total: { type: Number, default: 1 }
});

const emit = defineEmits(['close']);
const isClosing = ref(false);

const bottomOffset = computed(() => {
  const baseBottom = 30;
  const noticeHeight = 120;
  return baseBottom + (props.total - props.index - 1) * noticeHeight;
});

const handleClose = () => {
  isClosing.value = true;
  setTimeout(() => {
    emit('close');
  }, 300);
};
</script>

<template>
  <section
      class="main-notice"
      :style="{ bottom: `${bottomOffset}px` }"
      :data-type="notice_type"
      :class="{ closing: isClosing }"
  >
    <section class="notice">
      <img
          :src="notice_type === 'error' ? '/error.svg' : notice_type === 'danger' ? '/danger.svg' : '/notice.svg'"
          alt=""
          class="notice-img"
      >
      <section class="notice-block">
        <span class="notice-title"> {{ notice_title }} </span>
        <span class="notice-text"> {{ notice_text }} </span>
      </section>
      <button class="close" @click="handleClose" aria-label="Закрыть уведомление">×</button>
    </section>
  </section>
</template>

<style scoped>

.main-notice {
  z-index: 1000;
  position: fixed;
  display: flex;
  right: 25px;
  width: 400px;
  min-width: 400px;
  background: rgba(45, 45, 45, 0.39);
  transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),
  opacity 0.5s ease-out,
  bottom 0.3s ease-out;
  animation: slideInRight 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
  transform: translateX(100%);
  opacity: 0;
}

@keyframes slideInRight {
  0% {
    transform: translateX(10%);
    opacity: 0;
  }

  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

.main-notice.closing {
  animation: slideOutRight 0.3s ease-out forwards;
}

@keyframes slideOutRight {
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(100%);
    opacity: 0;
  }
}

.notice {
  display: flex;
  border: 1px solid transparent;
  border-left-color: var(--half_opacity_right-border);
  border-bottom-color: var(--half_opacity_right-border);
  align-items: center;
  border-bottom-left-radius: 10px;
  background-color: var(--half_opacity_bg);
  padding: 8px 12px;
  gap: 15px;
  flex-shrink: 0;
  width: 100%;
  backdrop-filter: blur(10px);
  position: relative;

  & .notice-img {
    width: 80px;
    min-width: 80px;
  }

  & .notice-block {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    width: 100%;
    flex: 1;
  }

  & .notice-title {
    color: white;
    font-size: 18px;
    white-space: nowrap;
  }

  & .notice-text {
    color: white;
    font-size: 14px;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
}

.close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 0.7;
  padding: 0;
  line-height: 1;
}

.close:hover {
  background: rgba(255, 255, 255, 0.2);
  opacity: 1;
  transform: scale(1.1);
}

.close:active {
  transform: scale(0.95);
}

.main-notice:hover .close {
  opacity: 0.7;
}

/* Стили для разных типов уведомлений */
.main-notice[data-type="notice"] .notice {
  border-left-color: #2196F3;
  border-bottom-color: #2196F3;
}

.main-notice[data-type="danger"] .notice {
  border-left-color: #FF9800;
  border-bottom-color: #FF9800;

}

.main-notice[data-type="error"] .notice {
  border-left-color: #F44336;
  border-bottom-color: #F44336;

}

.main-notice[data-type="notice"] .close:hover {
  background: rgba(33, 150, 243, 0.5);
}

.main-notice[data-type="danger"] .close:hover {
  background: rgba(255, 234, 0, 0.5);
}

.main-notice[data-type="error"] .close:hover {
  background: rgba(244, 67, 54, 0.5);
}

/* Адаптивность */
@media (max-width: 500px) {
  .main-notice {
    width: 95%;
    min-width: unset;
    right: 2.5%;
  }

  .close {
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    font-size: 16px;
  }
}
</style>