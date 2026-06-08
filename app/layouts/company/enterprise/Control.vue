<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAppStore } from '~~/stores/appStore'

const { openWindow } = useWindowManager()
const { addNotification } = useNotifications('Управление предприятием')
const { addLog } = useLogger('Управление предприятием')

const store = useAppStore()

const enterpriseInfo = computed(() => store.enterpriseData)
const isAuthenticated = computed(() => store.isEnterpriseLoaded)
const tabs = computed(() => store.tabs)
const loading = computed(() => store.tabsLoading)

function notAuth() {
  openWindow('company', 'login', 'enterprise', {
    width: 400,
    height: 450,
    minWidth: 350,
    minHeight: 400
  })
}

function openConfigurator() {
  if (!store.getEnterpriseId()) {
    addNotification('error', 'Не удалось определить предприятие')
    return
  }

  openWindow(
      'company',
      'configurator',
      'enterprise',
      {
        width: 900,
        height: 500,
        minWidth: 900,
        minHeight: 500
      },
      false,
      'enterprise/configurator',
      null,
      {},
      'Конфигуратор'
  )
}

function openTabData(tab: any) {
  if (!store.getEnterpriseId()) return

  store.preloadTabData(tab._id)

  openWindow(
      'company',
      `Tab-data`,
      'enterprise',
      { width: 800, height: 600, minWidth: 600, minHeight: 400 },
      false,
      null,
      null,
      { tabId: tab._id, tabName: tab.name },
      `Данные: ${tab.name}`
  )
}

onMounted(() => {
  store.loadEnterpriseFromStorage()
  if (store.getEnterpriseId()) {
    store.loadTabs()
    store.preloadAllTabsData()
  } else {
    addLog('warning', 'Не авторизован в предприятии')
  }
})
</script>

<template>
  <div class="control-page">
    <div v-if="!isAuthenticated" class="auth-placeholder">
      <div class="auth-icon">🔒</div>
      <h3>Вы не авторизованы</h3>
      <p>Для работы с вкладками необходимо войти в предприятие</p>
      <MoloButton class="confirm" @click="notAuth">Войти</MoloButton>
    </div>

    <div v-else-if="enterpriseInfo" class="content">
      <div class="header">
        <div class="title-section">
          <h1>{{ enterpriseInfo.ownershipForm }} {{ enterpriseInfo.enterpriseName }}</h1>
          <div class="details">
            <span>ИНН: {{ enterpriseInfo.inn }}</span>
            <span v-if="enterpriseInfo.ogrn">ОГРН: {{ enterpriseInfo.ogrn }}</span>
          </div>
        </div>
        <MoloButton class="confirm" @click="openConfigurator">
          Конфигуратор
        </MoloButton>
      </div>

      <hr>

      <div class="tabs-section">
        <div class="tabs-header">
          <section class="tabs-length">
            <span>Вкладки</span>
            <span class="counter">{{ tabs.length }}</span>
          </section>
          <MoloButton class="confirm small" @click="openConfigurator">Создать</MoloButton>
        </div>
        <MoloLoaders wndLoader v-if="loading"/>
        <div v-else-if="tabs.length === 0" class="empty">
          <p>Нет вкладок</p>
        </div>

        <div v-else class="tabs-list">
          <button
              v-for="tab in tabs"
              :key="tab._id"
              class="tab-row"
              @click="openTabData(tab)"
          >
            <div class="tab-icon" :style="{ backgroundColor: tab.color || '#6496ff' }">
              <span class="material-icons">{{ tab.name.charAt(0) }}</span>
            </div>
            <div class="tab-info">
              <div class="tab-name">{{ tab.name }}</div>
              <div class="tab-meta">
                <span> {{ tab.description }} </span>
              </div>
            </div>
            <div class="arrow">→</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.control-page {
  padding: 20px;
  min-height: 100%;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border: 1px solid var(--half_opacity_border);
  padding: 20px;
  border-radius: 10px;
  background: var(--half_opacity_bg);
}

.title-section h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.details {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #8e8e9e;
}

.tabs-section {
  background: var(--half_opacity_bg);
  border-radius: 12px;
  border: 1px solid var(--half_opacity_border);
  overflow: hidden;
}

.tabs-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  justify-content: space-between;
}

.tabs-length {
  display: flex;
  align-items: center;
  gap: 10px;
}

.counter {
  font-size: 12px;
  border-radius: 20px;
  color: #8e8e9e;
}

.tabs-list {
  display: flex;
  flex-direction: column;
}

.tab-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #1e1e24;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background 0.15s;
}

.tab-row:last-child {
  border-bottom: none;
}

.tab-row:hover {
  background: #1c1c22;
}

.tab-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.tab-icon .material-icons {
  font-size: 20px;
  color: white;
}

.tab-info {
  flex: 1;
  min-width: 0;
}

.tab-name {
  font-size: 15px;
  font-weight: 500;
  color: white;
  margin-bottom: 6px;
}

.tab-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #6e6e7e;
}

.tab-meta span {
  background: #1e1e24;
  padding: 2px 8px;
  border-radius: 12px;
}

.arrow {
  color: #4a4a54;
  font-size: 16px;
  transition: transform 0.15s;
}

.tab-row:hover .arrow {
  transform: translateX(4px);
  color: #6496ff;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid #2a2a30;
  border-top-color: #6496ff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 20px;
  background: var(--half_opacity_bg);
  border-radius: 16px;
  border: 1px solid var(--half_opacity_border);
}

.auth-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.auth-placeholder h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.auth-placeholder p {
  margin: 0 0 24px;
  color: #8e8e9e;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #6e6e7e;
}

.empty p {
  margin: 0 0 16px;
}
</style>