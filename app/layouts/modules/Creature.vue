<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const showPreview = ref(false)
const enterpriseInfo = ref<any>(null)

const { addNotification } = useNotifications()

// 🔥 список модулей
const modules = ref<any[]>([])
const selectedModuleId = ref<string | null>(null)

// 🔥 режим
const isEditing = computed(() => !!selectedModuleId.value)

const availableFormats = [
  { label: '.vue', value: 'vue' },
  { label: '.js', value: 'js' },
  { label: '.ts', value: 'ts' }
]

const formData = ref({
  name: '',
  description: '',
  format: 'vue',
  code: ''
})

// 🔥 placeholder
const getPlaceholder = () => {
  if (formData.value.format === 'vue') {
    return `<script setup>
import { ref } from 'vue'

const message = ref('Hello from dynamic module!')

const handleClick = () => {
  message.value = 'Clicked!'
}
<\/script>

<template>
  <div>
    <h1>{{ message }}</h1>
    <button @click="handleClick">Click me</button>
  </div>
</template>`
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

const saveModule = async () => {
  loading.value = true

  const wasEditing = isEditing.value // 🔥 фиксируем

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

watch(() => formData.value.format, () => {
  if (!isEditing.value) {
    formData.value.code = getPlaceholder()
  }
})
</script>

<template>
  <h1>{{ isEditing ? 'Редактирование модуля' : 'Создание модуля' }}</h1>
  <hr>

  <!-- 🔥 переключатель -->
  <div class="mode-switcher">
    <button
        type="button"
        class="action-btn confirm"
        @click="selectedModuleId = null"
    >
      Новый модуль
    </button>

    <MoloSelect
      v-model="selectedModuleId"
      disabled="Или выберите модуль"
      :parent="modules"
      children="name"
      valueKey="_id"
      />
  </div>

  <form @submit.prevent="saveModule" class="editor-form">
    <div class="form-row">
      <div class="form-group flex-1">
        <MoloInput
            tLabel="Название модуля"
            lRequired
            v-model="formData.name"
            type="text"
            placeholder="Введите название модуля"
            :disabled="isEditing"
        />
      </div>

      <div class="form-group format-select">
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
    </div>

    <div class="form-group">
      <MoloInput
          tLabel="Описание"
          v-model="formData.description"
          placeholder="Опишите функциональность модуля"
      />
    </div>

    <div class="form-group">
      <label>Код модуля *</label>
      <div class="code-editor-wrapper">
        <div class="code-header">
          <span class="code-language">
            Формат файла - {{ formData.format.toLowerCase() }}
          </span>

          <button
              type="button"
              class="action-btn confirm"
              @click="showPreview = !showPreview"
              v-if="formData.format === 'vue'"
          >
            {{ showPreview ? 'Скрыть предпросмотр' : 'Показать предпросмотр' }}
          </button>
        </div>

        <textarea
            v-model="formData.code"
            class="code-editor"
            :placeholder="getPlaceholder()"
            rows="18"
        ></textarea>
      </div>
    </div>

    <hr>

    <div v-if="formData.format === 'vue' && showPreview">
      <h2>Предпросмотр</h2>
      <div class="preview-container">
        <div class="preview-placeholder">
          <p>Предпросмотр будет доступен после сохранения</p>
        </div>
      </div>
    </div>

      <button type="submit" class="action-btn confirm" :disabled="loading">
        {{ loading ? 'Сохранение...' : (isEditing ? 'Обновить' : 'Создать') }}
      </button>
  </form>
</template>

<style scoped>
.mode-switcher {
  display: flex;
  gap: 10px;
  padding: 10px 0;
}


.form-row {
  display: flex;
  gap: 20px;
}

.flex-1 {
  flex: 1;
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

.code-editor {
  box-sizing: border-box;
  width: 100%;
  background: #1e1e1e;
  color: #d4d4d4;
  border: none;
  font-family: monospace;
  padding: 10px;
}

.code-header {
  display: flex;
  justify-content: space-between;
}
</style>