<script setup lang="ts">
import { useUserStore } from "~~/stores/userStore"
import { useNotifications } from "~/composables/useNotifications"

const name = ref('')
const role = ref('')
const isLoading = ref(true)
const hasShownNotifications = ref(false)

// Состояние для окон
const windows = ref<Array<{
  id: string
  groupTitle: string
  itemTitle: string
  fullTitle: string
  itemId: string
  groupId: string
  zIndex: number
  isMinimized: boolean
  position: { x: number; y: number }
  size: { width: number; height: number; isMaximized?: boolean }
}>>([])

let zIndexCounter = 100

const userStore = useUserStore()
const router = useRouter()
const { notifications, removeNotification, checkAndShowNotifications } = useNotifications()

onMounted(() => {
  loadUserData()
})

const loadUserData = () => {
  let userName = ''
  let userRole = ''

  if (userStore.userName && userStore.userRole) {
    userName = userStore.userName
    userRole = userStore.userRole
  } else {
    const storageUser = localStorage.getItem('user')
    if (storageUser) {
      const user = JSON.parse(storageUser)
      userName = user.name || 'Гость'
      userRole = user.role || 'Пользователь'
    }
  }

  name.value = userName
  role.value = userRole

  if (!hasShownNotifications.value) {
    checkAndShowNotifications(userRole, userName)
    hasShownNotifications.value = true
  }

  isLoading.value = false
}

function deleteUser() {
  localStorage.removeItem('user')
  router.push('/')
}

const openWindow = (
    groupId: string,
    itemId: string,
    groupTitle: string,
    itemTitle: string,
    subGroupId?: string,
    subGroupTitle?: string
) => {
  console.log('✅ Открываем окно:', {
    groupId,
    itemId,
    groupTitle,
    itemTitle,
    subGroupId,
    subGroupTitle,
  })

  // Формируем уникальный ключ с учетом подгруппы
  const windowKey = subGroupId
      ? `${groupId}_${subGroupId}_${itemId}`
      : `${groupId}_${itemId}`

  const existingWindow = windows.value.find(w =>
      w.itemId === itemId &&
      w.groupId === groupId &&
      w.subGroupId === subGroupId &&
      !w.isMinimized
  )

  if (existingWindow) {
    focusWindow(existingWindow.id)
    return
  }

  // Формируем полный заголовок
  let fullTitle = groupTitle
  if (subGroupTitle) {
    fullTitle += ` → ${subGroupTitle}`
  }
  fullTitle += ` → ${itemTitle}`

  const newWindow: WindowItem = {
    id: `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupTitle,
    itemTitle,
    fullTitle,
    itemId,
    groupId,
    subGroupId,      // сохраняем
    subGroupTitle,   // сохраняем
    zIndex: ++zIndexCounter,
    isMinimized: false,
    position: {
      x: 50 + (windows.value.length * 30),
      y: 50 + (windows.value.length * 30)
    },
    size: {
      width: 600,
      height: 400,
      minWidth: 400,
      minHeight: 300,
      maxWidth: 1200,
      maxHeight: 800,
      isMaximized: false
    }
  }

  console.log('✅ Создано окно:', newWindow)
  windows.value.push(newWindow)
}

const resizeWindow = (id: string, newSize: { width: number; height: number }) => {
  const window = windows.value.find(w => w.id === id)
  if (window) {
    // Ограничиваем минимальный и максимальный размер
    const minWidth = window.size.minWidth || 300
    const minHeight = window.size.minHeight || 200
    const maxWidth = window.size.maxWidth || 1200
    const maxHeight = window.size.maxHeight || 800

    window.size.width = Math.max(minWidth, Math.min(maxWidth, newSize.width))
    window.size.height = Math.max(minHeight, Math.min(maxHeight, newSize.height))
  }
}

const closeWindow = (id: string) => {
  const index = windows.value.findIndex(w => w.id === id)
  if (index !== -1) {
    windows.value.splice(index, 1)
  }
}

const focusWindow = (id: string) => {
  const window = windows.value.find(w => w.id === id)
  if (window) {
    // Восстанавливаем окно, если оно было свернуто
    if (window.isMinimized) {
      window.isMinimized = false
    }
    // Поднимаем z-index
    window.zIndex = ++zIndexCounter
  }
}

const minimizeWindow = (id: string) => {
  const window = windows.value.find(w => w.id === id)
  if (window) {
    window.isMinimized = true
  }
}

const moveWindow = (id: string, newPosition: { x: number; y: number }) => {
  const window = windows.value.find(w => w.id === id)
  if (window) {
    window.position = newPosition
  }
}

const maximizeWindow = (id: string) => {
  const window = windows.value.find(w => w.id === id)
  if (window) {
    // Переключаем состояние максимизации
    window.size.isMaximized = !window.size.isMaximized

    if (window.size.isMaximized) {
      // Сохраняем предыдущий размер и позицию
      window.previousSize = {
        width: window.size.width,
        height: window.size.height
      }
      window.previousPosition = { ...window.position }

      // Устанавливаем максимальный z-index
      window.zIndex = 9999
    } else {
      // Восстанавливаем предыдущий размер и позицию
      if (window.previousSize) {
        window.size.width = window.previousSize.width
        window.size.height = window.previousSize.height
      }
      if (window.previousPosition) {
        window.position = window.previousPosition
      }
      // Возвращаем нормальный z-index
      window.zIndex = ++zIndexCounter
    }
  }
}

// Добавьте интерфейс для временного хранения предыдущих значений
interface PreviousData {
  previousSize?: { width: number; height: number }
  previousPosition?: { x: number; y: number }
}
</script>

<template>
  <MoloGuard :allowedRoles="['Управляющий', 'Сотрудник', 'Пользователь']">
    <div class="enterprise-container">
      <div class="notifications-wrapper">
        <MoloNotice
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

      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span class="loading-text">Загружаем данные...</span>
      </div>

      <div v-else class="content">
        <div class="header-content">
          <h1 class="enterprise-title">MF:Предприятие</h1>
          <section class="user-section">
            <p class="greeting">Привет, <span class="user-name">{{ name }}</span></p>
            <button @click="deleteUser" class="delete-btn">Выйти</button>
          </section>
        </div>

        <div class="main-content">
          <div class="menu-section">
            <MoloMenu
                :role="role"
                @open-window="openWindow"
            />
          </div>

          <div class="windows-section">
            <WindowsManager
                :windows="windows"
                @close="closeWindow"
                @focus="focusWindow"
                @minimize="minimizeWindow"
                @move="moveWindow"
                @resize="resizeWindow"
                @maximize="maximizeWindow"
            />
          </div>
        </div>
      </div>
    </div>
  </MoloGuard>
</template>

<style scoped>
.notifications-wrapper {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 9999;
}

.enterprise-container {
  background-color: #020b18;
  min-height: 100vh;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e9ecef;
  border-top: 3px solid #38ef7d;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 20px;
}

.header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}

@media (min-width: 768px) {
  .header-content {
    flex-direction: row;
  }
}

.enterprise-title {
  color: white;
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  font-weight: 700;
  margin: 0 0 20px 0;
}

@media (min-width: 768px) {
  .enterprise-title {
    margin: 0;
  }
}

.user-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

@media (min-width: 768px) {
  .user-section {
    flex-direction: row;
    gap: 20px;
  }
}

.greeting {
  font-size: 1.1rem;
  color: #adb5bd;
  margin: 0;
}

.user-name {
  font-weight: 600;
  color: white;
}

.delete-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
}

.delete-btn:hover {
  background: #8d1723;
}

.main-content {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 20px;
  margin-top: 20px;
  min-height: calc(100vh - 150px);
}

.menu-section {
  min-width: 280px;
}

.windows-section {
  position: relative;
  width: fit-content;
  min-width: 100%;
  z-index: 0;
  border-radius: 12px;
  min-height: 500px;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .menu-section {
    min-width: auto;
  }

  .windows-section {
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  .content {
    padding: 15px;
  }

  .main-content {
    gap: 15px;
  }
}
</style>