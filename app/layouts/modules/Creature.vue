<script setup lang="ts">
import {ref, computed, watch, onMounted, onUnmounted} from 'vue'
import {VueMonacoEditor} from '@guolao/vue-monaco-editor'

import {MONACO_EDITOR_OPTIONS, getEditorLanguage} from '~~/app/utils/monacoConfig'
import {initMonacoTypeScript, registerMonacoSnippets} from '~~/app/utils/monaco-init'

if (typeof window !== 'undefined') {
  initMonacoTypeScript()
  registerMonacoSnippets()
}

const emit = defineEmits(['close', 'saved'])

const {openWindow, updateWindowData} = useWindowManager()
const {addNotification} = useNotifications()

// 🔥 данные предприятия
const enterpriseInfo = ref<any>(null)

// 🔥 список модулей
const modules = ref<any[]>([])
const selectedModuleId = ref<string | null>(null)

const isEditing = computed(() => !!selectedModuleId.value)

const monacoRef = ref()
const showDocumentation = ref(false)

const availableFormats = [
  {label: '.vue', value: 'vue'},
  {label: '.js', value: 'js'},
  {label: '.ts', value: 'ts'}
]

// 🔥 форма
const formData = ref({
  name: '',
  fileName: '',
  description: '',
  format: 'vue',
  code: ''
})

const toggleDocumentation = () => {
  showDocumentation.value = !showDocumentation.value
}
// 🔥 язык редактора
const editorLanguage = computed(() => getEditorLanguage(formData.value.format))

// 🔥 ID окна предпросмотра
const previewWindowId = ref<string | null>(null)

// 🔥 placeholder
const getPlaceholder = () => {
  if (formData.value.format === 'vue') {
    return `<script setup>
import { ref } from 'vue'

const message = ref('Привет из динамического модуля!')

const handleClick = () => {
  message.value = 'Работает!'
}

const { addNotification } = useNotifications()

const notice = () => {
  addNotification('NOTICE_DEFAULT', 'Стандартное уведомление')
}

const danger = () => {
  addNotification('DANGER_DEFAULT', 'Предупреждающее уведомление')
}

const error = () => {
  addNotification('ERROR_DEFAULT', 'Уведомление об ошибке')
}

const testArray = ['Вика', 'Максим', 'Кирилл']

<\/script>

<template>
  <div class="container">
    <h1>{{ message }}</h1>
    <button @click="handleClick" class="action-btn confirm">Click me</button>
    <section class="container_input">
        <MoloInput
            lRequired
            tLabel="Надпись к полю ввода, Максимальная длина строчки - 12 символов"
            maxLength="12"
            placeholder="Фоновый текст"
        />
        <MoloInput
            address
            lRequired
            tLabel="Режим ввода адреса"
        />
        <MoloInput
            phone
            lRequired
            tLabel="Режим ввода телефона"
        />
        <MoloSelect
            lRequired
            tLabel="Работа со списком"
            :parent="testArray"
            disabled="Выберите элемент"
            all="Все имена"
        />
    </section>
    <section class="container_notifications">
        <button @click="notice" class="action-btn confirm">Стандартное уведомление</button>
        <button @click="danger" class="action-btn danger">Предупреждающее уведомление</button>
        <button @click="error" class="action-btn close">Уведомление об ошибке</button>
    </section>
  </div>
</template>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.container_input {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: 10px;
}

.container_notifications {
    display: flex;
    width: 100%;
    flex-direction: row;
    gap: 20px;
    justify-content: space-between;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.confirm {
  padding: 6px 16px;
  background: #1eef6f;
  color: #020b18;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  &.action-btn:hover {
    background: #15b050;
  }
}

.action-btn.danger {
  padding: 8px 16px;
  background: #efd31e;
  color: #020b18;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  &.action-btn:hover {
    background: #b09b15;
  }
}

.action-btn.close {
  padding: 8px 16px;
  background: #ef1e1e;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  &.action-btn:hover {
    background: #b01515;
  }
}
</style>

`
  }

  return '// module code...'
}

// 🔥 загрузка модулей
const fetchModules = async () => {
  try {
    const res = await $fetch(
        `/api/enterprises/${enterpriseInfo.value._id}/dynamicModules`
    )
    modules.value = res.modules || []
  } catch (e) {
    console.error('Ошибка загрузки модулей', e)
  }
}

// 🔥 выбор модуля
watch(selectedModuleId, (id) => {
  if (!id) {
    formData.value = {
      name: '',
      fileName: '',
      description: '',
      format: 'vue',
      code: getPlaceholder()
    }
    return
  }

  const mod = modules.value.find(m => m._id === id)

  if (mod) {
    formData.value = {
      name: mod.name,
      fileName: mod.fileName,
      description: mod.description || '',
      format: mod.format,
      code: mod.code
    }
  }
})

// 🔥 init
onMounted(async () => {
  const data = localStorage.getItem('currentEnterprise')

  if (data) {
    try {
      enterpriseInfo.value = JSON.parse(data)
      await fetchModules()
    } catch (e) {
      console.error(e)
    }
  }

  formData.value.code = getPlaceholder()
})

// 🔥 сохранение
const loading = ref(false)

const saveModule = async () => {
  loading.value = true

  const wasEditing = isEditing.value

  try {
    const url = wasEditing
        ? `/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${selectedModuleId.value}`
        : `/api/enterprises/${enterpriseInfo.value._id}/dynamicModules`

    const method = wasEditing ? 'PUT' : 'POST'

    const response = await $fetch(url, {
      method,
      body: {
        ...formData.value,
        enterpriseId: enterpriseInfo.value._id
      }
    })

    await fetchModules()

    if (!wasEditing) {
      selectedModuleId.value = response.module._id
    }

    addNotification(
        'NOTICE_DEFAULT',
        wasEditing ? 'Модуль обновлен' : 'Модуль создан'
    )

    emit('saved', response.module)

  } catch (error: any) {
    addNotification('ERROR_DEFAULT', error?.data?.message || 'Ошибка')
  } finally {
    loading.value = false
  }
}

// 🔥 смена формата
watch(() => formData.value.format, () => {
  if (!isEditing.value) {
    formData.value.code = getPlaceholder()
  }
})

// 🔥 ОТКРЫТЬ ПРЕВЬЮ
const openPreviewInWindow = () => {
  if (!formData.value.code?.trim()) {
    addNotification('WARNING_DEFAULT', 'Нет кода для предпросмотра')
    return
  }

  const id = 'preview'
  previewWindowId.value = id

  openWindow(
      'modules',
      id,
      null,
      {
        width: 600,
        height: 500,
        minWidth: 600,
        minHeight: 400,
      },
      false,
      'modules/preview',
      null,
      {
        moduleName: formData.value.name || 'Без названия',
        code: formData.value.code
      }
  )
}

// 🔥 РЕАКТИВНОЕ ОБНОВЛЕНИЕ ПРЕВЬЮ
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
    () => formData.value.code,
    (code) => {
      if (!previewWindowId.value) return

      if (debounceTimer) clearTimeout(debounceTimer)

      debounceTimer = setTimeout(() => {
        updateWindowData('modules', previewWindowId.value!, {
          moduleName: formData.value.name,
          code
        })
      }, 300)
    }
)

watch(showDocumentation, async () => {
  await nextTick()

  setTimeout(() => {
    monacoRef.value?.editor?.layout?.()
  }, 50)
})

// cleanup
onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <h1>{{ isEditing ? 'Редактирование модуля' : 'Создание модуля' }}</h1>
  <hr>

  <div class="mode-switcher">
    <button
        type="button"
        class="action-btn confirm"
        @click="selectedModuleId = null"
    >
      Новый модуль
    </button>

    <MoloSelect
        tLabel="Выберите Ваш модуль"
        lRequired
        v-model="selectedModuleId"
        :parent="modules"
        children="name"
        valueKey="_id"
        disabled="Готовые модули"
    />
  </div>

  <section class="editor-form">
    <div class="form-row">
      <MoloInput
          tLabel="Название модуля"
          lRequired
          v-model="formData.name"
          type="text"
          placeholder="Введите название модуля"
          :disabled="isEditing"
      />

      <MoloInput
          tLabel="Название файла (на английском)"
          lRequired
          v-model="formData.fileName"
          type="text"
          placeholder="Введите название модуля"
          :disabled="isEditing"
      />

      <MoloSelect
          tLabel="Формат файла"
          lRequired
          v-model="formData.format"
          :disabled="isEditing"
          :parent="availableFormats"
          children="label"
          valueKey="value"
      />

    </div>

    <div class="form-group">
      <MoloInput
          tLabel="Описание"
          v-model="formData.description"
          placeholder="Опишите функциональность модуля"
      />

    </div>

    <hr>

    <div class="form-group">
      <div class="code-header">
        <button
            v-if="formData.format === 'vue'"
            class="action-btn confirm"
            @click="openPreviewInWindow"
        >
          Открыть предпоказ
        </button>
        <button
            class="action-btn confirm"
            @click="toggleDocumentation"
        >
          {{ showDocumentation ? 'Закрыть документацию' : 'Открыть документацию' }}
        </button>

      </div>
      <span>Код модуля *</span>
      <section class="code-container">
        <div class="editor-wrapper" :class="{ 'with-docs': showDocumentation }">
          <vue-monaco-editor
              ref="monacoRef"
              v-model:value="formData.code"
              :theme="'vs-dark'"
              :language="editorLanguage"
              :options="MONACO_EDITOR_OPTIONS"
              class="monaco-editor-container"
          />
        </div>
        <div class="documentation" v-show="showDocumentation">
          <MoloDocumentation/>
        </div>
      </section>

    </div>

    <hr>

    <button type="submit" class="action-btn confirm" :disabled="loading" @click="saveModule">

      <div v-if="loading" class="modern-loader"></div>
      <span v-else> {{ isEditing ? 'Обновить' : 'Создать' }} </span>
    </button>
  </section>
</template>

<style scoped>
.mode-switcher {
  display: flex;
  gap: 10px;
  padding: 10px 0;
}

.editor-wrapper {
  display: flex;
  width: 100%;
  height: 600px;
  position: relative;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  gap: 0;
  transition: gap 0.2s ease;
}

.editor-wrapper.with-docs {
  gap: 1px;
}

.code-container {
  display: flex;
  height: 600px;
  width: 100%;
  overflow: hidden;
}

.editor-wrapper {
  display: flex;
  flex: 1;
  height: 100%;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  overflow: hidden;

}

.monaco-editor-container {
  flex: 1;
  height: 100%;
  width: 100%;
}

.documentation {
  flex: 0 0 700px;
  width: 350px;
  background-color: #1e1e1e;
  border-left: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.documentation-header h3 {
  margin: 0;
  color: #fff;
  font-size: 14px;
}

.documentation-content ul {
  margin-top: 12px;
  padding-left: 20px;
}

.documentation-content li {
  margin: 8px 0;
}

.documentation-content code {
  background-color: #2d2d2d;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  color: #d4d4d4;
}

.form-row {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.code-header {
  display: flex;
  justify-content: space-between;
}

/* Адаптив для маленьких экранов */
@media (max-width: 768px) {
  .editor-wrapper.with-docs {
    flex-direction: column;
  }

  .documentation {
    border-left: none;
    border-top: 1px solid #3c3c3c;
    max-height: 300px;
  }
}
</style>