<script setup lang="ts">
import { ref, type Ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useNotifications } from '~/composables/useNotifications'
import { useLogger } from '~/composables/useLogger'
import lock from "~~/public/lock.svg"
import { useModulesStore } from '~~/stores/moduleStore'
import { executeScriptBackground, restartScript } from '~~/app/composables/useScriptCompiler'
import tsIcon from '~~/public/ts.png'
import jsIcon from '~~/public/js.png'

const props = defineProps<{ role: string }>()

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
    sizeOptions?: WindowSizeOptions,
    isModal?: boolean,
    componentPath?: string,
    moduleData?: any
  ]
}>()

const modulesStore = useModulesStore()
const { addNotification } = useNotifications('Меню')
const { addLog } = useLogger()

const enterpriseDataStr = ref<string | null>(null)
const token = ref<string | null>(null)
const currentEnterprise = ref<any>(null)

const dynamicModules = ref<any[]>([])
const runningModules = ref<Map<string, any>>(new Map())

const enterprises = ref([])
const loadingEnterprises = ref(false)
const loading = ref(false)

const isLockedHover = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

const menuRef = ref<HTMLElement | null>(null)
const modulesRef = ref<HTMLElement | null>(null)

const menuGroups = ref<any[]>([])
const activeGroup = ref<string | null>(null)
const activeModulesGroup = ref<string | null>(null)

// Для выпадающих списков (основные)
const openDropdown = ref<string | null>(null)
const openModulesDropdown = ref<string | null>(null)

// Для вложенных подменю (второй уровень)
const openSubmenu = ref<string | null>(null)
const openModulesSubmenu = ref<string | null>(null)

// Задержка для закрытия
let closeTimeout: ReturnType<typeof setTimeout> | null = null

/* =========================
   AUTH / ENTERPRISE
========================= */

const updateAuthData = () => {
  addLog('info', 'Загружаю информацию о предприятии')

  enterpriseDataStr.value = localStorage.getItem('currentEnterprise')
  token.value = localStorage.getItem('enterprise_token')

  if (enterpriseDataStr.value) {
    try {
      currentEnterprise.value = JSON.parse(enterpriseDataStr.value)
      addLog('success', 'Предприятие загружено')
    } catch (e) {
      addLog('error', `Ошибка парсинга предприятия: ${e}`)
    }
  } else {
    currentEnterprise.value = null
  }
}

/* =========================
   MODULES
========================= */

const loadDynamicModules = async () => {
  if (!currentEnterprise.value?._id) return

  try {
    const response = await $fetch(`/api/enterprises/${currentEnterprise.value._id}/dynamicModules`)
    dynamicModules.value = response.modules || []
  } catch (error) {
    addLog('error', `Ошибка загрузки модулей: ${error}`)
    dynamicModules.value = []
  }
}

const safeModuleData = (module: any) => ({
  _id: module._id?.toString?.() || module._id,
  name: module.name,
  format: module.format,
  code: module.code,
  fileName: module.fileName
})

const createDynamicMenuItems = () => {
  if (!dynamicModules.value.length) return []

  return dynamicModules.value
      .filter(module => module && module._id)
      .map(module => ({
        id: `module_${module._id}`,
        title: module.name || 'Без названия',
        format: module.format,
        requiredRole: ['Управляющий', 'Сотрудник'],
        isActive: true,
        isModule: true,
        moduleId: module._id,
        moduleData: safeModuleData(module),
        componentName: module.format === 'vue' ? 'DynamicModuleLoader' : undefined,
        isScript: module.format !== 'vue'
      }))
}

/* =========================
   MENU API
========================= */

const loadMenuFromAPI = async () => {
  loading.value = true

  try {
    const response = await $fetch('/api/menu', {
      params: { role: props.role, type: 'all' }
    })

    menuGroups.value = (response as any[])
        .filter(g => g && g.type === 'menu')

    const modulesData = (response as any[])
        .filter(g => g && g.type === 'module')

    ;(window as any).__modulesData = modulesData
  } catch (error) {
    addNotification('error', 'Ошибка загрузки меню')
    addLog('error', `Menu error: ${error}`)
  } finally {
    loading.value = false
  }
}

const initDefaultMenu = async () => {
  try {
    await $fetch('/api/menu/init', { method: 'POST' })
    await loadMenuFromAPI()
  } catch (e) {
    addLog('error', `Init menu error: ${e}`)
  }
}

/* =========================
   COMPUTED GROUPS
========================= */

const modulesGroups = computed(() => {
  const isLoggedIn = token.value && enterpriseDataStr.value
  if (!isLoggedIn) return []

  const staticModules =
      ((window as any).__modulesData || menuGroups.value.filter(g => g?.type === 'module'))
          .filter(Boolean)

  const dynamic = createDynamicMenuItems()

  return dynamic.length
      ? [...staticModules, { id: 'dynamic_modules', title: 'Мои модули', items: dynamic }]
      : staticModules
})

/* =========================
   DROPDOWN HANDLERS
========================= */

const handleMouseEnterGroup = (groupId: string, isModules = false) => {
  if (closeTimeout) clearTimeout(closeTimeout)

  if (isModules) {
    openModulesDropdown.value = groupId
  } else {
    openDropdown.value = groupId
  }
}

const handleMouseLeaveGroup = (isModules = false) => {
  closeTimeout = setTimeout(() => {
    if (isModules) {
      openModulesDropdown.value = null
      openModulesSubmenu.value = null
    } else {
      openDropdown.value = null
      openSubmenu.value = null
    }
  }, 150)
}

const handleMouseEnterItem = (itemId: string, isModules = false) => {
  if (closeTimeout) clearTimeout(closeTimeout)

  if (isModules) {
    openModulesSubmenu.value = itemId
  } else {
    openSubmenu.value = itemId
  }
}

const handleMouseLeaveItem = (isModules = false) => {
  closeTimeout = setTimeout(() => {
    if (isModules) {
      openModulesSubmenu.value = null
    } else {
      openSubmenu.value = null
    }
  }, 150)
}

/* =========================
   WINDOW SIZE
========================= */

const getWindowSizeOptions = (itemId: string) => {
  const presets: Record<string, any> = {
    login: { width: 400, height: 450 },
    browser: { width: 900, height: 650 },
    register: { width: 1000, height: 650 },
    customisation: { width: 800, height: 600 },
    creature: { width: 1000, height: 650 },
    control: { width: 1000, height: 650 },
  }

  return presets[itemId]
}

/* =========================
   CLICK HANDLERS
========================= */

// Обработчик клика по родительскому элементу (с детьми)
const handleParentClick = (event: MouseEvent, groupId: string, item: any, isModule = false) => {
  event.stopPropagation()
  // Переключаем состояние открытия подменю при клике
  if (isModule) {
    openModulesSubmenu.value = openModulesSubmenu.value === item.id ? null : item.id
  } else {
    openSubmenu.value = openSubmenu.value === item.id ? null : item.id
  }
}

// Обработчик клика по конечному пункту (без детей)
const handleLeafClick = (event: MouseEvent, groupId: string, item: any, isModule = false) => {
  if (!item) return

  if (item.isScript) {
    restartModule(item.moduleData)
    // Закрываем дропдаун после клика
    if (isModule) {
      openModulesDropdown.value = null
      openModulesSubmenu.value = null
    } else {
      openDropdown.value = null
      openSubmenu.value = null
    }
    return
  }

  const sizeOptions = getWindowSizeOptions(item.id)

  if (item.format === 'vue' && item.moduleId) {
    emit('open-window',
        groupId,
        item.id,
        undefined,
        sizeOptions,
        false,
        'modules/DynamicModuleLoader',
        {
          ...item.moduleData,
          moduleId: item.moduleId,
          _id: item.moduleId,
        }
    )
  } else {
    emit('open-window',
        groupId,
        item.id,
        undefined,
        sizeOptions,
        false,
        item.componentPath || item.componentName,
        item.moduleData
    )
  }

  // Закрываем дропдаун после клика
  if (isModule) {
    openModulesDropdown.value = null
    openModulesSubmenu.value = null
  } else {
    openDropdown.value = null
    openSubmenu.value = null
  }
}

// Основной обработчик - определяет, есть ли дети
const handleMenuItemClick = (event: MouseEvent, groupId: string, item: any, isModule = false) => {
  if (!item) return

  if (item.items?.length) {
    // Если есть дети - переключаем подменю при клике
    handleParentClick(event, groupId, item, isModule)
  } else {
    // Если нет детей - выполняем действие
    handleLeafClick(event, groupId, item, isModule)
  }
}

const handleChildItemClick = (groupId: string, parentItem: any, child: any, isModule = false) => {
  if (!child) return

  const sizeOptions = getWindowSizeOptions(child.id)

  emit('open-window',
      groupId,
      child.id || parentItem.id,
      child.id ? parentItem.id : undefined,
      sizeOptions,
      false,
      child.componentPath || parentItem.componentPath,
      child.moduleData || parentItem.moduleData
  )

  // Закрываем все дропдауны
  if (isModule) {
    openModulesDropdown.value = null
    openModulesSubmenu.value = null
  } else {
    openDropdown.value = null
    openSubmenu.value = null
  }
}

/* =========================
   MODULE EXECUTION
========================= */

const restartModule = async (moduleData: any) => {
  if (!moduleData) return

  try {
    const result = await restartScript(
        moduleData.code,
        moduleData.format,
        moduleData._id,
        moduleData.name
    )

    runningModules.value.set(moduleData._id, result)
    addNotification('success', 'Модуль перезапущен')
  } catch (e) {
    addNotification('error', 'Ошибка перезапуска модуля')
  }
}

const autoExecuteModules = async () => {
  if (!currentEnterprise.value?._id) return

  try {
    const response = await $fetch(`/api/enterprises/${currentEnterprise.value._id}/dynamicModules`)
    const modules = response.modules || []

    for (const module of modules) {
      if (!module) continue

      if ((module.format === 'js' || module.format === 'ts') && module.isActive) {
        try {
          const result = await executeScriptBackground(module.code, module.format, module.name)
          runningModules.value.set(module._id, result)
        } catch (e) {
          addLog('error', `Module error: ${e}`)
        }
      }
    }
  } catch (e) {
    addLog('error', `Auto execute error: ${e}`)
  }
}

// Обработчики для lock
const handleMouseEnterLock = () => {
  if (props.role === 'Пользователь') {
    isLockedHover.value = true
    emit('lock-hover', true)
  }
}

const handleMouseLeaveLock = () => {
  if (props.role === 'Пользователь') {
    isLockedHover.value = false
    emit('lock-hover', false)
  }
}

const handleMouseMoveLock = (event: MouseEvent) => {
  if (!menuRef.value) return
  const rect = menuRef.value.getBoundingClientRect()
  tooltipPosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

/* =========================
   LIFECYCLE
========================= */

onMounted(async () => {
  updateAuthData()

  await loadMenuFromAPI()

  if (!menuGroups.value.length) {
    await initDefaultMenu()
  }

  if (currentEnterprise.value?._id) {
    modulesStore.setEnterprise(currentEnterprise.value._id)
    await modulesStore.fetchModules()
    await loadDynamicModules()
    await autoExecuteModules()
  }
})

const customStorageEvent = async () => {
  updateAuthData()
  await loadDynamicModules()
  await loadMenuFromAPI()
}

window.addEventListener('storage', customStorageEvent)
window.addEventListener('enterprise-login', customStorageEvent)
window.addEventListener('enterprise-logout', customStorageEvent)
window.addEventListener('modules-updated', customStorageEvent)

onUnmounted(() => {
  window.removeEventListener('storage', customStorageEvent)
  window.removeEventListener('enterprise-login', customStorageEvent)
  window.removeEventListener('enterprise-logout', customStorageEvent)
  window.removeEventListener('modules-updated', customStorageEvent)

  if (closeTimeout) clearTimeout(closeTimeout)
})
</script>

<template>
  <!-- ГОРИЗОНТАЛЬНОЕ МЕНЮ -->
  <div
      class="horizontal-menu"
      @mouseenter="handleMouseEnterLock"
      @mouseleave="handleMouseLeaveLock"
      @mousemove="handleMouseMoveLock"
  >
    <!-- ЛЕВОЕ МЕНЮ (Основное) -->
    <nav
        ref="menuRef"
        class="menu-nav"
        :class="{ locked: isLockedHover }"
    >
      <div v-if="loading" class="loading-placeholder">
        Загрузка...
      </div>

      <div v-else class="nav-groups">
        <div
            v-for="group in menuGroups"
            :key="group.id"
            class="nav-group"
            @mouseenter="handleMouseEnterGroup(group.id)"
            @mouseleave="handleMouseLeaveGroup()"
        >
          <div class="nav-group-header">
            <span>{{ group.title }}</span>
            <span class="nav-arrow">▼</span>
          </div>

          <!-- Выпадающий список (родители) -->
          <transition name="dropdown">
            <div v-show="openDropdown === group.id" class="dropdown-menu">
              <div
                  v-for="item in (group.items || []).filter(i => i && i.isActive !== false)"
                  :key="item.id"
                  class="dropdown-item"
                  :class="{ 'has-children': item.items?.length }"
                  @mouseenter="handleMouseEnterItem(item.id)"
                  @mouseleave="handleMouseLeaveItem()"
              >
                <div
                    class="dropdown-item-header"
                    :class="{ 'has-children': item.items?.length }"
                    @click="handleMenuItemClick($event, group.id, item)"
                >
                  <span class="dropdown-item-title">{{ item.title }}</span>
                  <span v-if="item.items?.length" class="sub-arrow" :class="{ rotated: openSubmenu === item.id }">›</span>
                </div>

                <!-- Подменю (дети) -->
                <transition name="submenu">
                  <div v-if="item.items?.length && openSubmenu === item.id" class="submenu">
                    <div
                        v-for="child in (item.items || []).filter(c => c)"
                        :key="child.id"
                        class="submenu-item"
                        @click="handleChildItemClick(group.id, item, child)"
                    >
                      {{ child.title }}
                    </div>
                  </div>
                </transition>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </nav>

    <!-- Разделитель -->
    <div class="menu-divider"></div>

    <!-- ПРАВОЕ МЕНЮ (Модули) -->
    <nav
        ref="modulesRef"
        class="menu-nav right"
    >
      <div class="nav-groups">
        <div
            v-for="group in modulesGroups"
            :key="group.id"
            class="nav-group"
            @mouseenter="handleMouseEnterGroup(group.id, true)"
            @mouseleave="handleMouseLeaveGroup(true)"
        >
          <div class="nav-group-header">
            <span>{{ group.title }}</span>
            <span class="nav-arrow">▼</span>
          </div>

          <!-- Выпадающий список модулей -->
          <transition name="dropdown">
            <div v-show="openModulesDropdown === group.id" class="dropdown-menu modules-dropdown">
              <div
                  v-for="item in (group.items || []).filter(i => i)"
                  :key="item.id"
                  class="dropdown-item"
                  :class="{ 'has-children': item.items?.length, script: item.isScript }"
                  @mouseenter="handleMouseEnterItem(item.id, true)"
                  @mouseleave="handleMouseLeaveItem(true)"
              >
                <div
                    class="dropdown-item-header"
                    :class="{ 'has-children': item.items?.length }"
                    @click="handleMenuItemClick($event, group.id, item, true)"
                >
                  <span class="dropdown-item-title">
                    <img
                        v-if="item.format === 'ts'"
                        :src="tsIcon"
                        class="item-icon"
                    />
                    <img
                        v-if="item.format === 'js'"
                        :src="jsIcon"
                        class="item-icon"
                    />
                    {{ item.title }}
                  </span>
                  <button
                      v-if="item.isScript"
                      class="restart-btn"
                      @click.stop="restartModule(item.moduleData)"
                  >
                    ↻
                  </button>
                  <span v-if="item.items?.length" class="sub-arrow" :class="{ rotated: openModulesSubmenu === item.id }">›</span>
                </div>

                <!-- Подменю модулей -->
                <transition name="submenu">
                  <div v-if="item.items?.length && openModulesSubmenu === item.id" class="submenu">
                    <div
                        v-for="child in (item.items || []).filter(c => c)"
                        :key="child.id"
                        class="submenu-item"
                        @click="handleChildItemClick(group.id, item, child, true)"
                    >
                      {{ child.title }}
                    </div>
                  </div>
                </transition>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </nav>
  </div>

  <!-- LOCK для пользователя -->
  <div v-if="isLockedHover && role === 'Пользователь'" class="global-lock">
    <img :src="lock" class="lock-icon" />
    <div
        class="lock-tooltip"
        :style="{ left: tooltipPosition.x + 10 + 'px', top: tooltipPosition.y + 10 + 'px' }"
    >
      Нет доступа
    </div>
  </div>
</template>

<style scoped>
/* ========================================
   ГОРИЗОНТАЛЬНОЕ МЕНЮ
======================================== */

.horizontal-menu {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  backdrop-filter: blur(18px);
  overflow: visible;
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  position: relative;
}

.menu-nav {
  display: flex;
  padding: 8px 16px;
}

.menu-nav.right {
  border-left: none;
}

.nav-groups {
  display: flex;
  gap: 8px;
}

/* Группа меню */
.nav-group {
  position: relative;
}

.nav-group-header {
  padding: 8px 16px;
  border-radius: 12px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.nav-group-header:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.nav-arrow {
  font-size: 10px;
  opacity: 0.6;
  transition: transform 0.2s ease;
}

.nav-group:hover .nav-arrow {
  transform: rotate(180deg);
  opacity: 1;
}

/* Разделитель */
.menu-divider {
  width: 1px;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.2), transparent);
  margin: 8px 0;
}

/* ========================================
   ВЫПАДАЮЩИЙ СПИСОК (РОДИТЕЛИ)
======================================== */

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  background: rgba(20, 20, 30, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px 0;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.modules-dropdown {
  right: 0;
  left: auto;
}

/* Элемент выпадающего списка */
.dropdown-item {
  position: relative;
}

.dropdown-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.dropdown-item-header.has-children {
  font-weight: 500;
}

.dropdown-item-header:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.dropdown-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-icon {
  width: 16px;
  height: 16px;
}

.sub-arrow {
  font-size: 14px;
  opacity: 0.5;
  margin-left: 12px;
  transition: transform 0.2s ease;
  display: inline-block;
}

.sub-arrow.rotated {
  transform: rotate(90deg);
}

/* ========================================
   ПОДМЕНЮ (ДЕТИ)
======================================== */

.submenu {
  position: absolute;
  top: -8px;
  left: calc(100% + 4px);
  min-width: 200px;
  background: rgba(20, 20, 30, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px 0;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  z-index: 1001;
}

/* Для модулей справа - подменю влево */
.modules-dropdown .submenu {
  left: auto;
  right: calc(100% + 4px);
}

.submenu-item {
  padding: 8px 16px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.submenu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding-left: 20px;
}

/* ========================================
   КНОПКА ПЕРЕЗАПУСКА
======================================== */

.restart-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
  margin-left: 8px;
}

.restart-btn:hover {
  color: #6ea2ff;
  background: rgba(110, 162, 255, 0.1);
  transform: rotate(180deg);
}

/* ========================================
   АНИМАЦИИ
======================================== */

.dropdown-enter-active,
.dropdown-leave-active,
.submenu-enter-active,
.submenu-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.submenu-enter-from,
.submenu-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.modules-dropdown .submenu-enter-from,
.modules-dropdown .submenu-leave-to {
  transform: translateX(8px);
}

/* ========================================
   LOCK
======================================== */

.global-lock {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(4px);
  z-index: 2000;
  pointer-events: none;
}

.lock-icon {
  width: 48px;
  height: 48px;
  opacity: 0.8;
}

.lock-tooltip {
  position: fixed;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  color: white;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid rgba(255, 80, 80, 0.3);
  pointer-events: none;
  white-space: nowrap;
}

/* ========================================
   ЗАГРУЗКА
======================================== */

.loading-placeholder {
  padding: 8px 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

/* ========================================
   АДАПТИВНОСТЬ
======================================== */

@media (max-width: 900px) {
  .horizontal-menu {
    flex-direction: column;
    width: 100%;
    margin: 0;
    border-radius: 16px;
    overflow: hidden;
  }

  .menu-divider {
    width: 100%;
    height: 1px;
    margin: 0;
  }

  .dropdown-menu {
    position: static;
    box-shadow: none;
    background: rgba(255, 255, 255, 0.03);
    margin-top: 4px;
    border: none;
    padding-left: 16px;
  }

  .submenu {
    position: static;
    box-shadow: none;
    background: transparent;
    padding-left: 20px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    margin-left: 16px;
    top: auto;
    left: auto;
    right: auto;
  }

  .modules-dropdown .submenu {
    right: auto;
    left: auto;
  }

  .nav-group {
    width: 100%;
  }

  .nav-groups {
    flex-direction: column;
    width: 100%;
  }

  .menu-nav {
    width: 100%;
    padding: 12px;
  }

  .sub-arrow.rotated {
    transform: rotate(90deg);
  }
}
</style>