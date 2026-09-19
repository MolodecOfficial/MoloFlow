<script setup lang="ts">
import {computed, onMounted} from 'vue'
import {useAppStore} from '~~/stores/appStore'
import { useWindowManager } from "~~/app/composables/window/useWindowManager";

const {openWindow} = useWindowManager()
const {addNotification} = useNotifications('Управление предприятием')
const {addLog} = useLogger('Управление предприятием')

const store = useAppStore()

const enterpriseInfo = computed(() => store.enterpriseData)
const isAuthenticated = computed(() => store.isEnterpriseLoaded)
const tabs = computed(() => store.tabs)
const loading = computed(() => store.tabsLoading)

function notAuth() {
  openWindow('login', null,  {
    width: 400,
    height: 450,
    minWidth: 350,
    minHeight: 400
  })
}

function openWorkspace() {
  if (!store.getEnterpriseId()) {
    addNotification('error', 'Не удалось определить предприятие')
    return
  }
  openWindow(
      'workspace',
      null,
      {
        width: 1200,
        height: 800,
        minWidth: 700,
        minHeight: 480
      }
  )
}

onMounted(() => {
  store.loadEnterpriseFromStorage()
  if (store.getEnterpriseId()) {
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
      <UIMoloButton class="confirm" @click="notAuth">Войти</UIMoloButton>
    </div>

    <UIMoloSection v-else-if="enterpriseInfo">
      <template #header>
        <span style="font-weight: bold; font-size: 22px">
          {{ enterpriseInfo.ownershipForm }} {{ enterpriseInfo.enterpriseName }}
        </span>
        <UIMoloButton class="confirm" @click="openWorkspace">
          Пространство
        </UIMoloButton>
      </template>
      <template #main>
        <div class="details">
          <section class="main-details">
            <span>ИНН: {{ enterpriseInfo.inn }}</span>
            <span>ОГРН: {{ enterpriseInfo.ogrn }}</span>
            <span>КПП: {{ enterpriseInfo.kpp }}</span>
          </section>
          <section class="director">
            <span>Директор: {{ enterpriseInfo.director }}</span>
          </section>
        </div>
      </template>
    </UIMoloSection>
    <hr>
    <UIMoloSection v-if="enterpriseInfo">
      <template #header>
        <section class="tabs-length">
          <span>Вкладки</span>
          <span class="counter">{{ tabs.length }}</span>
        </section>
        <UIMoloButton class="confirm small" @click="openConfigurator">Создать</UIMoloButton>
      </template>
      <template #main>
        <UIMoloLoaders wndLoader v-if="loading"/>
        <div v-else-if="tabs.length === 0" class="empty">
          <p>Нет вкладок</p>
        </div>
      </template>
    </UIMoloSection>
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

.details {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #8e8e9e;
  justify-content: space-between;
}

.main-details {
  display: flex;
  gap: 10px;
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
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #6e6e7e;
}

/* ========================================
   АДАПТИВНОСТЬ
======================================== */
@media (max-width: 640px) {
  .control-page {
    padding: 12px;
    gap: 14px;
  }

  .details {
    flex-direction: column;
    gap: 10px;
  }

  .main-details {
    flex-direction: column;
    gap: 4px;
  }

  .tabs-length {
    flex-wrap: wrap;
  }

  .auth-placeholder {
    padding: 40px 16px;
  }
}

@media (max-width: 480px) {
  .control-page :deep(.form-header) {
    flex-direction: column;
    align-items: stretch;
  }

  .control-page :deep(.form-header span) {
    font-size: 18px !important;
  }

  .control-page :deep(.molo-btn) {
    width: 100%;
  }
}
</style>