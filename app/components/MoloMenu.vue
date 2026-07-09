<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import lock from '~~/public/lock.svg'
import tsIcon from '~~/public/ts.png'
import jsIcon from '~~/public/js.png'

const props = defineProps<{ role: string }>()
const emit = defineEmits<{
  'lock-hover': [value: boolean]
  'open-window': [...args: any[]]
}>()

// ===== STATE =====
const loading = ref(false)
const menuGroups = ref<any[]>([])
const modulesGroups = ref<any[]>([])
const dynamicModules = ref<any[]>([])
const activeGroup = ref<string | null>(null)
const expandedItems = ref<Set<string>>(new Set())
const showLock = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)
let closeTimeout: ReturnType<typeof setTimeout> | null = null

// ===== COMPUTED =====
const allGroups = computed(() => [...menuGroups.value, ...modulesGroups.value])

// ===== AUTH =====
const getEnterprise = () => {
  try {
    const data = localStorage.getItem('currentEnterprise')
    return data ? JSON.parse(data) : null
  } catch { return null }
}

const getToken = () => localStorage.getItem('enterprise_token')

// ===== MENU LOADING =====
const loadMenu = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/menu', {
      params: { role: props.role, type: 'all' }
    })

    menuGroups.value = (response as any[])
        .filter(g => g?.type === 'menu')
        .map(g => ({
          ...g,
          items: (g.items || []).map((item: any) => ({
            ...item,
            placeName: item.placeName || item.id,
            format: item.format || 'vue'
          }))
        }))

    modulesGroups.value = (response as any[])
        .filter(g => g?.type === 'module')

    ;(window as any).__modulesData = modulesGroups.value
  } catch (error) {
    console.error('Menu load error:', error)
  } finally {
    loading.value = false
  }
}

const loadDynamicModules = async () => {
  const enterprise = getEnterprise()
  if (!enterprise?._id) return

  try {
    const response = await $fetch(`/api/enterprises/${enterprise._id}/dynamicModules`)
    dynamicModules.value = response.modules || []
  } catch (error) {
    console.error('Dynamic modules error:', error)
  }
}

const createDynamicItems = () => {
  return dynamicModules.value
      .filter(m => m && m._id)
      .map(m => ({
        id: m.fileName || `module_${m._id}`,
        placeName: m.fileName || `module_${m._id}`,
        title: m.name || 'Без названия',
        format: m.format,
        isActive: true,
        isModule: true,
        moduleId: m._id,
        moduleData: {
          _id: m._id,
          name: m.name,
          format: m.format,
          code: m.code || '',
          fileName: m.fileName
        },
        componentName: m.format === 'vue' ? 'DynamicModuleLoader' : undefined,
        isScript: m.format !== 'vue'
      }))
}

const updateModules = () => {
  const isLoggedIn = getToken() && getEnterprise()
  if (!isLoggedIn) {
    modulesGroups.value = []
    return
  }

  const staticModules = (window as any).__modulesData || []
  const dynamic = createDynamicItems()

  modulesGroups.value = dynamic.length
      ? [...staticModules, { title: 'Мои модули', items: dynamic }]
      : staticModules
}

// ===== HANDLERS =====
const openGroup = (id: string) => {
  if (closeTimeout) clearTimeout(closeTimeout)
  activeGroup.value = id
}

const closeGroup = (id: string) => {
  closeTimeout = setTimeout(() => {
    if (activeGroup.value === id) {
      activeGroup.value = null
      expandedItems.value.clear()
    }
  }, 200)
}

const toggleSubmenu = (id: string) => {
  if (expandedItems.value.has(id)) {
    expandedItems.value.delete(id)
  } else {
    expandedItems.value.add(id)
  }
}

const getSizeOptions = (id: string) => {
  const presets: Record<string, any> = {
    login: { width: 400, height: 450 },
    browser: { width: 900, height: 650 },
    register: { width: 1000, height: 650 },
    customisation: { width: 800, height: 600 },
    creature: { width: 1000, height: 650 },
    control: { width: 1000, height: 650 },
  }
  return presets[id]
}

const openWindow = (groupId: string, item: any, parent?: any) => {
  if (!item) return

  const sizeOptions = getSizeOptions(item.id)
  const placeName = item.placeName || item.id
  const parentPlaceName = parent?.placeName || parent?.id
  const title = item.title || item.moduleData?.name || 'Модуль'

  let moduleData = item.moduleData || {}

  if (item.format === 'vue' && item.moduleId) {
    moduleData = {
      ...moduleData,
      moduleId: item.moduleId,
      _id: item.moduleId,
      name: title,
      format: item.format,
      code: moduleData.code || ''
    }
  }

  emit('open-window',
      groupId,
      placeName,
      parentPlaceName,
      sizeOptions,
      false,
      item.componentPath || item.componentName || 'modules/DynamicModuleLoader',
      moduleData,
      undefined,
      title
  )

  // Закрываем меню
  activeGroup.value = null
  expandedItems.value.clear()
}

const handleItemClick = (groupId: string, item: any) => {
  if (item.isScript) {
    restartModule(item.moduleData)
    return
  }
  openWindow(groupId, item)
}

// ===== MODULES =====
const restartModule = async (moduleData: any) => {
  if (!moduleData) return
  try {
    // Используем функцию из композабла или просто логируем
    console.log('Restart module:', moduleData.name)
  } catch (e) {
    console.error('Restart error:', e)
  }
}

const executeModules = async () => {
  const enterprise = getEnterprise()
  if (!enterprise?._id) return

  try {
    const response = await $fetch(`/api/enterprises/${enterprise._id}/dynamicModules`)
    const modules = response.modules || []
    for (const module of modules) {
      if (module && (module.format === 'js' || module.format === 'ts') && module.isActive) {
        console.log('Execute module:', module.name)
      }
    }
  } catch (e) {
    console.error('Execute error:', e)
  }
}

// ===== LOCK =====
const onLockEnter = () => {
  if (props.role === 'Пользователь') {
    showLock.value = true
    emit('lock-hover', true)
  }
}

const onLockLeave = () => {
  if (props.role === 'Пользователь') {
    showLock.value = false
    emit('lock-hover', false)
  }
}

const handleMouseMove = (e: MouseEvent) => {
  tooltipX.value = e.clientX + 10
  tooltipY.value = e.clientY + 10
}

// ===== LIFECYCLE =====
onMounted(async () => {
  window.addEventListener('mousemove', handleMouseMove)

  await loadMenu()

  if (!menuGroups.value.length) {
    await $fetch('/api/menu/init', { method: 'POST' })
    await loadMenu()
  }

  const enterprise = getEnterprise()
  if (enterprise?._id) {
    await loadDynamicModules()
    updateModules()
    await executeModules()
  }
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  if (closeTimeout) clearTimeout(closeTimeout)
})

// Обновление при событиях
const handleUpdate = async () => {
  await loadDynamicModules()
  await loadMenu()
  updateModules()
}

window.addEventListener('storage', handleUpdate)
window.addEventListener('enterprise-login', handleUpdate)
window.addEventListener('enterprise-logout', handleUpdate)
window.addEventListener('modules-updated', handleUpdate)

onUnmounted(() => {
  window.removeEventListener('storage', handleUpdate)
  window.removeEventListener('enterprise-login', handleUpdate)
  window.removeEventListener('enterprise-logout', handleUpdate)
  window.removeEventListener('modules-updated', handleUpdate)
})
</script>

<template>
  <div class="menu-wrapper">
    <!-- Левое меню -->
    <nav class="menu-nav" @mouseenter="onLockEnter" @mouseleave="onLockLeave">
      <div v-if="loading" class="loading">Загрузка...</div>

      <template v-else>
        <!-- Группы -->
        <div
            v-for="group in allGroups"
            :key="group.id"
            class="group"
            @mouseenter="openGroup(group.id)"
            @mouseleave="closeGroup(group.id)"
        >
          <div class="group-header">
            <span>{{ group.title }}</span>
            <span class="arrow">▼</span>
          </div>

          <!-- Выпадающий список -->
          <div v-if="activeGroup === group.id" class="dropdown">
            <template v-for="item in group.items?.filter(i => i?.isActive !== false)" :key="item.id">
              <!-- Родительский элемент с детьми -->
              <div v-if="item.items?.length" class="item-wrapper">
                <div
                    class="item parent"
                    @click="toggleSubmenu(item.id)"
                >
                  <span>{{ item.title }}</span>
                  <span class="expand">›</span>
                </div>

                <!-- Дочерние элементы -->
                <div v-if="expandedItems.has(item.id)" class="submenu">
                  <div
                      v-for="child in item.items"
                      :key="child.id"
                      class="submenu-item"
                      @click="openWindow(group.id, child, item)"
                  >
                    {{ child.title }}
                  </div>
                </div>
              </div>

              <!-- Обычный элемент -->
              <div
                  v-else
                  class="item"
                  :class="{ script: item.isScript }"
                  @click="handleItemClick(group.id, item)"
              >
                <span class="title">
                  <img v-if="item.format === 'ts'" :src="tsIcon" class="icon" />
                  <img v-if="item.format === 'js'" :src="jsIcon" class="icon" />
                  {{ item.title }}
                </span>

                <button
                    v-if="item.isScript"
                    class="restart-btn"
                    @click.stop="restartModule(item.moduleData)"
                >
                  ↻
                </button>
              </div>
            </template>
          </div>
        </div>
      </template>
    </nav>

    <!-- Замок -->
    <div v-if="showLock" class="lock-overlay">
      <img :src="lock" class="lock-icon" />
      <div class="lock-tooltip" :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }">
        Нет доступа
      </div>
    </div>
  </div>
</template>


<style scoped>
.menu-wrapper {
  display: flex;
  justify-content: center;
  z-index: 100;
}

.menu-nav {
  display: flex;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px);
  border-radius: 10px;
  padding: 8px 10px;
}

.loading {
  padding: 8px 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

/* Группы */
.group {
  position: relative;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: 0.2s;
}

.group-header:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.arrow {
  font-size: 10px;
  opacity: 0.6;
  transition: transform 0.2s;
}

.group:hover .arrow {
  transform: rotate(180deg);
  opacity: 1;
}

/* Выпадающий список */
.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  background: rgba(20, 20, 30, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px 0;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

/* Элементы */
.item-wrapper {
  position: relative;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  transition: 0.15s;
  white-space: nowrap;
}

.item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.item.parent {
  font-weight: 500;
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  width: 16px;
  height: 16px;
}

.expand {
  font-size: 14px;
  opacity: 0.5;
  margin-left: 12px;
  transition: transform 0.2s;
}

.item:hover .expand {
  opacity: 1;
}

/* Подменю */
.submenu {
  position: absolute;
  left: calc(100% + 4px);
  top: -8px;
  min-width: 200px;
  background: rgba(20, 20, 30, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px 0;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  z-index: 1001;
}

.submenu-item {
  padding: 8px 16px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  transition: 0.15s;
  white-space: nowrap;
}

.submenu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding-left: 20px;
}

/* Кнопка перезапуска */
.restart-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: 0.2s;
  font-size: 14px;
}

.restart-btn:hover {
  color: #6ea2ff;
  background: rgba(110, 162, 255, 0.1);
  transform: rotate(180deg);
}

/* Замок */
.lock-overlay {
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

/* Адаптив */
@media (max-width: 900px) {
  .menu-nav {
    flex-wrap: wrap;
    width: 100%;
  }

  .dropdown {
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
  }
}
</style>