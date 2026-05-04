<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useNotifications } from '~/composables/useNotifications'

type Field = {
  key: string
  type: 'text' | 'select'
  label?: string
  placeholder?: string
  required?: boolean
  options?: any[]
  optionLabel?: string
  optionValue?: string
  optionSource?: (form: any, props: any) => any[]
}

const props = defineProps<{
  windowData?: {
    message?: string
    fields?: Field[]
    onConfirm?: (payload: Record<string, any>) => Promise<void>
  }
}>()

const emit = defineEmits(['close'])

const { addNotification } = useNotifications('Подтверждение')
const { addLog } = useLogger('Подтверждение')

const isLoading = ref(false)

const form = reactive<Record<string, any>>({})

const init = () => {
  const fields = props.windowData?.fields || []
  fields.forEach(f => {
    form[f.key] = ''
  })
}

init()

watch(() => form.groupId, () => {
  form.parentId = null
})

const getFieldOptions = (field: Field) => {
  if (field.optionSource && typeof field.optionSource === 'function') {
    return field.optionSource(form, props)
  }
  return field.options || []
}

const validate = () => {
  const fields = props.windowData?.fields || []
  for (const f of fields) {
    if (f.required && !form[f.key]) {
      addNotification('warning', `Заполните: ${f.label || f.key}`)
      return false
    }
  }
  return true
}

const extractValue = (value: any, optionValue?: string): any => {
  if (value && typeof value === 'object') {
    if (optionValue && value[optionValue] !== undefined) {
      return value[optionValue]
    }
    return value.id ?? value._id ?? null
  }
  // Если строка вида "[object Object]" — сбрасываем в null
  if (typeof value === 'string' && value === '[object Object]') {
    return null
  }
  return value
}

const handleConfirm = async () => {
  if (!props.windowData?.onConfirm) return
  if (!validate()) return

  const payload = { ...form }
  const fields = props.windowData?.fields || []

  for (const field of fields) {
    if (field.type === 'select') {
      payload[field.key] = extractValue(payload[field.key], field.optionValue)
    }
  }
  addLog('success', `Действие подтверждено`)

  isLoading.value = true
  try {
    await props.windowData.onConfirm(payload)
    emit('close')
  } catch (e: any) {
    addNotification('error', e?.message || 'Ошибка')
  } finally {
    isLoading.value = false
  }
}

const handleCancel = () => emit('close')
</script>

<template>
  <div class="confirm-body">
    <p class="confirm-message">
      {{ windowData?.message || 'Подтверждение действия' }}
    </p>

    <div v-for="field in windowData?.fields || []" :key="field.key" class="field">
      <MoloInput
          v-if="field.type === 'text'"
          v-model="form[field.key]"
          :tLabel="field.label"
          :placeholder="field.placeholder"
          :lRequired="field.required"
      />

      <MoloSelect
          v-if="field.type === 'select'"
          v-model="form[field.key]"
          :parent="getFieldOptions(field)"
          :children="field.optionLabel || 'label'"
          :valueKey="field.optionValue || 'value'"
      />
    </div>
  </div>

  <hr />

  <div class="confirm-actions">
    <button class="action-btn" @click="handleCancel">Отмена</button>
    <button class="action-btn confirm" @click="handleConfirm" :disabled="isLoading">
      {{ isLoading ? 'Выполнение...' : 'Подтвердить' }}
    </button>
  </div>
</template>

<style scoped>
.confirm-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.confirm-message {
  color: white;
  font-size: 14px;
  text-align: center;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
}
</style>