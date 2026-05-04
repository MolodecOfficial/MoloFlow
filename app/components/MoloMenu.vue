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
const { addLog } = useLogger('Меню')

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
const expandedItems = ref<Set<string>>(new Set())
const expandedModulesItems = ref<Set<string>>(new Set())

const updateAuthData = () => {
  addLog('info', 'Загружаю информацию о предприятии')
  enterpriseDataStr.value = localStorage.getItem('currentEnterprise')
  token.value = localStorage.getItem('enterprise_token')
  if (enterpriseDataStr.value) {
    try {
      currentEnterprise.value = JSON.parse(enterpriseDataStr.value)
      addLog('success', 'Загрузил текущее предприятие')
    } catch (e) {
      addLog('error', `Ошибка парсинга данных предприятия: ${e}`)
    }
  } else {
    currentEnterprise.value = null
    addLog('error', 'Данные предприятия пустые')
  }
}

const loadDynamicModules = async () => {
  if (!currentEnterprise.value?._id) return
  await addLog('info', 'Загружаю модули')
  try {
    const response = await $fetch(`/api/enterprises/${currentEnterprise.value._id}/dynamicModules`)
    dynamicModules.value = response.modules || []
    await addLog('success', 'Модули загружены')
  } catch (error) {
    addLog('error', `Ошибка загрузки динамических модулей: ${error}`)
    dynamicModules.value = []
  }
}

const getEnterprises = async () => {
  loadingEnterprises.value = true
  try {
    const response = await $fetch('/api/enterprises/enterprises')
    enterprises.value = response.enterprises
    addLog('info', 'Предприятия загружены')
  } catch (error) {
    addLog('error', `Ошибка получения предприятий - ${error}`)
  } finally {
    loadingEnterprises.value = false
  }
}

const loadMenuFromAPI = async () => {
  loading.value = true
  try {
    addLog('info', 'Загружаю данные меню')
    const response = await $fetch('/api/menu', {
      params: { role: props.role, type: 'all' }
    })

    menuGroups.value = JSON.parse(JSON.stringify(
        (response as MenuGroup[]).filter(g => g.type === 'menu')
    ))
    const modulesData = (response as MenuGroup[]).filter(g => g.type === 'module');
    (window as any).__modulesData = modulesData
    addLog("success", 'Данные меню загружены')
  } catch (error) {
    addLog('error', `Ошибка загрузки меню - ${error}`)
    addNotification('error', 'Не удалось загрузить меню')
  } finally {
    loading.value = false
  }
}

const initDefaultMenu = async () => {
  addLog('warning', 'Не удалось загрузить текущее меню, начинаю установку стартового меню...')
  try {
    await $fetch('/api/menu/init', { method: 'POST' })
    await loadMenuFromAPI()
  } catch (error) {
    addLog('error', `Ошибка инициализации меню - ${error}`)
  }
}

const safeModuleData = (module: any) => ({
  _id: module._id?.toString?.() || module._id,
  name: module.name,
  format: module.format,
  code: module.code,
  fileName: module.fileName
})

const filterItemsByRole = (items = [], role: string) => {
  return items
      .filter(item => {
        if (item.isActive === false) return false
        if (Array.isArray(item.requiredRole)) return item.requiredRole.includes(role)
        return item.requiredRole === role
      })
      .map(item => ({
        ...item,
        items: filterItemsByRole(item.items || [], role),
      }))
      .filter(item => !(item.items && item.items.length === 0 && item.componentName === undefined))
}

const createDynamicMenuItems = () => {
  if (!dynamicModules.value.length) return []
  return dynamicModules.value.map(module => ({
    // Используем такой же ID как в module.post.ts
    id: `module_${module._id}`,
    title: module.name,
    format: module.format,
    requiredRole: ['Управляющий', 'Сотрудник'],
    isActive: true,
    isModule: true,
    moduleId: module._id,
    componentName: module.format === 'vue' ? 'DynamicModuleLoader' : undefined,
    moduleData: safeModuleData(module),
    isScript: module.format !== 'vue'
  }))
}

const modulesGroups = computed<any[]>(() => {
  const isLoggedIn = token.value && enterpriseDataStr.value
  if (!isLoggedIn) return []

  const staticModulesGroups = ((window as any).__modulesData || menuGroups.value.filter(g => g.type === 'module')) as any[]
  const dynamicModulesItems = createDynamicMenuItems()

  if (dynamicModulesItems.length > 0) {
    const dynamicGroup: any = {
      id: 'MoloModules_',
      title: 'Мои модули',
      requiredRole: ['Управляющий', 'Сотрудник'],
      isActive: true,
      items: dynamicModulesItems
    }
    return [...staticModulesGroups, dynamicGroup]
  }

  return staticModulesGroups
})

const getPaddingLeft = (depth: number = 0): string => `${10 + depth * 20}px`

const getLockMessage = () => {
  switch (props.role) {
    case 'Пользователь': return 'Доступ заблокирован, свяжитесь с Вашим Управляющим!'
    case 'Сотрудник': return 'Для доступа нужна должность "Управляющий"'
    case 'Управляющий': return 'Вы уже имеете полный доступ'
    default: return 'Недостаточно прав для просмотра'
  }
}

const getWindowSizeOptions = (itemId: string): WindowSizeOptions | undefined => {
  const presets: Record<string, WindowSizeOptions> = {
    login: { width: 400, height: 450, minWidth: 350, minHeight: 400 },
    creature: { width: 1000, height: 650, minWidth: 500, minHeight: 600 },
    register: { width: 1000, height: 650, minWidth: 500, minHeight: 600 },
    notFound: { width: 700, height: 650, minWidth: 500, minHeight: 600 },
    browser: { width: 800, height: 650, minWidth: 500, minHeight: 600 },
    customisation: { width: 800, height: 650, minWidth: 500, minHeight: 600 },
  }
  return presets[itemId]
}

const restartModule = async (moduleData: any) => {
  if (!moduleData?.code) {
    addNotification('error', 'Нет кода для выполнения')
    return
  }
  try {
    addNotification('warning', `Перезапуск модуля...`)
    addLog('warning', `Перезапуск модуля "${moduleData.name}"...`)
    const result = await restartScript(moduleData.code, moduleData.format, moduleData._id || moduleData.fileName, moduleData.name)
    runningModules.value.set(moduleData._id || moduleData.fileName, result)
    addLog('success', `Модуль "${moduleData.name}" перезапущен`)
  } catch (err) {
    addNotification('error', `Ошибка перезапуска модуля`)
    addLog('error', err || `Ошибка перезапуска модуля - ${moduleData.name}`)
  }
}

const autoExecuteModules = async () => {
  if (!currentEnterprise.value?._id) return
  addLog('info', 'Начинаю запуск модулей...')
  try {
    const response = await $fetch(`/api/enterprises/${currentEnterprise.value._id}/dynamicModules`)
    const modules = response.modules || []
    for (const module of modules) {
      if ((module.format === 'js' || module.format === 'ts') && module.isActive) {
        try {
          const result = await executeScriptBackground(module.code, module.format, module.name)
          runningModules.value.set(module._id || module.fileName, result)
          addLog('success', `Модуль "${module.name}" успешно запущен`)
        } catch (err) {
          addNotification('error', err || `Ошибка выполнения модуля`)
          addLog('error', err || `Ошибка выполнения ${module.name}:`)
        }
      }
    }
  } catch (error) {
    addLog('error', `Ошибка автозапуска модулей - ${error}`)
  }
}

const handleMouseMove = (event: MouseEvent, refElement: Ref<HTMLElement | null>) => {
  if (!refElement.value) return
  const rect = refElement.value.getBoundingClientRect()
  tooltipPosition.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
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

const handleGroupEnter = (groupId: string) => { activeGroup.value = groupId }
const handleGroupLeave = () => { activeGroup.value = null }
const handleModulesGroupEnter = (groupId: string) => { activeModulesGroup.value = groupId }
const handleModulesGroupLeave = () => { activeModulesGroup.value = null }

const toggleExpand = (itemId: string, isModules: boolean = false) => {
  const expandedSet = isModules ? expandedModulesItems.value : expandedItems.value
  if (expandedSet.has(itemId)) expandedSet.delete(itemId)
  else expandedSet.add(itemId)
}

const getFullModuleData = (moduleId: string) => {
  // Ищем модуль в загруженных динамических модулях по _id
  const fullModule = dynamicModules.value.find(m =>
      m._id === moduleId || m._id?.toString() === moduleId?.toString()
  )

  if (fullModule) {
    return safeModuleData(fullModule)
  }

  // Если не нашли по _id, ищем по moduleId (для старых записей)
  const byModuleId = dynamicModules.value.find(m =>
      m.moduleId === moduleId
  )

  if (byModuleId) {
    return safeModuleData(byModuleId)
  }

  return null
}

const handleLinkClick = (groupId: string, itemId: string, subGroupId?: string, componentPath?: string, moduleData?: any) => {
  if (props.role === 'Пользователь') {
    addNotification('LOCKED')
    return
  }

  if (itemId === 'manage_modules') return

  const sizeOptions = getWindowSizeOptions(itemId)
  const isModal = false

  emit('open-window', groupId, itemId, subGroupId, sizeOptions, isModal, componentPath, moduleData)
}

const handleMenuItemClick = (event: MouseEvent, groupId: string, item: any, isModules = false) => {
  event.preventDefault()
  if (item.items?.length) {
    toggleExpand(item.id, isModules)
    return
  }

  let moduleData = (item as any).moduleData

  // Если это модуль из любого меню – получаем полные данные
  if ((item as any).isModule && (item as any).moduleId) {
    const fullData = getFullModuleData((item as any).moduleId)
    if (fullData) {
      moduleData = fullData
    } else {
      // Если не нашли в dynamicModules, но есть moduleData из меню
      moduleData = moduleData || {
        _id: (item as any).moduleId,
        name: item.title,
        format: (item as any).format || 'vue'
      }
    }
  }

  // Для модулей из "Мои модули" (у них уже есть moduleData с code)
  if (!moduleData && item.moduleData) {
    moduleData = item.moduleData
  }

  const isScriptModule = moduleData && moduleData.format !== 'vue'

  if (isScriptModule && moduleData?.code) {
    restartModule(moduleData)
    return
  }

  handleLinkClick(groupId, item.id, undefined, item.componentPath, moduleData)
}

const handleChildItemClick = (groupId: string, parentItem: any, childItem: any, isModules = false) => {
  let moduleData = (childItem as any).moduleData

  // Для модулей из меню – получаем полные данные
  if ((childItem as any).isModule && (childItem as any).moduleId) {
    const fullData = getFullModuleData((childItem as any).moduleId)
    if (fullData) {
      moduleData = fullData
    } else {
      moduleData = moduleData || {
        _id: (childItem as any).moduleId,
        name: childItem.title,
        format: (childItem as any).format || 'vue'
      }
    }
  }

  const isScriptModule = moduleData && moduleData.format !== 'vue'

  if (isScriptModule && moduleData?.code) {
    restartModule(moduleData)
    return
  }

  handleLinkClick(groupId, childItem.id, parentItem.id, childItem.componentPath, moduleData)
}

const customStorageEvent = async () => {
  updateAuthData()
  if (currentEnterprise.value?._id) {
    await loadDynamicModules()
  }
  menuGroups.value = []
  await nextTick()
  await loadMenuFromAPI()
}

watch([token, enterpriseDataStr, dynamicModules], async () => {
  await loadMenuFromAPI()
}, { deep: true })

onMounted(async () => {
  updateAuthData()
  if (props.role === 'Управляющий') {
    await getEnterprises()
  }
  await loadMenuFromAPI()
  if (menuGroups.value.length === 0) {
    await initDefaultMenu()
  }
  if (currentEnterprise.value?._id) {
    modulesStore.setEnterprise(currentEnterprise.value._id)
    await modulesStore.fetchModules()
    await loadDynamicModules()
    await autoExecuteModules()
  }
})

window.addEventListener('enterprise-login', customStorageEvent)
window.addEventListener('enterprise-logout', customStorageEvent)
window.addEventListener('storage', customStorageEvent)
window.addEventListener('modules-updated', customStorageEvent)
window.addEventListener('module-imported', customStorageEvent)

onUnmounted(() => {
  window.removeEventListener('enterprise-login', customStorageEvent)
  window.removeEventListener('enterprise-logout', customStorageEvent)
  window.removeEventListener('storage', customStorageEvent)
  window.removeEventListener('modules-updated', customStorageEvent)
  window.removeEventListener('module-imported', customStorageEvent)
})
</script>

<template>
  <section
      ref="menuRef"
      class="action-list"
      :class="{ locked: isLockedHover }"
      @mousemove="handleMouseMove($event, menuRef)"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
  >
    <div v-if="menuGroups.length === 0" class="empty-menu">
      <MoloLoaders wndLoader v-if="loading"/>
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
                      'is-leaf': !item.items?.length,
                    }"
                      :style="{ paddingLeft: getPaddingLeft() }"
                      @click="(e) => handleMenuItemClick(e, group.id, item)"
                  >
                    <span class="item-title">{{ item.title }}</span>
                    <span v-if="item.items?.length" class="expand-icon" :class="{ expanded: expandedItems.has(item.id) }">
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
    <div v-if="isLockedHover && role === 'Пользователь'" class="lock-overlay">
      <img class="locked-icon" :src="lock" alt="Заблокировано"/>
      <div class="lock-message" :style="{ left: tooltipPosition.x + 10 + 'px', top: tooltipPosition.y + 10 + 'px' }">
        {{ getLockMessage() }}
      </div>
    </div>
  </section>

  <section
      v-if="modulesGroups.length > 0"
      ref="modulesRef"
      class="modules-list"
      @mousemove="handleMouseMove($event, modulesRef)"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
  >
    <div class="menu-groups">
      <div
          v-for="group in modulesGroups"
          :key="group.id"
          class="menu-group"
          @mouseenter="() => handleModulesGroupEnter(group.id)"
          @mouseleave="handleModulesGroupLeave"
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
          <div v-show="activeModulesGroup === group.id" class="group-content">
            <div class="links">
              <template v-for="item in group.items" :key="item.id">
                <div v-if="item.isActive !== false" class="menu-item-wrapper">
                  <a
                      href="#"
                      class="link"
                      :class="{
                      'has-children': item.items?.length,
                      'is-parent': item.items?.length,
                      'is-leaf': !item.items?.length,
                      'script-module': item.isScript
                    }"
                      :style="{ paddingLeft: getPaddingLeft() }"
                      @click="(e) => handleMenuItemClick(e, group.id, item, true)"
                  >
                    <span class="item-title">
                      <img v-if="item.format === 'ts'" :src="tsIcon" class="format-icon" alt="TS"/>
                      <img v-if="item.format === 'js'" :src="jsIcon" class="format-icon" alt="JS"/>
                      {{ item.title }}
                    </span>
                    <button
                        v-if="item.format == 'ts' || item.format == 'js'"
                        class="restart-btn"
                        @click.stop="restartModule(item.moduleData)"
                        title="Перезапустить модуль"
                    >
                      ↺
                    </button>
                    <span v-if="item.items?.length" class="expand-icon" :class="{ expanded: expandedModulesItems.has(item.id) }">
                      <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                  </a>
                  <transition name="expand">
                    <div v-if="item.items?.length && expandedModulesItems.has(item.id)" class="submenu">
                      <div
                          v-for="childItem in item.items"
                          :key="childItem.id"
                          class="child-link"
                          :style="{ paddingLeft: getPaddingLeft(1) }"
                          @click="handleChildItemClick(group.id, item, childItem, true)"
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
  </section>
</template>

<style scoped>
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
  background-color: rgba(56, 114, 239, 0.1);
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
  background: rgba(56, 114, 239, 0.1);
}

.link.has-children {
  cursor: pointer;
}

.link.is-parent {
  color: rgba(255, 255, 255, 0.9);
}

.link.is-parent:hover {
  color: var(--half_opacity_border_hover);
}

.link.is-leaf:hover {
  color: var(--half_opacity_border_hover);
}

.item-title {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.format-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
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

.modules-list {
  position: absolute;
  border: 1px solid var(--half_opacity_border);
  background-color: var(--half_opacity_bg);
  border-radius: 10px;
  display: flex;
  top: 50%;
  right: 20px;
  transform: translate(0, -50%);
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

.modules-list:hover {
  border-color: var(--half_opacity_border_hover);
}

.modules-list.locked {
  background-color: rgba(255, 255, 255, 0.05);
}

.modules-list.locked:hover {
  border-color: #FA5252;
}

.restart-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  margin-left: 8px;
  transition: all 0.5s ease;
  opacity: 0;
}

.menu-item-wrapper:hover .restart-btn {
  opacity: 1;
}

.restart-btn:hover {
  color: var(--half_opacity_border_hover);
  transform: rotate(-360deg);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 767px) {
  .action-list {
    left: 10px;
    right: 10px;
    padding: 20px;
    min-width: auto;
    width: calc(100% - 40px);
  }
}
</style>