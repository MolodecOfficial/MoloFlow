<script setup lang="ts">
const props = defineProps<{
  notice_type?: String,
  notice_title?: String,
  notice_text?: String,
  index?: { type: Number, default: 0 },
  total?: { type: Number, default: 1 }
}>()

const emit = defineEmits(['close']);
const isClosing = ref(false);

const handleClose = () => {
  isClosing.value = true;
  setTimeout(() => {
    emit('close');
  }, 300);
};


// Остальные computed
const getIcon = computed(() => {
  switch(props.notice_type) {
    case 'error':
      return '/error.svg';
    case 'danger':
      return '/danger.svg';
    case 'notice':
      return '/notice.svg';
    default:
      return '/notice.svg';
  }
});

const getAccentColor = computed(() => {
  switch(props.notice_type) {
    case 'error':
      return '#F44336';
    case 'danger':
      return '#FF9800';
    case 'notice':
      return '#2196F3';
    default:
      return '#2196F3';
  }
});


</script>

<template>
  <section
      ref="noticeRef"
      class="main-notice"
      :data-type="props.notice_type"
      :class="{ closing: isClosing }"
  >
    <section
        class="notice"
        :style="{
        borderLeftColor: getAccentColor,
      }"
    >
      <!-- Декоративная полоска слева -->
      <div class="accent-bar" :style="{ backgroundColor: getAccentColor }"></div>

      <!-- Иконка -->
      <div class="icon-wrapper" :style="{ backgroundColor: `${getAccentColor}20` }">
        <img :src="getIcon" alt="" class="notice-img" />
      </div>

      <!-- Контент -->
      <section class="notice-block">
        <span class="notice-title" :style="{ color: getAccentColor }">{{ props.notice_title }}</span>
        <span class="notice-text">{{ props.notice_text }}</span>
      </section>

      <!-- Кнопка закрытия -->
      <button class="close" @click="handleClose" aria-label="Закрыть уведомление">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </section>
  </section>
</template>


<style scoped>
.main-notice {
  z-index: 1000;
  gap: 10px;
  width: 380px;
  min-width: 380px;
  transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
  transform: translateX(100%);
  opacity: 0;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.2));

}

.main-notice:first-child .notice {
  border-radius: 0px 0px 15px 15px;
}

/* Первое уведомление */
.main-notice:last-child .notice {
  border-radius: 15px 15px 0px 0px;
}

@keyframes slideInRight {
  0% {
    transform: translateX(100%) scale(0.9);
    opacity: 0;
  }
  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
}

.main-notice.closing {
  animation: slideOutRight 0.3s ease-out forwards;
}

@keyframes slideOutRight {
  0% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateX(100%) scale(0.9);
    opacity: 0;
  }
}

.notice {
  display: flex;
  align-items: center;
  background: rgb(28, 28, 28);
  backdrop-filter: blur(10px);
  padding: 16px;
  gap: 16px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: 0.1s all ease-in-out;
}

.accent-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 4px 0 0 4px;
}

.icon-wrapper {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notice-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.notice-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.notice-title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.3px;
}

.notice-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-height: 60px;
  overflow-y: auto;
}

.close {
  width: 28px;
  height: 28px;
  min-width: 28px;
  border: 1px solid var(--half_opacity_border);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
  margin-left: 4px;
  flex-shrink: 0;
}

.close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.close:active {
  transform: scale(0.95);
}

.notice:hover {
  transform: translateX(-2px);
  border-color: rgba(255, 255, 255, 0.15);
}

/* Адаптивность */
@media (max-width: 500px) {
  .main-notice {
    width: calc(100% - 40px);
    min-width: unset;
    right: 20px;
    left: 20px;
  }

  .notice {
    padding: 14px;
  }

  .icon-wrapper {
    width: 40px;
    height: 40px;
    min-width: 40px;
  }

  .notice-img {
    width: 24px;
    height: 24px;
  }

  .notice-title {
    font-size: 15px;
  }

  .notice-text {
    font-size: 12px;
  }

  .close {
    width: 24px;
    height: 24px;
    min-width: 24px;
  }
}
</style>