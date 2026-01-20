<script setup lang="ts">
import { getMenuByRole, type MenuGroup } from '~/utils/menuConfig'
import { useNotifications } from '~/composables/useNotifications'
import lock from "~~/public/lock.svg"

const props = defineProps<{
  role: string
}>()

const emit = defineEmits<{
  'lock-hover': [value: boolean]
  'open-window': [groupId: string, itemId: string, groupTitle: string, itemTitle: string]
}>()

const { addNotification } = useNotifications()

const isLockedHover = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })
const menuRef = ref<HTMLElement | null>(null)
const menuGroups = ref<MenuGroup[]>([])
const activeGroup = ref<string | null>(null)

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

const handleLinkClick = (
    groupId: string,
    itemId: string,
    groupTitle: string,
    itemTitle: string,
    subGroupId?: string,
    subGroupTitle?: string
) => {
  if (props.role === 'Пользователь') {
    addNotification('LOCKED')
  }

  // Передаем все параметры включая подгруппу
  emit('open-window',
      groupId,
      itemId,
      groupTitle,
      itemTitle,
      subGroupId,
      subGroupTitle
  )
}

onMounted(() => {
  menuGroups.value = getMenuByRole(props.role)

  if (menuGroups.value.length === 0) {
    addNotification('GET_MENU_ERROR')
  }
})
onMounted(() => {
  menuGroups.value = getMenuByRole(props.role)

  if (menuGroups.value.length === 0) {
    addNotification('GET_MENU_ERROR')
  }
})
</script>

<template>
  <section
      ref="menuRef"
      class="main-list"
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
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <transition name="expand">
          <div v-show="activeGroup === group.id" class="group-content">
            <div class="links">
              <MoloMenuItem
                  v-for="item in group.items"
                  :key="item.id"
                  :item="item"
                  :groupId="group.id"
                  :groupTitle="group.title"
                  @open-window="handleLinkClick"
              />
            </div>
          </div>
        </transition>
      </div>
    </div>

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
.main-list {
  position: absolute;
  border: 1px solid var(--half_opacity_border);
  background-color: var(--half_opacity_bg);
  border-radius: 20px;
  display: flex;
  top: 50%;
  transform: translateY(-50%);
  height: fit-content;
  flex-direction: column;
  width: fit-content;
  gap: 10px;
  padding: 25px;
  transition: all 0.3s ease;
  cursor: default;
  min-width: 250px;
}

.main-list.locked {
  background-color: rgba(255, 255, 255, 0.05);
}

.main-list:hover {
  border-color: var(--half_opacity_border_hover);
}

.main-list.locked:hover {
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


.link {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.2s ease;
  padding: 6px 0 6px 10px;
  position: relative;
  font-size: 14px;
}

.link:hover {
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

@media (max-width: 767px) {
  .main-list {
    margin-left: 20px;
    padding: 20px;
    min-width: auto;
    width: 100%;
  }

  .menu-groups {
    gap: 10px;
  }

  .links {
    padding-left: 10px;
    gap: 8px;
  }

  .link {
    padding-left: 10px;
    font-size: 13px;
  }
}
</style>