<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, unref } from 'vue'
import { useRouter, useHead, useRuntimeConfig } from '#imports'
import { useNotifications } from '~/composables/useNotifications'
import { useWindowManager } from '~/composables/window/useWindowManager'
import { readDrag, consumePinnedCallback } from '~/composables/window/useDragPayload'
import { usePinnedItems } from '~/composables/window/usePinnedItems'
import { useLogger } from '~/composables/useLogger'
import logo from '~~/public/logo.ico'
import { useAppStore, SESSION_FP_KEY } from '~~/stores/appStore'
import { useAccessSync } from '~/composables/window/useAccessSync'
import { ROLE_DEFAULT_PERMISSIONS, type UserRole } from '~/types/permissions'

const config = useRuntimeConfig()
const appStore = useAppStore()
const router = useRouter()
const { pin } = usePinnedItems()
const { notifications, addNotification, removeNotification } = useNotifications('Главная страница')
const { addLog } = useLogger('Предприятие')

// Версионирование
const localRawVersion = computed(() => String(config.public?.appVersion || '1.0.0').replace(/^v/, '').trim())
const appVersion = computed(() => `v${localRawVersion.value}`)

const latestRemoteVersion = ref<string | null>(null)
const updateNotes = ref('')
const hasNewUpdate = ref(false)
const downloadUrl = ref<string | null>(null)

// Стейт строки загрузки
const isDownloading = ref(false)
const downloadPercent = ref(0)
const transferredMb = ref('0')
const totalMb = ref('0')
const isReadyToInstall = ref(false)

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

// Фоновая сверка роли/прав с сервером (таймер + возврат фокуса окну)
useAccessSync()

/** Закрывает все открытые окна (в т.ч. восстановленные из прошлого сеанса) */
const closeAllWindows = () => {
  const list = unref(windows) as any[]
  if (!Array.isArray(list)) return
  for (const w of [...list]) {
    const id = w?.id ?? w?.windowId ?? w?.key
    if (id !== undefined && id !== null) closeWindow(id)
  }
}

// Диагностика: если сервер не отдаёт права, причина попадёт в журнал
watch(() => appStore.accessError, (err) => {
  if (err) addLog('warning', `Синхронизация прав не удалась (${err})`)
})

let roleWatchArmed = false
let manualLogout = false

const announceRoleChange = (from?: string | null, to?: string | null) => {
  if (!from || !to || from === to) return
  const before = ROLE_DEFAULT_PERMISSIONS[from as UserRole] || []
  const after = ROLE_DEFAULT_PERMISSIONS[to as UserRole] || []
  const lostRights = before.some(p => !after.includes(p))

  addNotification('info', `Ваша роль изменена: ${from} → ${to}`)
  addLog('info', `Роль изменена: ${from} → ${to}`)

  // Если права урезали — закрываем окна, чтобы не остались открытыми заблокированные разделы
  if (lostRights) closeAllWindows()
}

// Первая сверка с сервером завершена: сравниваем с прошлым сеансом
watch(
    () => appStore.sessionChecked,
    (checked) => {
      if (!checked || !import.meta.client) return

      const prev = localStorage.getItem(SESSION_FP_KEY)
      const cur = appStore.sessionFingerprint

      if (prev && prev !== cur) {
        const [pUser, pEnt, pRole] = prev.split('|')
        const [cUser, cEnt, cRole] = cur.split('|')
        if (pUser !== cUser || pEnt !== cEnt) {
          // Зашёл другой человек / другое предприятие — стол должен быть чистым
          closeAllWindows()
          addLog('info', 'Сессия изменилась: окна прошлого сеанса закрыты')
        } else {
          announceRoleChange(pRole, cRole)
        }
      }

      localStorage.setItem(SESSION_FP_KEY, cur)
      roleWatchArmed = true
    },
    { immediate: true, flush: 'sync' }
)

const name = computed(() => appStore.currentUser?.name || 'Гость')
const role = computed(() => appStore.currentMemberRole || appStore.currentUser?.role || 'Пользователь')
const enterpriseName = computed(() => appStore.enterpriseName)

useHead({
  title: computed(() => `Предприятие — ${enterpriseName.value || 'Загрузка...'}`)
})

// Роль изменилась прямо во время работы (её сменил управляющий)
watch(role, (now, prev) => {
  if (!roleWatchArmed) return
  announceRoleChange(prev, now)
  if (import.meta.client) localStorage.setItem(SESSION_FP_KEY, appStore.sessionFingerprint)
})

// Доступ к предприятию отозван сервером
watch(() => appStore.enterpriseId, (now, prev) => {
  if (!roleWatchArmed || manualLogout || !prev || now) return
  closeAllWindows()
  addNotification('warning', 'Доступ к предприятию отозван')
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

  pin(
      payload.type,
      payload,
      {
        x: e.clientX - rect.left - width / 2,
        y: e.clientY - rect.top - height / 2,
      },
      { width, height },
      payload.windowKey
  )
  consumePinnedCallback(payload.dragId)
}

const openSettings = () => {
  openWindow('customisation')
}

// Проверка обновлений через GitHub в Electron или fallback через Nuxt
async function checkForRemoteUpdates() {
  if (typeof window !== 'undefined' && (window as any).electronUpdater) {
    try {
      const res = await (window as any).electronUpdater.checkUpdates()
      if (res && res.hasUpdate && res.downloadUrl) {
        latestRemoteVersion.value = `v${res.latestVersion}`
        updateNotes.value = res.notes
        downloadUrl.value = res.downloadUrl
        hasNewUpdate.value = true
        addLog('warning', `Доступна новая версия ${latestRemoteVersion.value} на GitHub!`)
      }
    } catch (e: any) {
      console.warn('[Updater Check Error]:', e)
    }
  }
}

// Запуск скачивания с отображением шкалы
async function startDirectDownload() {
  if (!downloadUrl.value || !(window as any).electronUpdater) return

  isDownloading.value = true
  downloadPercent.value = 0
  addLog('info', `Начато скачивание обновления ${latestRemoteVersion.value}...`)

  try {
    await (window as any).electronUpdater.startDownload(downloadUrl.value)
  } catch (err: any) {
    isDownloading.value = false
    addLog('error', `Ошибка загрузки обновления: ${err.message || err}`)
  }
}

// Установка обновления
async function applyUpdate() {
  if ((window as any).electronUpdater) {
    addLog('info', 'Перезапуск приложения для установки обновления...')
    await (window as any).electronUpdater.installUpdate()
  }
}

let cleanupProgress: (() => void) | null = null
let cleanupComplete: (() => void) | null = null
let cleanupError: (() => void) | null = null

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

const handleEnterpriseLogin = async () => {
  manualLogout = false
  closeAllWindows()
  await handleEnterpriseUpdate()
  void appStore.refreshAccess()
}

const handleEnterpriseLogout = async () => {
  manualLogout = true
  closeAllWindows()
  await handleEnterpriseUpdate()
}

const handleEnterpriseUpdated = async () => {
  await handleEnterpriseUpdate()
  void appStore.refreshAccess()
}

onMounted(async () => {
  loadUserData()
  await preloadEnterpriseData()
  void checkForRemoteUpdates()

  // Подписка на IPC события прогресса
  if (typeof window !== 'undefined' && (window as any).electronUpdater) {
    const updater = (window as any).electronUpdater

    cleanupProgress = updater.onProgress((p: any) => {
      downloadPercent.value = p.percent
      transferredMb.value = (p.transferredBytes / (1024 * 1024)).toFixed(1)
      totalMb.value = (p.totalBytes / (1024 * 1024)).toFixed(1)
    })

    cleanupComplete = updater.onComplete(() => {
      isDownloading.value = false
      isReadyToInstall.value = true
      downloadPercent.value = 100
      addLog('success', 'Обновление загружено и готово к установке!')
    })

    cleanupError = updater.onError((err: string) => {
      isDownloading.value = false
      addLog('error', `Сбой скачивания: ${err}`)
    })
  }

  window.addEventListener('storage', handleStorageChange)
  window.addEventListener('enterprise-login', handleEnterpriseLogin)
  window.addEventListener('enterprise-logout', handleEnterpriseLogout)
  window.addEventListener('enterprise-updated', handleEnterpriseUpdated)
})

onUnmounted(() => {
  if (cleanupProgress) cleanupProgress()
  if (cleanupComplete) cleanupComplete()
  if (cleanupError) cleanupError()

  window.removeEventListener('storage', handleStorageChange)
  window.removeEventListener('enterprise-login', handleEnterpriseLogin)
  window.removeEventListener('enterprise-logout', handleEnterpriseLogout)
  window.removeEventListener('enterprise-updated', handleEnterpriseUpdated)
})

function deleteUser() {
  manualLogout = true
  closeAllWindows()
  appStore.clearSession()
  if (import.meta.client) {
    window.dispatchEvent(new Event('enterprise-logout'))
  }
  router.push('/')
}
</script>

<template>
  <MoloGuard :allowedRoles="['Администратор', 'Управляющий', 'Бухгалтер', 'Программист', 'Сотрудник', 'Наблюдатель', 'Пользователь']">
    <div class="enterprise-container">
      <div class="background">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <img :src="logo" class="background-logo" alt="Logo" />
      </div>

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

      <div class="logger-wrapper">
        <LayoutMoloLogger />
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="loading-card">
          <div class="loading-spinner"></div>
          <span class="loading-text">Загружаем рабочее пространство...</span>
        </div>
      </div>

      <div v-else class="content">
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
                <p class="user-role">{{ role }}</p>
              </div>
            </div>

            <UIMoloButton @click="deleteUser" class="close">
              <span>Выйти</span>
            </UIMoloButton>
          </div>
        </header>

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

      <!-- Плашка версии снизу справа -->
      <div class="version-tag-enterprise">
        <span class="version-dot"></span>
        <span>{{ appVersion }}</span>
      </div>

      <!-- Тост обновления с прогресс-баром скачивания -->
      <transition name="notice-fade">
        <div v-if="hasNewUpdate" class="version-update-toast">
          <div class="toast-content-wrapper">
            <div class="toast-header-row">
              <div class="toast-left">
                <span class="toast-badge">GitHub</span>
                <div class="toast-text">
                  <strong>Доступна версия {{ latestRemoteVersion }}</strong>
                  <span v-if="!isDownloading && !isReadyToInstall">{{ updateNotes || 'Быстрое обновление с GitHub' }}</span>
                  <span v-else-if="isDownloading">Загрузка: {{ transferredMb }} МБ из {{ totalMb }} МБ ({{ downloadPercent }}%)</span>
                  <span v-else-if="isReadyToInstall" class="ready-text">Файл готов к установке</span>
                </div>
              </div>

              <div class="toast-actions">
                <UIMoloButton
                    v-if="!isDownloading && !isReadyToInstall"
                    class="confirm small"
                    @click="startDirectDownload"
                >
                  Обновить
                </UIMoloButton>

                <UIMoloButton
                    v-else-if="isReadyToInstall"
                    class="confirm small highlight"
                    @click="applyUpdate"
                >
                  Перезапустить
                </UIMoloButton>

                <button
                    v-if="!isDownloading"
                    class="toast-close"
                    title="Закрыть"
                    @click="hasNewUpdate = false"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Прогресс-бар скачивания -->
            <div v-if="isDownloading || isReadyToInstall" class="download-progress-container">
              <div class="download-progress-bar" :style="{ width: `${downloadPercent}%` }"></div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </MoloGuard>
</template>

<style scoped>
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
.background {
  position: absolute; inset: 0; pointer-events: none; overflow: hidden;
}
.background-logo {
  position: absolute; top: 50%; left: 50%; width: min(34vw, 420px);
  transform: translate(-50%, -50%); opacity: 0.035; filter: grayscale(1) blur(1px); user-select: none;
}
.orb {
  position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.18; animation: float 18s ease-in-out infinite;
}
.orb-1 { width: 320px; height: 320px; top: 8%; left: 6%; background: #3872ef; }
.orb-2 { width: 260px; height: 260px; right: 10%; top: 15%; background: #7c3aed; animation-delay: -6s; }
.orb-3 { width: 340px; height: 340px; bottom: 8%; left: 30%; background: #0ea5e9; animation-delay: -12s; }
@keyframes float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(0, -20px, 0) scale(1.06); }
}
.notifications-wrapper {
  position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column-reverse; gap: 8px; z-index: 1000; pointer-events: none;
}
.notifications-wrapper > * { pointer-events: auto; }
.logger-wrapper { position: fixed; left: 20px; bottom: 20px; z-index: 1000; }
.loading-state { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
.loading-card {
  display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 32px 36px; border-radius: 24px;
  background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); backdrop-filter: blur(20px);
}
.loading-spinner {
  width: 42px; height: 42px; border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: #3872ef; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.content { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }
.topbar {
  display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 24px 28px;
  border-radius: 28px; -webkit-backdrop-filter: blur(22px);
}
.brand { display: flex; align-items: center; gap: 16px; min-width: 0; }
.enterprise-title { margin: 0; font-size: clamp(1.55rem, 3vw, 2.35rem); font-weight: 800; color: #ffffff; }
.enterprise-subtitle { margin: 6px 0 0; font-size: 0.95rem; color: rgba(255, 255, 255, 0.55); }
.user-section { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
.user-card { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; border-radius: 18px; }
.user-avatar {
  cursor: pointer; width: 42px; height: 42px; border-radius: 6px; display: flex;
  align-items: center; justify-content: center; font-weight: 700; font-size: 15px; color: #ffffff;
  background: linear-gradient(135deg, #3872ef, #7c3aed);
}
.user-info { display: flex; flex-direction: column; }
.greeting { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.5); }
.user-name { margin: 2px 0 0; font-size: 14px; font-weight: 600; color: #ffffff; }
.user-role { margin: 2px 0 0; font-size: 11px; color: #38bdf8; }
.workspace { position: relative; flex: 1; min-height: calc(100vh - 160px); overflow: hidden; }
.workspace-header { display: flex; justify-content: space-between; }

/* Плашка версии */
.version-tag-enterprise {
  position: fixed;
  right: 14px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(4px);
  user-select: none;
  pointer-events: none;
  z-index: 999;
}

.version-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #38bdf8;
  opacity: 0.5;
}

/* Тост обновления */
.version-update-toast {
  position: fixed;
  right: 20px;
  bottom: 34px;
  background: rgba(18, 20, 29, 0.96);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 14px;
  backdrop-filter: blur(24px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7);
  z-index: 9999;
  width: 420px;
  overflow: hidden;
}

.toast-content-wrapper {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toast-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toast-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 3px 6px;
  border-radius: 5px;
  flex-shrink: 0;
}

.toast-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.toast-text strong {
  color: #ffffff;
  font-size: 13px;
}

.toast-text span {
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.3;
}

.ready-text {
  color: #34d399 !important;
  font-weight: 600;
}

.toast-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.highlight {
  background: #10b981 !important;
}

.download-progress-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.download-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #818cf8);
  transition: width 0.2s ease;
  border-radius: 3px;
}

.toast-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 4px;
  transition: color 0.15s;
}

.toast-close:hover {
  color: #ffffff;
}

.notice-fade-enter-active,
.notice-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.notice-fade-enter-from,
.notice-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>