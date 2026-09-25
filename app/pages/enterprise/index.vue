<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useHead } from '#imports'
import { useNotifications } from '~/composables/useNotifications'
import { useWindowManager } from '~/composables/window/useWindowManager'
import { readDrag, consumePinnedCallback } from '~/composables/window/useDragPayload'
import { usePinnedItems } from '~/composables/window/usePinnedItems'
import { useLogger } from '~/composables/useLogger'
import logo from '~~/public/logo.ico'
import { useAppStore } from '~~/stores/appStore'

const isLoading = ref(true)
const dataPreloadStarted = ref(false)

const {
  windows,
  openWindow,
  closeWindow,
  focusWindow,
  minimizeWindow,
  moveWindow,
  resizeWindow,
  maximizeWindow
} = useWindowManager()

const appStore = useAppStore()
const router = useRouter()
const { pin } = usePinnedItems()
const { notifications, removeNotification } = useNotifications('Главная страница')
const { addLog } = useLogger('Предприятие')

// Реактивные данные из единого appStore
const name = computed(() => appStore.currentUser?.name || 'Гость')
const role = computed(() => appStore.currentMemberRole || appStore.currentUser?.role || 'Пользователь')
const enterpriseName = computed(() => appStore.enterpriseName)

useHead({
  title: computed(() => `Предприятие — ${enterpriseName.value || 'Загрузка...'}`)
})

const loadUserData = () => {
  appStore.loadEnterpriseFromStorage()
  isLoading.value = false
}

function onWorkspaceDrop(e: DragEvent) {
  const payload = readDrag(e)
  if (!payload?.type) return

  const workspace = e.currentTarget as HTMLElement
  const rect = workspace.getBoundingClientRect()

  const width = payload.width
  const height = payload.height

  const position = {
    x: e.clientX - rect.left - width / 2,
    y: e.clientY - rect.top - height / 2,
  }

  pin(
      payload.type,
      payload,
      position,
      {
        width: payload.width,
        height: payload.height,
      },
      payload.windowKey
  )

  consumePinnedCallback(payload.dragId)
}

const openSettings = () => {
  openWindow('customisation')
}

// Предзагрузка данных предприятия в фоне
const preloadEnterpriseData = async () => {
  if (dataPreloadStarted.value) return
  dataPreloadStarted.value = true

  addLog('info', 'Начинаем предзагрузку данных предприятия...')
  try {
    if (!appStore.getEnterpriseId()) {
      appStore.loadEnterpriseFromStorage()
    }
    addLog('success', `Информация предприятия ${enterpriseName.value} загружена!`)
  } catch (error) {
    addLog('error', 'Ошибка при предзагрузке данных предприятия')
    console.error(error)
  }
}

const handleStorageChange = async (e: StorageEvent) => {
  if (e.key === 'currentEnterprise' || e.key === 'user') {
    loadUserData()
    if (e.key === 'currentEnterprise') {
      dataPreloadStarted.value = false
      await preloadEnterpriseData()
    }
  }
}

const handleEnterpriseUpdate = async () => {
  loadUserData()
  dataPreloadStarted.value = false
  await preloadEnterpriseData()
}

onMounted(async () => {
  loadUserData()
  await preloadEnterpriseData()

  window.addEventListener('storage', handleStorageChange)
  window.addEventListener('enterprise-login', handleEnterpriseUpdate)
  window.addEventListener('enterprise-logout', handleEnterpriseUpdate)
  window.addEventListener('enterprise-updated', handleEnterpriseUpdate)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
  window.removeEventListener('enterprise-login', handleEnterpriseUpdate)
  window.removeEventListener('enterprise-logout', handleEnterpriseUpdate)
  window.removeEventListener('enterprise-updated', handleEnterpriseUpdate)
})

function deleteUser() {
  appStore.clearSession()
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user')
    localStorage.removeItem('currentEnterprise')
    localStorage.removeItem('enterprise_token')
    window.dispatchEvent(new Event('enterprise-logout'))
  }
  router.push('/')
}
</script>

<template>
  <MoloGuard :allowedRoles="['Администратор', 'Управляющий', 'Бухгалтер', 'Программист', 'Сотрудник', 'Наблюдатель', 'Пользователь']">
    <div class="enterprise-container">
      <!-- Фон -->
      <div class="background">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <img :src="logo" class="background-logo" alt="Logo" />
      </div>

      <!-- Уведомления -->
      <div class="notifications-wrapper">
        <LayoutMoloNotice
            v-for="(notification, index) in notifications"
            :key="notification.id"
            :notice_type="notification.type"
            :notice_title="notification.title"
            :notice_text="notification.text"
            :index="index"
            :total="notifications.length"
            @close="removeNotification(notification.id)"
        />
      </div>

      <!-- Логгер -->
      <div class="logger-wrapper">
        <LayoutMoloLogger />
      </div>

      <!-- Загрузка -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-card">
          <div class="loading-spinner"></div>
          <span class="loading-text">Загружаем рабочее пространство...</span>
        </div>
      </div>

      <!-- Контент -->
      <div v-else class="content">
        <!-- Верхняя панель -->
        <header class="topbar">
          <div class="brand">
            <div class="brand-text">
              <h1 class="enterprise-title">MF:Предприятие</h1>
              <p class="enterprise-subtitle">{{ enterpriseName }}</p>
            </div>
          </div>

          <div class="user-section">
            <div class="user-card">
              <div class="user-avatar" @click="openSettings">
                {{ name?.charAt(0)?.toUpperCase() || 'U' }}
              </div>

              <div class="user-info">
                <p class="greeting">Добро пожаловать</p>
                <p class="user-name">{{ name }}</p>
              </div>
            </div>

            <UIMoloButton @click="deleteUser" class="close">
              <span>Выйти</span>
            </UIMoloButton>
          </div>
        </header>

        <!-- Основная рабочая зона -->
        <main
            class="workspace"
            @dragover.prevent
            @drop="onWorkspaceDrop"
        >
          <DekstopMoloPinnedLayer />

          <section class="workspace-header">
            <MoloMenu
                :role="role"
                @open-window="openWindow"
            />
            <LayoutMoloToolbar />
          </section>

          <WindowWindowsManager
              :windows="windows"
              @close="closeWindow"
              @focus="focusWindow"
              @minimize="minimizeWindow"
              @move="moveWindow"
              @resize="resizeWindow"
              @maximize="maximizeWindow"
              @open-window="openWindow"
          />
        </main>
      </div>
    </div>
  </MoloGuard>
</template>

<style scoped>
/* ========================================
   БАЗОВЫЙ КОНТЕЙНЕР
======================================== */
.enterprise-container {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
      radial-gradient(circle at top left, rgba(56, 114, 239, 0.08), transparent 40%),
      radial-gradient(circle at bottom right, rgba(120, 119, 198, 0.08), transparent 40%),
      linear-gradient(135deg, #09090b 0%, #111827 45%, #0f172a 100%);
  color: #ffffff;
}

/* ========================================
   ФОН
======================================== */
.background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.background-logo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(34vw, 420px);
  transform: translate(-50%, -50%);
  opacity: 0.035;
  filter: grayscale(1) blur(1px);
  user-select: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.18;
  animation: float 18s ease-in-out infinite;
}

.orb-1 {
  width: 320px;
  height: 320px;
  top: 8%;
  left: 6%;
  background: #3872ef;
}

.orb-2 {
  width: 260px;
  height: 260px;
  right: 10%;
  top: 15%;
  background: #7c3aed;
  animation-delay: -6s;
}

.orb-3 {
  width: 340px;
  height: 340px;
  bottom: 8%;
  left: 30%;
  background: #0ea5e9;
  animation-delay: -12s;
}

@keyframes float {
  0%, 100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(0, -20px, 0) scale(1.06);
  }
}

/* ========================================
   УВЕДОМЛЕНИЯ
======================================== */
.notifications-wrapper {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  z-index: 1000;
  pointer-events: none;
}

.notifications-wrapper > * {
  pointer-events: auto;
}

/* ========================================
   ЛОГГЕР
======================================== */
.logger-wrapper {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 1000;
  animation: slideInLeft 0.35s ease-out;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ========================================
   СОСТОЯНИЕ ЗАГРУЗКИ
======================================== */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 32px 36px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.loading-spinner {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: #3872ef;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  letter-spacing: 0.02em;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ========================================
   ОСНОВНОЙ КОНТЕНТ
======================================== */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ========================================
   ВЕРХНЯЯ ПАНЕЛЬ
======================================== */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 24px 28px;
  border-radius: 28px;
  -webkit-backdrop-filter: blur(22px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.brand-text {
  min-width: 0;
}

.enterprise-title {
  margin: 0;
  font-size: clamp(1.55rem, 3vw, 2.35rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #ffffff;
}

.enterprise-subtitle {
  margin: 6px 0 0;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.3s ease;
}

/* ========================================
   БЛОК ПОЛЬЗОВАТЕЛЯ
======================================== */
.user-section {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  border-radius: 10px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 8px 8px;
  border-radius: 18px;
}

.user-avatar {
  cursor: pointer;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  color: #ffffff;
  animation: aaaaa 1s infinite ease-in-out;
}

@keyframes aaaaa {
  0% {
    background: linear-gradient(135deg, #3872ef, #7c3aed);
  }
  100% {
    background: linear-gradient(135deg, #7c3aed, #3872ef);
  }
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.greeting {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.user-name {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
}

/* ========================================
   РАБОЧАЯ ОБЛАСТЬ
======================================== */
.workspace {
  position: relative;
  flex: 1;
  min-height: calc(100vh - 160px);
  box-sizing: border-box;
  overflow: hidden;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
}

/* ========================================
   АДАПТИВНОСТЬ
======================================== */
@media (max-width: 1024px) {
  .topbar {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
  }

  .user-section {
    justify-content: space-between;
  }
}

@media (max-width: 768px) {
  .topbar {
    margin: 12px;
    padding: 18px;
    border-radius: 22px;
  }

  .workspace {
    padding: 0 12px 12px;
    min-height: calc(100vh - 220px);
  }

  .user-section {
    flex-direction: column;
    align-items: stretch;
  }

  .logger-wrapper {
    left: 12px;
    bottom: 12px;
  }

  .notifications-wrapper {
    right: 12px;
    bottom: 12px;
  }

  .background-logo {
    width: 60vw;
  }
}

@media (max-width: 480px) {
  .enterprise-title {
    font-size: 1.4rem;
  }

  .enterprise-subtitle {
    font-size: 0.85rem;
  }

  .user-card {
    width: 100%;
  }

  .user-info {
    min-width: 0;
  }

  .user-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-avatar {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
  }

  .content {
    min-height: 100dvh;
  }
}

@supports (padding: max(0px)) {
  .topbar {
    padding-top: max(24px, env(safe-area-inset-top));
    padding-left: max(28px, env(safe-area-inset-left));
    padding-right: max(28px, env(safe-area-inset-right));
  }

  @media (max-width: 768px) {
    .topbar {
      padding-top: max(18px, env(safe-area-inset-top));
      padding-left: max(18px, env(safe-area-inset-left));
      padding-right: max(18px, env(safe-area-inset-right));
    }
  }

  .notifications-wrapper {
    bottom: max(16px, env(safe-area-inset-bottom));
  }

  .logger-wrapper {
    bottom: max(20px, env(safe-area-inset-bottom));
  }
}

@media (max-width: 360px) {
  .enterprise-title {
    font-size: 1.2rem;
  }
  .user-section {
    gap: 10px;
  }
}
</style>