<script setup lang="ts">
import { onMounted, computed } from 'vue'
import MockDataPreview from '~~/app/components/MockDataPreview.vue'
import { useAppStore } from '~~/stores/appStore'

const props = defineProps<{
  tabId?: string
  tabName?: string
  windowId?: string
}>()

const { addNotification } = useNotifications('Данные вкладки')
const store = useAppStore()

// Просто берём tabId из props
const targetTabId = computed(() => props.tabId || '')
const targetTabName = computed(() => props.tabName || '')

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

  store.setCurrentTab(tabId)
  await store.loadTabById(tabId)
  await store.loadStandards(tabId)
  await store.loadEntries(tabId)
}

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="tab-data">
    <div class="tab-data-header">
      <h2>{{ targetTabName || store.currentTabName || 'Данные вкладки' }}</h2>
      <div v-if="store.hasStandards" class="standard-selector">
        <label>Стандарт отображения:</label>
        <select v-model="store.currentStandard">
          <option v-for="s in store.standards" :key="s._id" :value="s">
            {{ s.name }} {{ s.isDefault ? '(по умолчанию)' : '' }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="store.entriesLoading" class="loading">Загрузка...</div>
    <div v-else-if="!store.currentTab" class="error">Вкладка не найдена</div>
    <div v-else-if="store.currentStandard" class="preview-container">
      <!-- Всегда показываем предпросмотр, даже если нет записей -->
      <MockDataPreview
          :fields="store.currentTabFields"
          :viewType="store.currentStandard.type"
          :standard="store.currentStandard"
          :rowsCount="5"
          :realData="store.hasEntries ? store.entries : undefined"
      />
      <div v-if="!store.hasEntries" class="empty-entries-note">
        ⚡ Нет записей. Показываются демо-данные для настройки внешнего вида.
      </div>
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
  background: #0f0f12;
  min-height: 100%;
}
.tab-data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}
.tab-data-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}
.standard-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1a1a1f;
  padding: 6px 12px;
  border-radius: 8px;
}
.standard-selector label {
  font-size: 13px;
  color: #8e8e9e;
}
.standard-selector select {
  background: #25252c;
  border: 1px solid #3a3a44;
  padding: 6px 10px;
  border-radius: 6px;
  color: white;
  font-size: 13px;
}
.loading,
.empty,
.error {
  text-align: center;
  padding: 40px;
  color: #8e8e9e;
}
.preview-container {
  background: #0c0c10;
  border-radius: 12px;
  overflow: hidden;
}
.empty-entries-note {
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: #6496ff;
  background: rgba(100, 150, 255, 0.1);
  border-top: 1px solid #25252c;
}
</style>