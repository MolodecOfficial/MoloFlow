<script setup lang="ts">
import {
  windowThemes,
  type WindowTheme,
  type WindowButtonStyle,
  windowButtonStyles,
  windowTitleStyles,
  type WindowTitleStyle,
  THEME_STORAGE_KEY,
  BUTTON_STYLE_STORAGE_KEY,
  TITLE_STYLE_STORAGE_KEY
} from '~~/types/window-themes'

const selectedTheme = ref<WindowTheme>(windowThemes[0])
const selectedButtonStyle = ref<WindowButtonStyle>(windowButtonStyles[0])
const selectedTitleStyle = ref<WindowTitleStyle>(windowTitleStyles[0])

onMounted(() => {
  // Загрузка темы
  const savedThemeId = localStorage.getItem(THEME_STORAGE_KEY)
  if (savedThemeId) {
    const theme = windowThemes.find(t => t.id === savedThemeId)
    if (theme) {
      selectedTheme.value = theme
      applyTheme(theme)
    }
  }

  // Загрузка стиля кнопок
  const savedButtonId = localStorage.getItem(BUTTON_STYLE_STORAGE_KEY)
  if (savedButtonId) {
    const buttonStyle = windowButtonStyles.find(b => b.id === savedButtonId)
    if (buttonStyle) {
      selectedButtonStyle.value = buttonStyle
      applyButtonStyle(buttonStyle)
    }
  }

  // Загрузка стиля заголовка
  const savedTitleId = localStorage.getItem(TITLE_STYLE_STORAGE_KEY)
  if (savedTitleId) {
    const titleStyle = windowTitleStyles.find(t => t.id === savedTitleId)
    if (titleStyle) {
      selectedTitleStyle.value = titleStyle
      applyTitleStyle(titleStyle)
    }
  }
})

const applyTheme = (theme: WindowTheme) => {
  localStorage.setItem(THEME_STORAGE_KEY, theme.id)
  Object.entries(theme.styles).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--window-${key}`, value)
  })
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }))
}

const applyButtonStyle = (buttonStyle: WindowButtonStyle) => {
  localStorage.setItem(BUTTON_STYLE_STORAGE_KEY, buttonStyle.id)
  Object.entries(buttonStyle.styles).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--button-${key}`, value)
  })
  window.dispatchEvent(new CustomEvent('button-style-changed', { detail: buttonStyle }))
}

const applyTitleStyle = (titleStyle: WindowTitleStyle) => {
  localStorage.setItem(TITLE_STYLE_STORAGE_KEY, titleStyle.id)
  window.dispatchEvent(new CustomEvent('title-style-changed', { detail: titleStyle }))
}

const selectTheme = (theme: WindowTheme) => {
  selectedTheme.value = theme
  applyTheme(theme)
}
const selectButtonStyle = (buttonStyle: WindowButtonStyle) => {
  selectedButtonStyle.value = buttonStyle
  applyButtonStyle(buttonStyle)
}
const selectTitleStyle = (titleStyle: WindowTitleStyle) => {
  selectedTitleStyle.value = titleStyle
  applyTitleStyle(titleStyle)
}

const previewStyle = computed(() => {
  const theme = selectedTheme.value
  const buttonStyle = selectedButtonStyle.value
  return {
    '--preview-header-bg': theme.styles.headerBg,
    '--preview-header-border': theme.styles.headerBorder,
    '--preview-header-text': theme.styles.headerText,
    '--preview-content-bg': theme.styles.contentBg,
    '--preview-content-text': theme.styles.contentText,
    '--preview-border': theme.styles.borderColor,
    '--preview-radius': theme.styles.borderRadius,
    '--preview-blur': theme.styles.backdropBlur,
    '--preview-accent': theme.styles.accentColor,
    '--preview-controls-border': buttonStyle.styles.controlsBorder,
    '--preview-button-border': buttonStyle.styles.buttonBorder,
    '--preview-button-bg': buttonStyle.styles.buttonBg,
    '--preview-button-hover-bg': buttonStyle.styles.buttonHoverBg,
    '--preview-button-text': buttonStyle.styles.buttonTextColor,
    '--preview-button-hover-text': buttonStyle.styles.buttonHoverTextColor || buttonStyle.styles.buttonTextColor,
    '--preview-controls-gap': buttonStyle.styles.controlsGap,
    '--preview-controls-padding': buttonStyle.styles.controlsPadding
  }
})
</script>

<template>
  <div class="customisation-container">
    <h2>Настройте Ваше приложение под себя</h2>
    <hr>

    <div class="info-message">
      <span>На данный момент доступен небольшой набор кастомизации. Больше возможностей будет по мере выхода обновлений</span>
    </div>

    <div class="content-wrapper">
      <div class="left-column">
        <!-- Тема оформления -->
        <div class="themes-section">
          <h3>Тема оформления окон</h3>
          <div class="themes-grid">
            <div
                v-for="theme in windowThemes"
                :key="theme.id"
                class="theme-card"
                :class="{ active: selectedTheme.id === theme.id }"
                @click="selectTheme(theme)"
            >
              <div class="theme-preview" :style="{ backgroundColor: theme.previewColor }">
                <div class="preview-header">
                  <div class="preview-dots">
                    <span class="dot green"></span>
                    <span class="dot yellow"></span>
                    <span class="dot blue"></span>
                    <span class="dot red"></span>
                  </div>
                </div>
                <div class="preview-content"></div>
              </div>
              <div class="theme-info">
                <h4>{{ theme.name }}</h4>
                <p>{{ theme.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Стиль кнопок -->
        <div class="buttons-section">
          <h3>Стиль кнопок окна</h3>
          <div class="buttons-grid">
            <div
                v-for="buttonStyle in windowButtonStyles"
                :key="buttonStyle.id"
                class="button-card"
                :class="{ active: selectedButtonStyle.id === buttonStyle.id }"
                @click="selectButtonStyle(buttonStyle)"
            >
              <div class="button-preview">
                <div class="preview-controls" :style="{
                  gap: buttonStyle.styles.controlsGap,
                  padding: buttonStyle.styles.controlsPadding,
                  border: buttonStyle.styles.controlsBorder
                }">
                  <span class="preview-btn" :style="{
                    border: buttonStyle.styles.buttonBorder,
                    background: buttonStyle.styles.buttonBg,
                    color: buttonStyle.styles.buttonTextColor
                  }">_</span>
                  <span class="preview-btn" :style="{
                    border: buttonStyle.styles.buttonBorder,
                    background: buttonStyle.styles.buttonBg,
                    color: buttonStyle.styles.buttonTextColor
                  }">⛶</span>
                  <span class="preview-btn" :style="{
                    border: buttonStyle.styles.buttonBorder,
                    background: buttonStyle.styles.buttonBg,
                    color: buttonStyle.styles.buttonTextColor
                  }">×</span>
                </div>
              </div>
              <div class="button-info">
                <h4>{{ buttonStyle.name }}</h4>
                <p>{{ buttonStyle.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="title-section">
          <h3>Отображение заголовка</h3>
          <div class="title-options">
            <div
                v-for="titleStyle in windowTitleStyles"
                :key="titleStyle.id"
                class="title-card"
                :class="{ active: selectedTitleStyle.id === titleStyle.id }"
                @click="selectTitleStyle(titleStyle)"
            >
              <h4>{{ titleStyle.name }}</h4>
              <p>{{ titleStyle.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Предпросмотр -->
      <div class="preview-section">
        <h3>Предпросмотр</h3>
        <div class="demo-window" :style="previewStyle">
          <div class="demo-header">
            <span class="demo-title">
              {{ selectedTitleStyle.isFullTitle ? 'Полный заголовок → Пример' : 'Пример окна' }}
            </span>
            <div class="demo-controls" :style="{
              gap: 'var(--preview-controls-gap)',
              padding: 'var(--preview-controls-padding)',
              border: 'var(--preview-controls-border)'
            }">
              <span class="demo-btn" :style="{
                border: 'var(--preview-button-border)',
                background: 'var(--preview-button-bg)',
                color: 'var(--preview-button-text)'
              }">_</span>
              <span class="demo-btn" :style="{
                border: 'var(--preview-button-border)',
                background: 'var(--preview-button-bg)',
                color: 'var(--preview-button-text)'
              }">⛶</span>
              <span class="demo-btn" :style="{
                border: 'var(--preview-button-border)',
                background: 'var(--preview-button-bg)',
                color: 'var(--preview-button-text)'
              }">×</span>
            </div>
          </div>
          <div class="demo-content">
            <p>Так будет выглядеть ваше окно</p>
            <p>Текст и элементы интерфейса</p>
            <button class="demo-accent-btn">Кнопка</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.customisation-container {
  display: flex;
  flex-direction: column;
  gap: 25px;
  color: white;
}

h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: white;
}

h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

hr {
  width: 100%;
  border: none;
  border-top: 1px solid var(--half_opacity_border);
  margin: 10px 0;
}

.info-message {
  padding: 15px;
  background: rgba(30, 239, 111, 0.1);
  border: 1px solid rgba(30, 239, 111, 0.2);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  line-height: 1.5;
}

.content-wrapper {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 30px;
  align-items: start;
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.themes-grid,
.buttons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.theme-card,
.button-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-card:hover,
.button-card:hover,
.title-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(30, 114, 239, 0.3);
}

.theme-card.active,
.button-card.active,
.title-card.active {
  border-color: #2196F3;
  background: rgba(30, 96, 239, 0.05);
}

.theme-preview {
  height: 80px;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.button-preview {
  height: 40px;
  border-radius: 8px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
}

.preview-controls {
  display: flex;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
}

.preview-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border-radius: 4px;
  transition: all 0.2s;
}

.preview-header {
  height: 20px;
  background: inherit;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.preview-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.green { background: #56ff5e; }
.dot.red { background: #ff5f56; }
.dot.blue { background: #2e69ff; }
.dot.yellow { background: #c9c627; }

.preview-content {
  flex: 1;
  background: inherit;
  opacity: 0.7;
}

.theme-info h4,
.button-info h4 {
  margin: 0 0 3px 0;
  font-size: 14px;
  font-weight: 500;
  color: white;
}

.theme-info p,
.button-info p {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.3;
}

.title-section {
  display: flex;
  flex-direction: column;
}

.title-options {
  display: flex;
  gap: 15px;
}

.title-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.title-card h4 {
  margin: 0 0 8px 0;
  color: white;
  font-size: 16px;
}

.title-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  line-height: 1.4;
}

.preview-section {
  position: sticky;
  top: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 20px;
}

.demo-window {
  width: 100%;
  border-radius: v-bind('previewStyle["--preview-radius"]');
  background: v-bind('previewStyle["--preview-content-bg"]');
  border: 1px solid v-bind('previewStyle["--preview-border"]');
  backdrop-filter: v-bind('previewStyle["--preview-blur"]');
  overflow: hidden;
  transition: all 0.3s ease;
}

.demo-header {
  padding: 10px 15px;
  background: v-bind('previewStyle["--preview-header-bg"]');
  border-bottom: 1px solid v-bind('previewStyle["--preview-header-border"]');
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: v-bind('previewStyle["--preview-header-text"]');
}

.demo-title {
  font-size: 14px;
  font-weight: 500;
}

.demo-controls {
  display: flex;
  border-radius: 6px;
}

.demo-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border-radius: 4px;
  transition: all 0.2s;
  cursor: default;
  text-align: center;
}

.demo-btn:hover {
  background: v-bind('previewStyle["--preview-button-hover-bg"]');
  color: v-bind('previewStyle["--preview-button-hover-text"]');
}

.demo-content {
  padding: 20px;
  color: v-bind('previewStyle["--preview-content-text"]');
  font-size: 14px;
}

.demo-content p {
  margin: 0 0 10px 0;
}

.demo-accent-btn {
  background: v-bind('previewStyle["--preview-accent"]');
  color: #020b18;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 10px;
}



.demo-accent-btn:hover {
  filter: brightness(1.1);
}

@media (max-width: 768px) {
  .content-wrapper {
    grid-template-columns: 1fr;
  }

  .preview-section {
    position: static;
  }
}
</style>