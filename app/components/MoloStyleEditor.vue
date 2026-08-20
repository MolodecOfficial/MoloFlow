<!-- StyleEditor.vue -->
<script setup lang="ts">
import {
  BUTTON_STYLE_STORAGE_KEY,
  deleteCustomButtonStyle,
  deleteCustomTheme,
  getCustomButtonStyles,
  getCustomThemes,
  saveCustomButtonStyle,
  saveCustomTheme,
  THEME_STORAGE_KEY,
  type WindowButtonStyle,
  windowButtonStyles,
  type WindowTheme,
  windowThemes
} from '~~/types/window-themes'

const emit = defineEmits<{
  'theme-updated': []
  'style-updated': []
}>()

// Состояние
const activeTab = ref<'themes' | 'buttons'>('themes')
const showCreateModal = ref(false)
const editingItem = ref<WindowTheme | WindowButtonStyle | null>(null)
const isEditMode = ref(false)
const deleteModal = ref(false)
const deleteItemId = ref<string | null>(null)
const deleteItemType = ref<'theme' | 'button' | null>(null)

// Кастомные темы
const customThemes = ref<WindowTheme[]>([])
const customButtonStyles = ref<WindowButtonStyle[]>([])

// Форма для создания/редактирования темы
const form = reactive({
  id: '',
  name: '',
  description: '',
  previewColor: '#1eef6f',
  styles: {
    windowBg: 'rgba(30, 30, 40, 0.7)',
    headerBg: 'rgba(30, 30, 40, 0.7)',
    headerBorder: 'rgba(255, 255, 255, 0.1)',
    headerText: '#ffffff',
    contentBg: 'rgba(49, 49, 49, 0.02)',
    contentText: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    backdropBlur: 'blur(10px)',
    controlsBg: 'rgba(255, 255, 255, 0.05)',
    controlsHover: 'rgba(255, 255, 255, 0.1)',
    accentColor: '#1eef6f'
  }
})

// Форма для кнопок
const buttonForm = reactive({
  id: '',
  name: '',
  description: '',
  styles: {
    controlsBorder: 'none',
    controlsBorderWidth: '0px',
    controlsBorderColor: 'rgba(255, 255, 255, 0.1)',
    buttonBorder: '1px solid rgba(255, 255, 255, 0.1)',
    buttonBorderWidth: '1px',
    buttonBorderColor: 'rgba(255, 255, 255, 0.1)',
    buttonBg: 'transparent',
    buttonHoverBg: 'rgba(255, 255, 255, 0.1)',
    buttonTextColor: '#ffffff',
    buttonHoverTextColor: '#ffffff',
    controlsGap: '6px',
    controlsPadding: '2px'
  }
})

// Загрузка данных
const loadData = () => {
  customThemes.value = getCustomThemes()
  customButtonStyles.value = getCustomButtonStyles()
}

// Создание/обновление темы
const saveTheme = () => {
  const theme: WindowTheme = {
    id: form.id || `custom-theme-${Date.now()}`,
    name: form.name || 'Новая тема',
    description: form.description || 'Пользовательская тема',
    previewColor: form.previewColor || '#1eef6f',
    isCustom: true,
    styles: {...form.styles}
  }

  saveCustomTheme(theme)
  loadData()
  emit('theme-updated')
  closeModal()
}

// Создание/обновление стиля кнопок
const saveButtonStyle = () => {
  const style: WindowButtonStyle = {
    id: buttonForm.id || `custom-button-${Date.now()}`,
    name: buttonForm.name || 'Новый стиль',
    description: buttonForm.description || 'Пользовательский стиль',
    isCustom: true,
    styles: {
      ...buttonForm.styles,
      controlsBorder: `${buttonForm.styles.controlsBorderWidth} solid ${buttonForm.styles.controlsBorderColor}`,
      buttonBorder: `${buttonForm.styles.buttonBorderWidth} solid ${buttonForm.styles.buttonBorderColor}`
    }
  }

  saveCustomButtonStyle(style)
  loadData()
  emit('style-updated')
  closeModal()
}

// Открыть модалку для создания темы
const openCreateTheme = () => {
  activeTab.value = 'themes'
  isEditMode.value = false
  editingItem.value = null
  // Сброс формы
  form.id = ''
  form.name = ''
  form.description = ''
  form.previewColor = '#1eef6f'
  Object.assign(form.styles, {
    windowBg: 'rgba(30, 30, 40, 0.7)',
    headerBg: 'rgba(30, 30, 40, 0.7)',
    headerBorder: 'rgba(255, 255, 255, 0.1)',
    headerText: '#ffffff',
    contentBg: 'rgba(49, 49, 49, 0.02)',
    contentText: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    backdropBlur: 'blur(10px)',
    controlsBg: 'rgba(255, 255, 255, 0.05)',
    controlsHover: 'rgba(255, 255, 255, 0.1)',
    accentColor: '#1eef6f'
  })
  showCreateModal.value = true
}

// Открыть модалку для создания стиля кнопок
const openCreateButtonStyle = () => {
  activeTab.value = 'buttons'
  isEditMode.value = false
  editingItem.value = null
  // Сброс формы кнопок
  buttonForm.id = ''
  buttonForm.name = ''
  buttonForm.description = ''
  Object.assign(buttonForm.styles, {
    controlsBorder: 'none',
    controlsBorderWidth: '0px',
    controlsBorderColor: 'rgba(255, 255, 255, 0.1)',
    buttonBorder: '1px solid rgba(255, 255, 255, 0.1)',
    buttonBorderWidth: '1px',
    buttonBorderColor: 'rgba(255, 255, 255, 0.1)',
    buttonBg: 'transparent',
    buttonHoverBg: 'rgba(255, 255, 255, 0.1)',
    buttonTextColor: '#ffffff',
    buttonHoverTextColor: '#ffffff',
    controlsGap: '6px',
    controlsPadding: '2px'
  })
  showCreateModal.value = true
}

// Редактирование темы
const editTheme = (theme: WindowTheme) => {
  activeTab.value = 'themes'
  isEditMode.value = true
  editingItem.value = theme
  form.id = theme.id
  form.name = theme.name
  form.description = theme.description
  form.previewColor = theme.previewColor
  Object.assign(form.styles, theme.styles)
  showCreateModal.value = true
}

// Редактирование стиля кнопок
const editButtonStyle = (style: WindowButtonStyle) => {
  activeTab.value = 'buttons'
  isEditMode.value = true
  editingItem.value = style
  buttonForm.id = style.id
  buttonForm.name = style.name
  buttonForm.description = style.description

  // Парсим значения border
  const controlsBorderMatch = style.styles.controlsBorder?.match(/^(\d+\.?\d*px)\s+solid\s+(.+)$/)
  if (controlsBorderMatch) {
    buttonForm.styles.controlsBorderWidth = controlsBorderMatch[1]
    buttonForm.styles.controlsBorderColor = controlsBorderMatch[2]
  } else {
    buttonForm.styles.controlsBorderWidth = '0px'
    buttonForm.styles.controlsBorderColor = 'rgba(255, 255, 255, 0.1)'
  }

  const buttonBorderMatch = style.styles.buttonBorder?.match(/^(\d+\.?\d*px)\s+solid\s+(.+)$/)
  if (buttonBorderMatch) {
    buttonForm.styles.buttonBorderWidth = buttonBorderMatch[1]
    buttonForm.styles.buttonBorderColor = buttonBorderMatch[2]
  } else {
    buttonForm.styles.buttonBorderWidth = '1px'
    buttonForm.styles.buttonBorderColor = 'rgba(255, 255, 255, 0.1)'
  }

  Object.assign(buttonForm.styles, {
    buttonBg: style.styles.buttonBg || 'transparent',
    buttonHoverBg: style.styles.buttonHoverBg || 'rgba(255, 255, 255, 0.1)',
    buttonTextColor: style.styles.buttonTextColor || '#ffffff',
    buttonHoverTextColor: style.styles.buttonHoverTextColor || '#ffffff',
    controlsGap: style.styles.controlsGap || '6px',
    controlsPadding: style.styles.controlsPadding || '2px'
  })

  showCreateModal.value = true
}

// Открыть модалку подтверждения удаления для темы
const openDeleteThemeModal = (id: string) => {
  deleteItemId.value = id
  deleteItemType.value = 'theme'
  deleteModal.value = true
}

// Открыть модалку подтверждения удаления для кнопки
const openDeleteButtonModal = (id: string) => {
  deleteItemId.value = id
  deleteItemType.value = 'button'
  deleteModal.value = true
}

// Подтверждение удаления
const confirmDelete = () => {
  if (!deleteItemId.value || !deleteItemType.value) return

  if (deleteItemType.value === 'theme') {
    deleteCustomTheme(deleteItemId.value)
    loadData()
    emit('theme-updated')
    const currentTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (currentTheme === deleteItemId.value) {
      localStorage.removeItem(THEME_STORAGE_KEY)
      window.dispatchEvent(new CustomEvent('theme-changed', {detail: null}))
    }
  } else if (deleteItemType.value === 'button') {
    deleteCustomButtonStyle(deleteItemId.value)
    loadData()
    emit('style-updated')
    const currentStyle = localStorage.getItem(BUTTON_STYLE_STORAGE_KEY)
    if (currentStyle === deleteItemId.value) {
      localStorage.removeItem(BUTTON_STYLE_STORAGE_KEY)
      window.dispatchEvent(new CustomEvent('button-style-changed', {detail: null}))
    }
  }

  deleteModal.value = false
  deleteItemId.value = null
  deleteItemType.value = null
}

// Закрыть модалку
const closeModal = () => {
  showCreateModal.value = false
  isEditMode.value = false
  editingItem.value = null
}

// Обработчик подтверждения в модалке
const handleModalConfirm = () => {
  if (activeTab.value === 'themes') {
    saveTheme()
  } else {
    saveButtonStyle()
  }
}

// Цветовые пресеты
const colorPresets = [
  '#1eef6f', '#2196F3', '#FF5722', '#9C27B0',
  '#FFC107', '#4CAF50', '#E91E63', '#00BCD4',
  '#ffffff', '#000000', '#ff6b6b', '#ffd93d',
  '#6bcb77', '#4d96ff', '#a66cff', '#ff6b9d'
]

// Помощник для определения, является ли строка цветом (hex)
const isHexColor = (value: string) => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)
}

// Помощник для получения hex из rgba/других форматов
const getHexFromColor = (color: string) => {
  if (isHexColor(color)) return color
  const rgbMatch = color.match(/\d+/g)
  if (rgbMatch && rgbMatch.length >= 3) {
    const r = parseInt(rgbMatch[0])
    const g = parseInt(rgbMatch[1])
    const b = parseInt(rgbMatch[2])
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }
  return '#ffffff'
}

// Цветовые поля для темы
const themeColorFields = [
  {key: 'headerBg', label: 'Фон шапки'},
  {key: 'headerText', label: 'Цвет текста шапки'},
  {key: 'contentBg', label: 'Фон контента'},
  {key: 'borderColor', label: 'Цвет границы'}
]

// Цветовые поля для кнопок
const buttonColorFields = [
  {key: 'buttonBg', label: 'Фон кнопки'},
  {key: 'buttonHoverBg', label: 'Фон при наведении'},
  {key: 'buttonTextColor', label: 'Цвет текста'},
  {key: 'buttonHoverTextColor', label: 'Цвет текста при наведении'}
]

// Функции для регулировки ширины рамки
const increaseBorderWidth = (field: 'controlsBorderWidth' | 'buttonBorderWidth') => {
  const current = parseFloat(buttonForm.styles[field])
  if (!isNaN(current)) {
    buttonForm.styles[field] = `${Math.min(current + 1, 100)}px`
  }
}

const decreaseBorderWidth = (field: 'controlsBorderWidth' | 'buttonBorderWidth') => {
  const current = parseFloat(buttonForm.styles[field])
  if (!isNaN(current) && current > 0) {
    buttonForm.styles[field] = `${Math.max(current - 1, 0)}px`
  }
}

const getNumericWidth = (value: string) => {
  return parseFloat(value) || 0
}

const previewStyle = computed(() => {
  const theme = activeTab.value === 'themes' ? form.styles : windowThemes[0].styles
  const buttonStyle = activeTab.value === 'buttons' ? buttonForm.styles : windowButtonStyles[0].styles

  return {
    '--preview-header-bg': theme.headerBg,
    '--preview-header-border': (theme as typeof form.styles).headerBorder,
    '--preview-header-text': theme.headerText,
    '--preview-content-bg': theme.contentBg,
    '--preview-content-text': (theme as typeof form.styles).contentText,
    '--preview-border': theme.borderColor,
    '--preview-radius': theme.borderRadius,
    '--preview-blur': theme.backdropBlur,
    '--preview-accent': (theme as typeof form.styles).accentColor,
    '--preview-controls-border': `${buttonStyle.controlsBorderWidth || '0px'} solid ${buttonStyle.controlsBorderColor || 'rgba(255, 255, 255, 0.1)'}`,
    '--preview-button-border': `${buttonStyle.buttonBorderWidth || '1px'} solid ${buttonStyle.buttonBorderColor || 'rgba(255, 255, 255, 0.1)'}`,
    '--preview-button-bg': buttonStyle.buttonBg || 'transparent',
    '--preview-button-hover-bg': buttonStyle.buttonHoverBg || 'rgba(255, 255, 255, 0.1)',
    '--preview-button-text': buttonStyle.buttonTextColor || 'white',
    '--preview-button-hover-text': buttonStyle.buttonHoverTextColor || buttonStyle.buttonTextColor || 'white',
    '--preview-controls-gap': buttonStyle.controlsGap || '6px',
    '--preview-controls-padding': buttonStyle.controlsPadding || '2px'
  }
})

// Инициализация
onMounted(() => {
  loadData()
})

watch(activeTab, () => {
  loadData()
})
</script>

<template>
  <MoloSection>
    <template #header>
      <div class="tabs">
        <MoloButton
            class="small"
            :class="{ confirm: activeTab === 'themes' }"
            @click="activeTab = 'themes'"
        >
          Темы окон
        </MoloButton>
        <MoloButton
            class="small"
            :class="{ confirm: activeTab === 'buttons' }"
            @click="activeTab = 'buttons'"
        >
          Стили кнопок
        </MoloButton>
      </div>
      <div class="list-header" v-if="activeTab === 'themes'">
        <span class="count">Всего: {{ customThemes.length }} кастомных тем</span>
        <MoloButton class="confirm small" @click="openCreateTheme">
          Создать тему
        </MoloButton>
      </div>
      <div class="list-header" v-if="activeTab === 'buttons'">
        <span class="count">Всего: {{ customButtonStyles.length }} кастомных стилей</span>
        <MoloButton class="confirm small" @click="openCreateButtonStyle">
          Создать стиль
        </MoloButton>
      </div>
    </template>

    <template #main>
      <!-- Список тем -->
      <div v-if="activeTab === 'themes'">

        <div v-if="customThemes.length === 0" class="empty-state">
          <p>Нет кастомных тем. Создайте свою!</p>
        </div>

        <div v-for="theme in customThemes" :key="theme.id" class="list-item">
          <div class="item-preview" :style="{ backgroundColor: theme.previewColor }">
            <div class="mini-preview">
              <div class="mini-header" :style="{ background: theme.styles.headerBg }">
                <span :style="{ color: theme.styles.headerText }">●</span>
              </div>
              <div class="mini-content" :style="{ background: theme.styles.contentBg }"></div>
            </div>
          </div>
          <div class="item-info">
            <div class="item-name">{{ theme.name }}</div>
            <div class="item-desc">{{ theme.description }}</div>
          </div>
          <div class="item-actions">
            <MoloButton class="small" @click="editTheme(theme)" title="Редактировать">✎</MoloButton>
            <MoloButton class="small close" @click="openDeleteThemeModal(theme.id)" title="Удалить">✕</MoloButton>
          </div>
        </div>
      </div>

      <!-- Список стилей кнопок -->
      <div v-if="activeTab === 'buttons'">

        <div v-if="customButtonStyles.length === 0" class="empty-state">
          <p>Нет кастомных стилей. Создайте свой!</p>
        </div>

        <div v-for="style in customButtonStyles" :key="style.id" class="list-item">
          <div class="item-preview button-preview-item">
            <div class="mini-controls" :style="{
              gap: style.styles.controlsGap,
              padding: style.styles.controlsPadding,
              border: style.styles.controlsBorder
            }">
              <span class="mini-btn" :style="{
                border: style.styles.buttonBorder,
                background: style.styles.buttonBg,
                color: style.styles.buttonTextColor
              }">_</span>
              <span class="mini-btn" :style="{
                border: style.styles.buttonBorder,
                background: style.styles.buttonBg,
                color: style.styles.buttonTextColor
              }">⛶</span>
              <span class="mini-btn" :style="{
                border: style.styles.buttonBorder,
                background: style.styles.buttonBg,
                color: style.styles.buttonTextColor
              }">×</span>
            </div>
          </div>
          <div class="item-info">
            <div class="item-name">{{ style.name }}</div>
            <div class="item-desc">{{ style.description }}</div>
          </div>
          <div class="item-actions">
            <MoloButton class="small" @click="editButtonStyle(style)" title="Редактировать">✎</MoloButton>
            <MoloButton class="small close" @click="openDeleteButtonModal(style.id)" title="Удалить">✕</MoloButton>
          </div>
        </div>
      </div>
    </template>
  </MoloSection>

  <!-- Модалка подтверждения удаления -->
  <MoloModal
      v-model="deleteModal"
      title="Удалить?"
      help-text="Удаление является безвозвратным, вернуть элемент будет невозможно!"
      @confirm="confirmDelete"
  >
    <template #body>
      <p style="color: rgba(255, 255, 255, 0.8);">
        Вы уверены, что хотите удалить этот элемент?
      </p>
    </template>
  </MoloModal>

  <!-- Модалка для создания/редактирования -->
  <MoloModal
      v-model="showCreateModal"
      :title="isEditMode ? 'Редактировать' : 'Создать новый'"
      width="700px"
      @confirm="handleModalConfirm"
      help-text
  >
    <template #body>
      <!-- Форма для темы -->
      <div v-if="activeTab === 'themes'" class="modal-body">
        <MoloInput
            tLabel="Название"
            lRequired
            placeholder="Название темы"
            v-model="form.name"
        />
        <MoloInput
            tLabel="Описание"
            lRequired
            placeholder="Краткое описание"
            v-model="form.description"
        />

        <div class="form-group">
          <label>Цвет превью</label>
          <div class="color-picker-group">
            <input
                type="color"
                :value="form.previewColor"
                @input="(e) => { const target = e.target as HTMLInputElement; form.previewColor = target.value }"
            />
            <div class="color-presets">
              <div
                  v-for="color in colorPresets"
                  :key="color"
                  class="preset-color"
                  :style="{ backgroundColor: color }"
                  @click="form.previewColor = color"
              />
            </div>
          </div>
          <span class="color-value">{{ form.previewColor }}</span>
        </div>

        <div class="styles-section">
          <h4>Стили темы</h4>
          <div class="styles-grid">
            <div
                v-for="field in themeColorFields"
                :key="field.key"
                class="form-group"
            >
              <label>{{ field.label }}</label>
              <div class="color-picker-group">
                <input
                    type="color"
                    :value="getHexFromColor(form.styles[field.key as keyof typeof form.styles])"
                    @input="(e) => {
                      const target = e.target as HTMLInputElement;
                      const currentValue = form.styles[field.key as keyof typeof form.styles]
                      if (currentValue.startsWith('rgba')) {
                        const match = currentValue.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
                        if (match) {
                          const hex = target.value
                          const r = parseInt(hex.slice(1,3), 16)
                          const g = parseInt(hex.slice(3,5), 16)
                          const b = parseInt(hex.slice(5,7), 16)
                          const a = parseFloat(match[4])
                          form.styles[field.key as keyof typeof form.styles] = `rgba(${r}, ${g}, ${b}, ${a})`
                          return
                        }
                      }
                      form.styles[field.key as keyof typeof form.styles] = target.value
                    }"
                />
                <input
                    type="text"
                    :value="form.styles[field.key as keyof typeof form.styles]"
                    @input="(e) => {
                      const target = e.target as HTMLInputElement
                      form.styles[field.key as keyof typeof form.styles] = target.value
                    }"
                    class="color-text-input"
                    placeholder="rgba(...) или #hex"
                />
              </div>
            </div>
            <div class="form-group">
              <MoloInput
                  tLabel="Скругление"
                  lRequired
                  placeholder="10px"
                  v-model="form.styles.borderRadius"
              />
            </div>
            <div class="form-group">
              <MoloInput
                  tLabel="Размытие"
                  lRequired
                  placeholder="blur(10px)"
                  v-model="form.styles.backdropBlur"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Форма для стиля кнопок -->
      <div v-if="activeTab === 'buttons'" class="modal-body">
        <MoloInput
            tLabel="Название"
            lRequired
            placeholder="Название стиля"
            v-model="buttonForm.name"
        />
        <MoloInput
            tLabel="Описание"
            lRequired
            placeholder="Краткое описание"
            v-model="buttonForm.description"
        />

        <div class="styles-section">
          <h4>Стили кнопок</h4>
          <div class="styles-grid">
            <!-- Рамка контейнера -->
            <div class="form-group border-control">
              <label>Рамка контейнера</label>
              <div class="border-control-group">
                <div class="width-control">
                  <button type="button" @click="decreaseBorderWidth('controlsBorderWidth')" class="arrow-btn">-</button>
                  <input
                      type="text"
                      v-model="buttonForm.styles.controlsBorderWidth"
                      class="width-input"
                      readonly
                  />
                  <button type="button" @click="increaseBorderWidth('controlsBorderWidth')" class="arrow-btn">+</button>
                </div>
                <div class="color-picker-group" style="flex:1;">
                  <input
                      type="color"
                      :value="getHexFromColor(buttonForm.styles.controlsBorderColor)"
                      @input="(e) => {
                      const target = e.target as HTMLInputElement
                      const currentValue = buttonForm.styles.controlsBorderColor
                      if (currentValue.startsWith('rgba')) {
                        const match = currentValue.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
                        if (match) {
                          const hex = target.value
                          const r = parseInt(hex.slice(1,3), 16)
                          const g = parseInt(hex.slice(3,5), 16)
                          const b = parseInt(hex.slice(5,7), 16)
                          const a = parseFloat(match[4])
                          buttonForm.styles.controlsBorderColor = `rgba(${r}, ${g}, ${b}, ${a})`
                          return
                        }
                      }
                      buttonForm.styles.controlsBorderColor = target.value
                    }"
                  />
                  <input
                      type="text"
                      v-model="buttonForm.styles.controlsBorderColor"
                      class="color-text-input"
                      placeholder="rgba(...) или #hex"
                  />
                </div>
              </div>
            </div>

            <!-- Рамка кнопки -->
            <div class="form-group border-control">
              <label>Рамка кнопки</label>
              <div class="border-control-group">
                <div class="width-control">
                  <button type="button" @click="decreaseBorderWidth('buttonBorderWidth')" class="arrow-btn">-</button>
                  <input
                      type="text"
                      v-model="buttonForm.styles.buttonBorderWidth"
                      class="width-input"
                      readonly
                  />
                  <button type="button" @click="increaseBorderWidth('buttonBorderWidth')" class="arrow-btn">+</button>
                </div>
                <div class="color-picker-group" style="flex:1;">
                  <input
                      type="color"
                      :value="getHexFromColor(buttonForm.styles.buttonBorderColor)"
                      @input="(e) => {
                      const target = e.target as HTMLInputElement
                      const currentValue = buttonForm.styles.buttonBorderColor
                      if (currentValue.startsWith('rgba')) {
                        const match = currentValue.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
                        if (match) {
                          const hex = target.value
                          const r = parseInt(hex.slice(1,3), 16)
                          const g = parseInt(hex.slice(3,5), 16)
                          const b = parseInt(hex.slice(5,7), 16)
                          const a = parseFloat(match[4])
                          buttonForm.styles.buttonBorderColor = `rgba(${r}, ${g}, ${b}, ${a})`
                          return
                        }
                      }
                      buttonForm.styles.buttonBorderColor = target.value
                    }"
                  />
                  <input
                      type="text"
                      v-model="buttonForm.styles.buttonBorderColor"
                      class="color-text-input"
                      placeholder="rgba(...) или #hex"
                  />
                </div>
              </div>
            </div>

            <!-- Цвета кнопок -->
            <div
                v-for="field in buttonColorFields"
                :key="field.key"
                class="form-group"
            >
              <label>{{ field.label }}</label>
              <div class="color-picker-group">
                <input
                    type="color"
                    :value="getHexFromColor(buttonForm.styles[field.key as keyof typeof buttonForm.styles])"
                    @input="(e) => {
                      const target = e.target as HTMLInputElement
                      const currentValue = buttonForm.styles[field.key as keyof typeof buttonForm.styles]
                      if (currentValue.startsWith('rgba')) {
                        const match = currentValue.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
                        if (match) {
                          const hex = target.value
                          const r = parseInt(hex.slice(1,3), 16)
                          const g = parseInt(hex.slice(3,5), 16)
                          const b = parseInt(hex.slice(5,7), 16)
                          const a = parseFloat(match[4])
                          buttonForm.styles[field.key as keyof typeof buttonForm.styles] = `rgba(${r}, ${g}, ${b}, ${a})`
                          return
                        }
                      }
                      buttonForm.styles[field.key as keyof typeof buttonForm.styles] = target.value
                    }"
                />
                <input
                    type="text"
                    :value="buttonForm.styles[field.key as keyof typeof buttonForm.styles]"
                    @input="(e) => {
                      const target = e.target as HTMLInputElement
                      buttonForm.styles[field.key as keyof typeof buttonForm.styles] = target.value
                    }"
                    class="color-text-input"
                    placeholder="rgba(...) или #hex"
                />
              </div>
            </div>

            <!-- Отступы -->
            <div class="form-group">
              <MoloInput
                  tLabel="Отступ между кнопками"
                  lRequired
                  placeholder="6px"
                  v-model="buttonForm.styles.controlsGap"
              />
            </div>
            <div class="form-group">
              <MoloInput
                  tLabel="Отступ контейнера"
                  lRequired
                  placeholder="2px"
                  v-model="buttonForm.styles.controlsPadding"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #help>
      <div class="demo-window" :style="previewStyle">
        <div class="demo-header">
          <span class="demo-title">Заголовок окна</span>
          <div class="demo-controls" :style="{
              gap: 'var(--preview-controls-gap)',
              padding: 'var(--preview-controls-padding)',
              border: 'var(--preview-controls-border)'
            }">
              <span class="demo-btn" :style="{
                border: 'var(--preview-button-border)',
                background: 'var(--preview-button-bg)',
                color: 'var(--preview-button-text)'
              }">↻</span>
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
          <MoloButton>Кнопка</MoloButton>
        </div>
      </div>
    </template>
  </MoloModal>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 10px;
}

.list-header {
  gap: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.empty-state {
  padding: 30px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  border-radius: 8px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.list-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.item-preview {
  width: 80px;
  height: 45px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-preview {
  width: 50px;
  height: 35px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.mini-header {
  height: 12px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  font-size: 6px;
}

.mini-content {
  height: 23px;
}

.button-preview-item {
  background: rgba(0, 0, 0, 0.2);
}

.mini-controls {
  display: flex;
  border-radius: 4px;
}

.mini-btn {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border-radius: 3px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 500;
  font-size: 14px;
  color: white;
}

.item-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* Modal styles */
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.color-picker-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.color-picker-group input[type="color"] {
  width: 40px;
  height: 40px;
  padding: 2px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
}

.color-text-input {
  flex: 1;
  min-width: 150px;
  padding: 12px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-family: monospace;
}

.color-text-input:focus {
  outline: none;
  border-color: var(--borber-color_main);
}

.color-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-family: monospace;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.color-presets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.preset-color {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.preset-color:hover {
  transform: scale(1.1);
  border-color: white;
}

.styles-section h4 {
  margin: 0 0 10px 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.styles-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.border-control {
  grid-column: 1 / -1;
}

.border-control-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.width-control {
  border: 1px solid var(--half_opacity_border);
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 4px;
}

.arrow-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.arrow-btn:active {
  transform: scale(0.9);
}

.width-input {
  width: 50px;
  text-align: center;
  padding: 4px;
  background: transparent;
  border: none;
  color: white;
  font-size: 12px;
  font-family: monospace;
  cursor: default;
}

.width-input:focus {
  outline: none;
}

.demo-window {
  width: 100%;
  border-radius: var(--preview-radius, 10px);
  background: var(--preview-content-bg, rgba(30, 30, 40, 0.7));
  border: 1px solid var(--preview-border, rgba(255, 255, 255, 0.1));
  backdrop-filter: var(--preview-blur, blur(10px));
  overflow: hidden;
  transition: all 0.3s ease;
}

.demo-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.demo-header {
  padding: 8px 12px;
  background: var(--preview-header-bg, rgba(30, 30, 40, 0.7));
  border-bottom: 1px solid var(--preview-header-border, rgba(255, 255, 255, 0.1));
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--preview-header-text, white);
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
}

.demo-btn:hover {
  background: var(--preview-button-hover-bg, rgba(255, 255, 255, 0.1));
  color: var(--preview-button-hover-text, var(--preview-button-text, white));
}

.demo-content {
  padding: 20px;
  color: var(--preview-content-text, rgba(255, 255, 255, 0.9));
  font-size: 14px;
}

.demo-content p {
  margin: 0 0 10px 0;
}

@media (max-width: 480px) {
  .styles-grid {
    grid-template-columns: 1fr;
  }
}
</style>