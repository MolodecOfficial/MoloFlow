<script setup lang="ts">
import { getMenuByRole, type MenuGroup, type MenuItem } from '~/utils/menuConfig'
import { useNotifications } from '~/composables/useNotifications'
import lock from "~~/public/lock.svg"

const props = defineProps<{
  role: string
}>()

// Добавляем тип для размеров окна
interface WindowSizeOptions {
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
}

const emit = defineEmits<{
  'lock-hover': [value: boolean]
  'open-window': [
    groupId: string,
    itemId: string,
    subGroupId?: string,
    sizeOptions?: WindowSizeOptions
  ]
}>()

const { addNotification } = useNotifications()

// Состояния
const enterprises = ref([])
const loadingEnterprises = ref(false)
const isLockedHover = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })
const menuRef = ref<HTMLElement | null>(null)
const menuGroups = ref<MenuGroup[]>([])
const activeGroup = ref<string | null>(null)
const expandedItems = ref<Set<string>>(new Set())

// Загрузка предприятий для управляющего
const getEnterprises = async () => {
  loadingEnterprises.value = true
  try {
    const response = await $fetch('/api/enterprises/enterprises')
    enterprises.value = response.enterprises
  } catch (error) {
    addNotification('ERROR_DEFAULT', error)
  } finally {
    loadingEnterprises.value = false
  }
}

// Утилиты
const getLockMessage = () => {
  switch(props.role) {
    case 'Пользователь':
      return 'Доступ заблокирован, свяжитесь с Вашим Управляющим!'
    case 'Сотрудник':
      return 'Для доступа нужна должность "Управляющий"'
    case 'Управляющий':
      return 'Вы уже имеете полный доступ'
    default:
      return 'Недостаточно прав для просмотра'
  }
}

// Обработчики событий
const handleMouseMove = (event: MouseEvent) => {
  if (!menuRef.value) return
  const rect = menuRef.value.getBoundingClientRect()
  tooltipPosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

const handleMouseEnter = () => {
  if (props.role === 'Пользователь') {
    isLockedHover.value = true
    emit('lock-hover', true)
  }
}

const handleMouseLeave = () => {
  if (props.role === 'Пользователь') {
    isLockedHover.value = false
    emit('lock-hover', false)
  }
}

const handleGroupEnter = (groupId: string) => {
  activeGroup.value = groupId
}

const handleGroupLeave = () => {
  activeGroup.value = null
}

const toggleExpand = (itemId: string) => {
  if (expandedItems.value.has(itemId)) {
    expandedItems.value.delete(itemId)
  } else {
    expandedItems.value.add(itemId)
  }
}

// Определяем размеры для конкретных пунктов меню
const getWindowSizeOptions = (itemId: string): WindowSizeOptions | undefined => {
  const sizePresets: Record<string, WindowSizeOptions> = {
    login: {
      width: 400,
      height: 450,
      minWidth: 350,
      minHeight: 400
    },
    creature: {
      width: 700,
      height: 650,
      minWidth: 500,
      minHeight: 600
    },
  }

  return sizePresets[itemId]
}

const handleLinkClick = (
    groupId: string,
    itemId: string,
    subGroupId?: string
) => {
  if (props.role === 'Пользователь') {
    addNotification('LOCKED')
    return
  }

  const sizeOptions = getWindowSizeOptions(itemId)
  emit('open-window', groupId, itemId, subGroupId, sizeOptions)
}

const handleMenuItemClick = (
    event: Event,
    groupId: string,
    item: MenuItem
) => {
  event.preventDefault()
  if (item.items && item.items.length > 0) {
    toggleExpand(item.id)
    return
  }
  handleLinkClick(groupId, item.id)
}

const handleChildItemClick = (
    groupId: string,
    parentItem: MenuItem,
    childItem: MenuItem
) => {
  handleLinkClick(groupId, childItem.id, parentItem.id)
}


// Инициализация
onMounted(() => {
  if (props.role === 'Управляющий') {
    getEnterprises()
  }

  menuGroups.value = getMenuByRole(props.role)
  if (menuGroups.value.length === 0) {
    addNotification('GET_MENU_ERROR')
  }
})

const getPaddingLeft = (depth: number = 0): string => {
  const basePadding = 10
  return `${basePadding + depth * 20}px`
}
</script>

<template>
  <section
      ref="menuRef"
      class="action-list"
      :class="{ 'locked': isLockedHover }"
      @mousemove="handleMouseMove"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
  >
    <div v-if="menuGroups.length === 0" class="empty-menu">
      Меню пустое
    </div>

    <div v-else class="menu-groups">
      <div
          v-for="group in menuGroups"
          :key="group.id"
          class="menu-group"
          @mouseenter="() => handleGroupEnter(group.id)"
          @mouseleave="handleGroupLeave"
      >
        <div class="group-header">
          <h3 class="group-title">{{ group.title }}</h3>
          <div class="group-indicator">
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <transition name="expand">
          <div v-show="activeGroup === group.id" class="group-content">
            <div class="links">
              <template v-for="item in group.items" :key="item.id">
                <div v-if="item.isActive !== false" class="menu-item-wrapper">
                  <a
                      href="#"
                      class="link"
                      :class="{
                      'has-children': item.items?.length,
                      'is-parent': item.items?.length,
                      'is-leaf': !item.items?.length
                    }"
                      :style="{ paddingLeft: getPaddingLeft() }"
                      @click="(e) => handleMenuItemClick(e, group.id, item)"
                  >
                    <span class="item-title">{{ item.title }}</span>
                    <span
                        v-if="item.items?.length"
                        class="expand-icon"
                        :class="{ 'expanded': expandedItems.has(item.id) }"
                    >
                      <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                  </a>

                  <transition name="expand">
                    <div v-if="item.items?.length && expandedItems.has(item.id)" class="submenu">
                      <div
                          v-for="childItem in item.items"
                          :key="childItem.id"
                          class="child-link"
                          :style="{ paddingLeft: getPaddingLeft(1) }"
                          @click="handleChildItemClick(group.id, item, childItem)"
                      >
                        {{ childItem.title }}
                      </div>
                    </div>
                  </transition>
                </div>
              </template>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Блокировка для пользователя -->
    <div v-if="isLockedHover && role === 'Пользователь'" class="lock-overlay">
      <img class="locked-icon" :src="lock" alt="Заблокировано">
      <div
          class="lock-message"
          :style="{
          left: tooltipPosition.x + 10 + 'px',
          top: tooltipPosition.y + 10 + 'px'
        }"
      >
        {{ getLockMessage() }}
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Все стили из обоих компонентов */
.action-list {
  position: absolute;
  border: 1px solid var(--half_opacity_border);
  background-color: var(--half_opacity_bg);
  border-radius: 10px;
  display: flex;
  top: 50%;
  left: 20px;
  transform: translateY(-50%);
  height: fit-content;
  flex-direction: column;
  width: fit-content;
  gap: 10px;
  padding: 25px;
  transition: all 0.3s ease;
  cursor: default;
  min-width: 250px;
  backdrop-filter: blur(10px);
  z-index: 1;
}

.action-list:hover {
  border-color: var(--half_opacity_border_hover);
}

.action-list.locked {
  background-color: rgba(255, 255, 255, 0.05);
}

.action-list.locked:hover {
  border-color: #FA5252;
}

.menu-groups {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.menu-group {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 15px;
}

.menu-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  padding: 10px;
}

.group-header:hover {
  background-color: rgba(56, 239, 125, 0.1);
  color: var(--half_opacity_border_hover);
}

.group-title {
  color: white;
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  transition: color 0.2s ease;
}

.group-header:hover .group-title {
  color: var(--half_opacity_border_hover);
}

.group-indicator {
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.3s ease;
}

.menu-group:hover .group-indicator {
  color: var(--half_opacity_border_hover);
  transform: rotate(180deg);
}

.group-content {
  overflow: hidden;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.links {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 0 0 15px;
  position: relative;
}

/* Стили пунктов меню */
.menu-item-wrapper {
  position: relative;
}

.link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.2s ease;
  padding: 8px 10px 8px 20px;
  font-size: 14px;
  border-radius: 6px;
  margin: 2px 0;
}

.link:hover {
  background: rgba(56, 239, 125, 0.1);
}

.link.has-children {
  cursor: pointer;

}

.link.is-parent {
  color: rgba(255, 255, 255, 0.9);
  &:hover {
    color: var(--half_opacity_border_hover);

  }
}

.link.is-leaf:hover {
  color: var(--half_opacity_border_hover);
}

.item-title {
  flex: 1;
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 8px;
  transition: transform 0.3s ease;
  opacity: 0.7;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.submenu {
  margin-left: 10px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.child-link {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.2s ease;
  padding: 8px 10px 8px 40px;
  font-size: 14px;
  border-radius: 6px;
  margin: 2px 0;
  cursor: pointer;
  display: block;
}

.child-link:hover {
  color: var(--half_opacity_border_hover);
}

.empty-menu {
  color: white;
  opacity: 0.6;
  text-align: center;
  padding: 20px;
}

.lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.locked-icon {
  width: 50px;
  height: 50px;
  filter: drop-shadow(0 0 8px rgba(250, 82, 82, 0.5));
}

.lock-message {
  position: absolute;
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid #FA5252;
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  font-size: 14px;
  z-index: 100;
  pointer-events: none;
  box-shadow: 0 4px 20px rgba(250, 82, 82, 0.3);
  white-space: nowrap;
}

/* Стили для списка предприятий */
.enterprises-list {
  position: absolute;
  border: 1px solid var(--half_opacity_border);
  background-color: var(--half_opacity_bg);
  border-radius: 10px;
  display: flex;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  height: fit-content;
  flex-direction: column;
  width: fit-content;
  min-width: 280px;
  max-width: 400px;
  max-height: 80vh;
  padding: 25px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  overflow-y: auto;
  z-index: 1;
}

.enterprises-list:hover {
  border-color: var(--half_opacity_border_hover);
}

.list-title {
  color: white;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--half_opacity_border);
}

.enterprises-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100px;
}

.enterprise-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.03);
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.enterprise-item:hover {
  background-color: rgba(56, 239, 125, 0.1);
  border-color: rgba(56, 239, 125, 0.3);
}

.enterprise-name {
  color: white;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.enterprise-inn {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  margin-left: 10px;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid transparent;
  border-top: 3px solid #38ef7d;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-list {
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  padding: 30px;
  font-style: italic;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 767px) {
  .action-list,
  .enterprises-list {
    left: 10px;
    right: 10px;
    padding: 20px;
    min-width: auto;
    width: calc(100% - 40px);
  }
}
</style>