<script setup lang="ts">
import { ref } from 'vue'
import { useNotifications } from '~/composables/useNotifications'

const props = defineProps<{
  windowId?: string
  groupId?: string
  subGroupId?: string
  windowData?: {
    type: any
    item: any
    onConfirm?: () => Promise<void>
    message?: string
  }
}>()

const emit = defineEmits<{
  close: []
}>()

const { addNotification } = useNotifications()
const isLoading = ref(false)

const handleConfirm = async () => {
  if (!props.windowData?.onConfirm) return

  isLoading.value = true
  try {
    await props.windowData.onConfirm()
    emit('close')
  } catch (error: any) {
    addNotification('ERROR_DEFAULT', error.message || 'Ошибка при удалении')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="confirm-body">
    <p class="confirm-message">{{ windowData?.message }}</p>
  </div>
  <div class="confirm-actions">
    <button class="action-btn confirm" @click="handleConfirm" :disabled="isLoading">
      {{ isLoading ? 'Удаление...' : 'Удалить' }}
    </button>
  </div>
</template>

<style scoped>

</style>