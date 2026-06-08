<script setup lang="ts">
import { onMounted, computed, watch } from 'vue'
import MockDataPreview from '~~/app/components/MockDataPreview.vue'
import { useAppStore } from '~~/stores/appStore'

const props = defineProps<{
  tabId?: string
  tabName?: string
  windowId?: string
}>()

const { addNotification } = useNotifications('Данные вкладки')
const { addLog } = useLogger('Данные вкладки')
const store = useAppStore()

const targetTabId = computed(() => props.tabId || '')
const targetTabName = computed(() => props.tabName || '')
const loading = ref(false)

async function loadAll() {
  if (!store.getEnterpriseId()) {
    store.loadEnterpriseFromStorage()
  }

  const enterpriseId = store.getEnterpriseId()
  const tabId = targetTabId.value

  if (!enterpriseId) {
    addNotification('error', 'Не удалось определить предприятие')
    return
  }

  if (!tabId) {
    addNotification('error', 'Не указана вкладка')
    return
  }

  loading.value = true
  addLog('info', `Загрузка данных для вкладки`)

  try {
    store.setCurrentTab(tabId)

    await Promise.all([
      store.loadTabById(tabId),
      store.loadStandards(tabId),
      store.loadEntries(tabId)
    ])

    addLog('success', `Данные загружены`)
  } catch (error: any) {
    addLog('error', error.message)
    addNotification('error', 'Ошибка загрузки данных')
  } finally {
    loading.value = false
  }
}

watch(targetTabId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    loadAll()
  }
})

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="tab-data">
    <MoloLoaders wndLoader v-if="loading" class="loading">
    </MoloLoaders>
    <div v-else-if="!store.currentTab" class="error">
      <span>⚠️</span>
      <p>Вкладка не найдена</p>
    </div>
    <div v-else-if="!store.hasStandards" class="empty">
      <span>📭</span>
      <p>Нет стандартов отображения</p>
      <small>Создайте стандарт в конструкторе вкладок</small>
    </div>
    <div v-else-if="store.currentStandard" class="preview-container">
      <MockDataPreview
          :fields="store.currentTabFields"
          :groups="store.currentTab?.groups || []"
          :viewType="store.currentStandard.type"
          :standard="store.currentStandard"
          :rowsCount="store.hasEntries ? undefined : 5"
          :realData="store.hasEntries ? store.entries : undefined"
      />
    </div>
    <div v-else class="empty">
      <p>Нет стандартов отображения. Создайте стандарт в конструкторе.</p>
    </div>
  </div>
</template>

<style scoped>
.tab-data {
  padding: 20px;
  color: #e0e0e0;
  min-height: 100%;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 60px 20px;
  color: #8e8e9e;
}

.empty span,
.error span {
  font-size: 48px;
  opacity: 0.5;
}

.empty p,
.error p {
  margin: 0;
  font-size: 16px;
}

.empty small {
  font-size: 12px;
  color: #555;
}

.preview-container {
  border-radius: 12px;
  overflow: hidden;
}
</style>