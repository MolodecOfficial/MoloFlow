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

const expandedItems = ref<Set<string>>(new Set())
const expandedModulesItems = ref<Set<string>>(new Set())

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
      .filter(module => module && module._id) // Фильтруем невалидные модули
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
        .filter(g => g && g.type === 'menu') // Фильтруем null/undefined

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
          .filter(Boolean) // Убираем null/undefined

  const dynamic = createDynamicMenuItems()

  return dynamic.length
      ? [...staticModules, { id: 'dynamic_modules', title: 'Мои модули', items: dynamic }]
      : staticModules
})

/* =========================
   UI HELPERS
========================= */

const getPaddingLeft = (depth: number = 0) => `${10 + depth * 20}px`

const handleGroupEnter = (id: string) => activeGroup.value = id
const handleGroupLeave = () => activeGroup.value = null

const handleModulesGroupEnter = (id: string) => activeModulesGroup.value = id
const handleModulesGroupLeave = () => activeModulesGroup.value = null

const toggleExpand = (id: string, isModules = false) => {
  const set = isModules ? expandedModulesItems.value : expandedItems.value
  set.has(id) ? set.delete(id) : set.add(id)
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
  }

  return presets[itemId]
}

/* =========================
   LOCK
========================= */

const handleMouseMove = (event: MouseEvent, refEl: Ref<HTMLElement | null>) => {
  if (!refEl.value) return

  const rect = refEl.value.getBoundingClientRect()

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

/* =========================
   CLICK HANDLERS
========================= */

const handleMenuItemClick = (event: MouseEvent, groupId: string, item: any, isModule = false) => {
  if (!item) return

  if (item.items?.length) {
    toggleExpand(item.id, isModule)
    return
  }

  if (item.isScript) {
    // Для скриптовых модулей - запускаем выполнение
    restartModule(item.moduleData)
    return
  }

  const sizeOptions = getWindowSizeOptions(item.id)

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
window.addEventListener('modules-updated', customStorageEvent) // Добавил слушатель обновления модулей

onUnmounted(() => {
  window.removeEventListener('storage', customStorageEvent)
  window.removeEventListener('enterprise-login', customStorageEvent)
  window.removeEventListener('enterprise-logout', customStorageEvent)
  window.removeEventListener('modules-updated', customStorageEvent)
})
</script>

<template>
  <!-- ЛЕВОЕ МЕНЮ -->
  <section
      ref="menuRef"
      class="menu-panel"
      :class="{ locked: isLockedHover }"
      @mousemove="handleMouseMove($event, menuRef)"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
  >
    <div v-if="loading" class="loading">
      Загрузка меню...
    </div>

    <div v-else class="groups">
      <div
          v-for="group in menuGroups"
          :key="group.id"
          class="group"
          @mouseenter="handleGroupEnter(group.id)"
          @mouseleave="handleGroupLeave"
      >
        <div class="group-header">
          <span>{{ group.title }}</span>
          <span class="arrow">›</span>
        </div>

        <transition name="fade">
          <div v-show="activeGroup === group.id" class="items">
            <div
                v-for="item in (group.items || []).filter(i => i && i.isActive !== false)"
                :key="item.id"
                class="item-wrapper"
            >
              <div
                  class="item"
                  :class="{ parent: item.items?.length }"
                  @click="handleMenuItemClick($event, group.id, item)"
              >
                <span class="title">
                  {{ item.title }}
                </span>

                <span
                    v-if="item.items?.length"
                    class="expand"
                    @click.stop="toggleExpand(item.id)"
                >
                  ›
                </span>
              </div>

              <!-- CHILDREN -->
              <div
                  v-if="item.items?.length && expandedItems.has(item.id)"
                  class="children"
              >
                <div
                    v-for="child in (item.items || []).filter(c => c)"
                    :key="child.id"
                    class="child"
                    @click="handleChildItemClick(group.id, item, child)"
                >
                  {{ child.title }}
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- LOCK -->
    <div v-if="isLockedHover && role === 'Пользователь'" class="lock">
      <img :src="lock" class="lock-icon" />
      <div
          class="lock-tooltip"
          :style="{ left: tooltipPosition.x + 10 + 'px', top: tooltipPosition.y + 10 + 'px' }"
      >
        Нет доступа
      </div>
    </div>
  </section>

  <!-- ПРАВОЕ МЕНЮ (MODULES) -->
  <section
      ref="modulesRef"
      class="menu-panel right"
      @mousemove="handleMouseMove($event, modulesRef)"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
  >
    <div class="groups">
      <div
          v-for="group in modulesGroups"
          :key="group.id"
          class="group"
          @mouseenter="handleModulesGroupEnter(group.id)"
          @mouseleave="handleModulesGroupLeave"
      >
        <div class="group-header">
          <span>{{ group.title }}</span>
          <span class="arrow">›</span>
        </div>

        <transition name="fade">
          <div v-show="activeModulesGroup === group.id" class="items">
            <div
                v-for="item in (group.items || []).filter(i => i)"
                :key="item.id"
                class="item-wrapper"
            >
              <div
                  class="item"
                  :class="{ script: item.isScript }"
                  @click="handleMenuItemClick($event, group.id, item, true)"
              >
                <span class="title">
                  <img
                      v-if="item.format === 'ts'"
                      :src="tsIcon"
                      class="icon"
                  />
                  <img
                      v-if="item.format === 'js'"
                      :src="jsIcon"
                      class="icon"
                  />
                  {{ item.title }}
                </span>

                <button
                    v-if="item.isScript"
                    class="restart"
                    @click.stop="restartModule(item.moduleData)"
                >
                  ↻
                </button>

                <span
                    v-if="item.items?.length"
                    class="expand"
                    @click.stop="toggleExpand(item.id, true)"
                >
                  ›
                </span>
              </div>

              <div
                  v-if="item.items?.length && expandedModulesItems.has(item.id)"
                  class="children"
              >
                <div
                    v-for="child in (item.items || []).filter(c => c)"
                    :key="child.id"
                    class="child"
                    @click="handleChildItemClick(group.id, item, child, true)"
                >
                  {{ child.title }}
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* =========================
   PANEL BASE
========================= */

.menu-panel {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);

  width: 280px;
  max-height: 70vh;

  display: flex;
  flex-direction: column;

  padding: 18px;

  border-radius: 24px;

  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);

  backdrop-filter: blur(18px);

  transition: 0.25s ease;

  overflow: hidden;
}

.menu-panel:hover {
  border-color: rgba(56,114,239,0.25);
}

.menu-panel.locked {
  border-color: rgba(250,80,80,0.25);
}

.menu-panel.right {
  right: 20px;
}

.menu-panel:not(.right) {
  left: 20px;
}

/* =========================
   GROUPS
========================= */

.groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group {
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding-bottom: 10px;
}

/* =========================
   HEADER
========================= */

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 10px;

  cursor: pointer;

  color: rgba(255,255,255,0.8);

  transition: 0.2s ease;
}

.group-header:hover {
  color: #fff;
  transform: translateX(2px);
}

.arrow {
  opacity: 0.5;
  transition: 0.2s ease;
}

.group-header:hover .arrow {
  opacity: 1;
  transform: rotate(90deg);
}

/* =========================
   ITEMS
========================= */

.items {
  padding-left: 10px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-wrapper {
  display: flex;
  flex-direction: column;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 8px 10px;

  border-radius: 12px;

  cursor: pointer;

  color: rgba(255,255,255,0.7);

  transition: 0.2s ease;
}

.item:hover {
  background: rgba(255,255,255,0.05);
  color: #fff;
  transform: translateX(2px);
}

.item.parent {
  font-weight: 600;
}

/* =========================
   CHILDREN
========================= */

.children {
  padding-left: 14px;
  margin-top: 4px;

  border-left: 1px solid rgba(255,255,255,0.08);
}

.child {
  padding: 6px 10px;

  font-size: 13px;

  color: rgba(255,255,255,0.6);

  cursor: pointer;

  border-radius: 8px;

  transition: 0.2s ease;
}

.child:hover {
  background: rgba(255,255,255,0.04);
  color: #fff;
  transform: translateX(2px);
}

/* =========================
   ICONS
========================= */

.icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
}

/* =========================
   BUTTONS
========================= */

.restart {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.5);

  cursor: pointer;

  transition: 0.2s ease;
}

.restart:hover {
  color: #6ea2ff;
  transform: rotate(180deg);
}

/* =========================
   LOCK
========================= */

.lock {
  position: absolute;
  inset: 0;

  display: flex;
  justify-content: center;
  align-items: center;

  background: rgba(0,0,0,0.15);
}

.lock-icon {
  width: 40px;
  height: 40px;
  opacity: 0.8;
}

.lock-tooltip {
  position: absolute;

  padding: 8px 10px;

  border-radius: 10px;

  font-size: 12px;

  color: white;

  background: rgba(0,0,0,0.85);
  border: 1px solid rgba(255,80,80,0.3);
}

/* =========================
   ANIMATION
========================= */

.fade-enter-active,
.fade-leave-active {
  transition: 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* =========================
   RESPONSIVE
========================= */

@media (max-width: 900px) {
  .menu-panel {
    position: relative;
    transform: none;
    width: 100%;
    margin-bottom: 16px;
  }
}
</style>