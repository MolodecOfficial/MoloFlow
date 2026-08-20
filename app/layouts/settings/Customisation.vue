<!-- Customisation.vue -->
<script setup lang="ts">
import {
  windowThemes,
  windowButtonStyles,
  type WindowTheme,
  type WindowButtonStyle,
  getAllThemes,
  getAllButtonStyles,
  THEME_STORAGE_KEY,
  BUTTON_STYLE_STORAGE_KEY,
} from '~~/types/window-themes'
import StyleEditor from '~~/app/components/MoloStyleEditor.vue'

const selectedTheme = ref<WindowTheme>(windowThemes[0])
const selectedButtonStyle = ref<WindowButtonStyle>(windowButtonStyles[0])
const allThemes = ref<WindowTheme[]>([])
const allButtonStyles = ref<WindowButtonStyle[]>([])
const showEditor = ref(false)
const { openWindow } = useWindowManager()

// Загрузка всех тем и стилей
const loadAll = () => {
  allThemes.value = getAllThemes()
  allButtonStyles.value = getAllButtonStyles()
}

const loadSelected = () => {
  const savedThemeId = localStorage.getItem(THEME_STORAGE_KEY)
  if (savedThemeId) {
    const theme = allThemes.value.find(t => t.id === savedThemeId)
    if (theme) {
      selectedTheme.value = theme
    }
  }

  const savedButtonId = localStorage.getItem(BUTTON_STYLE_STORAGE_KEY)
  if (savedButtonId) {
    const buttonStyle = allButtonStyles.value.find(b => b.id === savedButtonId)
    if (buttonStyle) {
      selectedButtonStyle.value = buttonStyle
    }
  }
}

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

const selectTheme = (theme: WindowTheme) => {
  selectedTheme.value = theme
  applyTheme(theme)
}

const selectButtonStyle = (buttonStyle: WindowButtonStyle) => {
  selectedButtonStyle.value = buttonStyle
  applyButtonStyle(buttonStyle)
}

const handleThemeUpdated = () => {
  loadAll()
  loadSelected()
}

const handleStyleUpdated = () => {
  loadAll()
  loadSelected()
}

onMounted(() => {
  loadAll()
  loadSelected()

  // Слушаем изменения из редактора
  window.addEventListener('theme-changed', (e: CustomEvent) => {
    if (e.detail) {
      selectedTheme.value = e.detail
    }
  })
  window.addEventListener('button-style-changed', (e: CustomEvent) => {
    if (e.detail) {
      selectedButtonStyle.value = e.detail
    }
  })
})
</script>

<template>
  <div class="customisation-container">
    <!-- Редактор стилей -->
    <div v-if="showEditor" class="editor-wrapper">
      <StyleEditor
          @theme-updated="handleThemeUpdated"
          @style-updated="handleStyleUpdated"
      />
    </div>

    <div class="content-wrapper">
      <div class="left-column">
        <!-- Тема оформления -->
        <div class="themes-section">
          <h3>Тема оформления окон</h3>
          <div class="themes-grid">
            <div
                v-for="theme in allThemes"
                :key="theme.id"
                class="theme-card"
                :class="{
                  active: selectedTheme.id === theme.id,
                  custom: theme.isCustom
                }"
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
                <h4>
                  {{ theme.name }}
                  <span v-if="theme.isCustom" class="custom-badge">Пользовательская</span>
                </h4>
                <p>{{ theme.description }}</p>
              </div>
            </div>
          </div>
        </div>
        <hr>
        <!-- Стиль кнопок -->
        <div class="buttons-section">
          <h3>Стиль кнопок окна</h3>
          <div class="buttons-grid">
            <div
                v-for="buttonStyle in allButtonStyles"
                :key="buttonStyle.id"
                class="button-card"
                :class="{
                  active: selectedButtonStyle.id === buttonStyle.id,
                  custom: buttonStyle.isCustom
                }"
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
                <h4>
                  {{ buttonStyle.name }}
                  <span v-if="buttonStyle.isCustom" class="custom-badge">Пользовательская</span>
                </h4>
                <p>{{ buttonStyle.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Предпросмотр -->
      <div class="preview-section">
        <div class="demo-nav">
          <span>Предпросмотр</span>
          <MoloButton @click="showEditor = !showEditor">
            {{ showEditor ? 'Закрыть' : 'Редактор стилей' }}
          </MoloButton>
        </div>
        <div class="demo-window">
          <div class="demo-header">
            <span class="demo-title">Заголовок окна</span>
            <div class="demo-controls">
              <span class="demo-btn">↻</span>
              <span class="demo-btn">_</span>
              <span class="demo-btn">⛶</span>
              <span class="demo-btn">×</span>
            </div>
          </div>
          <div class="demo-content">
            <p>Так будет выглядеть ваше окно</p>
            <p>Текст и элементы интерфейса</p>
            <MoloButton>Кнопка</MoloButton>
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
  padding: 20px;
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
.button-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(30, 114, 239, 0.3);
}

.theme-card.active,
.button-card.active {
  border-color: var(--borber-color_main);
  background: var(--half_opacity_bg);
}

.theme-card.custom,
.button-card.custom {
  border-color: rgba(255, 193, 7, 0.3);
}

.theme-card.custom.active,
.button-card.custom.active {
  border-color: #ffc107;
  background: rgba(255, 193, 7, 0.05);
}

.custom-badge {
  font-size: 9px;
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
  font-weight: 400;
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

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: sticky;
  top: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 10px;
}

/* ДЕМО ОКНО С ИСПОЛЬЗОВАНИЕМ v-bind */
.demo-window {
  width: 100%;
  border-radius: v-bind('selectedTheme?.styles.borderRadius || "10px"');
  background: v-bind('selectedTheme?.styles.contentBg || "rgba(30, 30, 40, 0.7)"');
  border: v-bind('`1px solid ${selectedTheme?.styles.borderColor || "rgba(255, 255, 255, 0.1)"}`');
  backdrop-filter: v-bind('selectedTheme?.styles.backdropBlur || "blur(10px)"');
  overflow: hidden;
  transition: all 0.3s ease;
}

.demo-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.demo-header {
  padding: 8px;
  background: v-bind('selectedTheme?.styles.headerBg || "rgba(30, 30, 40, 0.7)"');
  border-bottom: v-bind('`1px solid ${selectedTheme?.styles.headerBorder || "rgba(255, 255, 255, 0.1)"}`');
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: v-bind('selectedTheme?.styles.headerText || "white"');
}

.demo-title {
  font-size: 14px;
  font-weight: 500;
}

.demo-controls {
  display: flex;
  border-radius: 6px;
  align-items: center;
  justify-content: center;
  gap: v-bind('selectedButtonStyle?.styles.controlsGap || "6px"');
  padding: v-bind('selectedButtonStyle?.styles.controlsPadding || "2px"');
  border: v-bind('selectedButtonStyle?.styles.controlsBorder || "none"');
}

.demo-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border-radius: 4px;
  transition: all 0.2s;
  cursor: default;
  text-align: center;
  border: v-bind('selectedButtonStyle?.styles.buttonBorder || "none"');
  background: v-bind('selectedButtonStyle?.styles.buttonBg || "transparent"');
  color: v-bind('selectedButtonStyle?.styles.buttonTextColor || "white"');
}

.demo-btn:hover {
  background: v-bind('selectedButtonStyle?.styles.buttonHoverBg || "rgba(255, 255, 255, 0.1)"');
  color: v-bind('selectedButtonStyle?.styles.buttonHoverTextColor || selectedButtonStyle?.styles.buttonTextColor || "white"');
}

.demo-content {
  padding: 20px;
  color: v-bind('selectedTheme?.styles.contentText || "rgba(255, 255, 255, 0.9)"');
  font-size: 14px;
}

.demo-content p {
  margin: 0 0 10px 0;
}

@media (max-width: 768px) {
  .content-wrapper {
    grid-template-columns: 1fr;
  }

  .preview-section {
    position: static;
  }

  .info-message {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>