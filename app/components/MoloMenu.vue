<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref} from 'vue'
import {storeToRefs} from 'pinia'
import lock from '~~/public/lock.svg'
import tsIcon from '~~/public/ts.png'
import jsIcon from '~~/public/js.png'
import {useMoloMenuStore} from '~~/stores/moloMenuStore'
import {useAppStore} from "~~/stores/appStore";

const props = defineProps<{ role: string }>()
const emit = defineEmits<{
  'lock-hover': [value: boolean]
  'open-window': [...args: any[]]
}>()

// ===== STORE =====
const menuStore = useMoloMenuStore()
const appStore = useAppStore()
const {addLog} = useLogger('Меню')
const {menuGroups, staticModuleGroups, dynamicModules, menuLoaded} = storeToRefs(menuStore)

// ===== STATE =====
const loading = ref(!menuLoaded.value)
const isLoaded = ref(false)
const showLock = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)

// ===== STATE (Command Deck) =====
const isOpen = ref(false)
const activeGroupId = ref<string | null>(null)
const breadcrumbStack = ref<any[]>([])
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const enterpriseData = () => {
  return appStore.getEnterpriseId()
}

const getToken = () => localStorage.getItem('enterprise_token')

// ===== ДИНАМИЧЕСКИЕ ПУНКТЫ МОДУЛЕЙ =====
const createDynamicItems = () => {
  return dynamicModules.value
      .filter((m: any) => m && m._id)
      .map((m: any) => ({
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

const modulesGroups = computed(() => {
  const isLoggedIn = getToken() && enterpriseData()
  if (!isLoggedIn) return []

  const staticModules = staticModuleGroups.value
  const dynamic = createDynamicItems()

  return dynamic.length
      ? [...staticModules, {title: 'Мои модули', items: dynamic}]
      : staticModules
})

const allGroups = computed(() => {
  const merged = [...menuGroups.value, ...modulesGroups.value]
  return merged.map((g: any, idx: number) => ({
    ...g,
    id: g.id || g.groupId
  }))
})

// ===== ОСНОВНОЙ COMPUTED ДЛЯ КЛАССОВ ОРБА =====
const orbClasses = computed(() => ({
  lg: loading.value === true,
  empty: isLoaded.value === true && allGroups.value.length === 0
}))

const loadAll = async (force = false) => {
  const enterprise = enterpriseData()

  if (enterprise) {
    addLog("info", 'Загружаю меню для предприятия...');
  }

  await Promise.all([
    menuStore.loadMenu(props.role, force),
    enterprise ? menuStore.loadDynamicModules(enterprise, force) : Promise.resolve()
  ])

  // ПРОВЕРКА ДО ЦИКЛА
  if (dynamicModules.value.length === 0) {
    addLog('error', 'Ошибка загрузки меню: Динамические модули не загружены')
    return // или continue, если нужно выполнить другой код
  }

  // Теперь цикл выполняется только если есть модули
  for (const module of dynamicModules.value) {
    if (module && (module.format === 'js' || module.format === 'ts') && module.isActive) {
      console.log('Execute module:', module.name)
    }
  }
}

// =====================================================================
// COMMAND DECK — навигация по панели
// =====================================================================

const ACCENT_PALETTE = ['#5b8def', '#8b5cf6', '#33d17a', '#d29922', '#ef5b8d', '#3ecfd6']
const categoryColor = (title: string) => {
  let hash = 0
  const str = title || ''
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length]
}

const activeGroup = computed(() =>
    allGroups.value.find(g => g.id === activeGroupId.value) || allGroups.value[0] || null
)

const currentItems = computed(() => {
  if (!activeGroup.value) return []
  const base = breadcrumbStack.value.length
      ? breadcrumbStack.value[breadcrumbStack.value.length - 1].items
      : activeGroup.value.items
  return (base || []).filter((i: any) => i?.isActive !== false)
})

const itemCount = (group: any) =>
    (group.items || []).filter((i: any) => i?.isActive !== false).length

const selectCategory = (group: any) => {
  activeGroupId.value = group.id
  breadcrumbStack.value = []
}

const jumpBreadcrumb = (index: number) => {
  breadcrumbStack.value = index < 0 ? [] : breadcrumbStack.value.slice(0, index + 1)
}

const flattenItems = (items: any[], group: any, parents: any[] = []): any[] => {
  let out: any[] = []
  for (const item of (items || [])) {
    if (item?.isActive === false) continue
    out.push({item, group, parents: [...parents]})
    if (item.items?.length) {
      out = out.concat(flattenItems(item.items, group, [...parents, item]))
    }
  }
  return out
}

const flatIndex = computed(() => allGroups.value.flatMap(g => flattenItems(g.items, g)))

const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return flatIndex.value
      .filter(r => (r.item.title || '').toLowerCase().includes(q))
      .slice(0, 40)
})

const resultPath = (result: any) => {
  const parts = [result.group.title, ...result.parents.map((p: any) => p.title)]
  return parts.filter(Boolean).join(' / ')
}

const openItem = (item: any, group: any, parent?: any) => {
  if (item.isScript) {
    restartModule(item.moduleData)
    closePanel()
    return
  }
  openWindow(group.id, item, parent)
  closePanel()
}

const handleCardClick = (item: any) => {
  if (!activeGroup.value) return
  if (item.items?.length) {
    breadcrumbStack.value = [...breadcrumbStack.value, item]
    return
  }
  const parent = breadcrumbStack.value[breadcrumbStack.value.length - 1]
  openItem(item, activeGroup.value, parent)
}

const selectResult = (result: any) => {
  if (result.item.items?.length) {
    activeGroupId.value = result.group.id
    breadcrumbStack.value = [...result.parents, result.item]
    searchQuery.value = ''
    nextTick(() => searchInputRef.value?.focus())
    return
  }
  const parent = result.parents[result.parents.length - 1]
  openItem(result.item, result.group, parent)
}

const quickCategories = computed(() => allGroups.value.slice(0, 6))

const openPanel = () => {
  isOpen.value = true
  if (!activeGroupId.value || !allGroups.value.some(g => g.id === activeGroupId.value)) {
    activeGroupId.value = allGroups.value[0]?.id || null
  }
  breadcrumbStack.value = []
  searchQuery.value = ''
  nextTick(() => searchInputRef.value?.focus())
}

const openPanelWithCategory = (group: any) => {
  isOpen.value = true
  activeGroupId.value = group.id
  breadcrumbStack.value = []
  searchQuery.value = ''
}

const closePanel = () => {
  isOpen.value = false
  searchQuery.value = ''
}

const togglePanel = () => (isOpen.value ? closePanel() : openPanel())

// =====================================================================
// Открытие окна / перезапуск скрипта
// =====================================================================

const getSizeOptions = (id: string) => {
  const presets: Record<string, any> = {
    login: {width: 400, height: 450},
    browser: {width: 900, height: 650},
    register: {width: 1000, height: 650},
    customisation: {width: 800, height: 600},
    creature: {width: 1000, height: 650},
    control: {width: 1000, height: 650},
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
}

const restartModule = async (moduleData: any) => {
  if (!moduleData) return
  try {
    console.log('Restart module:', moduleData.name)
  } catch (e) {
    console.error('Restart error:', e)
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

// ===== Горячие клавиши =====
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
    e.preventDefault()
    togglePanel()
  } else if (e.key === 'Escape' && isOpen.value) {
    closePanel()
  }
}

// ===== LIFECYCLE =====
onMounted(async () => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('keydown', handleGlobalKeydown)

  const alreadyCached = menuLoaded.value
  if (!alreadyCached) loading.value = true

  try {
    await loadAll(false)
  } finally {
    loading.value = false
    isLoaded.value = true
  }
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('keydown', handleGlobalKeydown)
})

const handleUpdate = async () => {
  await loadAll(true)
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
  <div class="deck-wrapper">
    <!-- ===== Триггер ===== -->
    <div class="launcher-row" @mouseenter="onLockEnter" @mouseleave="onLockLeave">
      <button class="launcher-btn" :class="{ open: isOpen }" @click="togglePanel">
        <span class="orb" :class="orbClasses">
          <span class="orb-ring" :class="orbClasses"></span>
          <span class="orb-ring delay" :class="orbClasses"></span>
          <span class="orb-core" :class="orbClasses"></span>
        </span>
        <span class="launcher-text">Меню</span>
        <span class="launcher-kbd">Ctrl + Q</span>
      </button>

      <div v-if="loading" class="loading-inline">
        <MoloLoaders wnd-loader/>
      </div>

      <div v-else class="quick-dock">
        <button
            v-for="cat in quickCategories"
            :key="cat.id"
            class="dock-blip"
            :style="{ '--blip-color': categoryColor(cat.title) }"
            :title="cat.title"
            @click="openPanelWithCategory(cat)"
        >
          {{ (cat.title || '?').charAt(0).toUpperCase() }}
        </button>
      </div>
    </div>

    <!-- ===== Панель управления ===== -->
    <Teleport to="body">
      <transition name="deck-fade">
        <div v-if="isOpen" class="deck-overlay" @click.self="closePanel">
          <transition name="deck-pop" appear>
            <div class="deck-panel">
              <!-- Командная строка -->
              <div class="deck-header">
                <div class="prompt-box">
                  <span class="prompt-caret">›</span>
                  <input
                      ref="searchInputRef"
                      v-model="searchQuery"
                      class="prompt-input"
                      type="text"
                      placeholder="найти раздел или модуль…"
                      @keydown.esc="closePanel"
                  />
                </div>
                <MoloButton class="small close" title="Закрыть (Esc)" @click="closePanel">✕</MoloButton>
              </div>

              <!-- Режим поиска -->
              <div v-if="searchQuery.trim()" class="search-mode">
                <div v-if="searchResults.length" class="search-list">
                  <button
                      v-for="(result, i) in searchResults"
                      :key="result.group.id + '-' + result.item.id + '-' + i"
                      class="search-row"
                      @click="selectResult(result)"
                  >
                    <span
                        class="search-icon"
                        :style="{ background: result.item.items?.length ? 'transparent' : undefined }"
                    >
                      <template v-if="result.item.items?.length">📁</template>
                      <img v-else-if="result.item.format === 'ts'" :src="tsIcon" alt=""/>
                      <img v-else-if="result.item.format === 'js'" :src="jsIcon" alt=""/>
                      <span v-else class="vue-badge">V</span>
                    </span>
                    <span class="search-texts">
                      <span class="search-title">{{ result.item.title }}</span>
                      <span class="search-path">{{ resultPath(result) }}</span>
                    </span>
                    <span class="search-go">↵</span>
                  </button>
                </div>
                <div v-else class="empty-block">
                  <span class="empty-emoji">🛰️</span>
                  <span>Ничего не найдено по «{{ searchQuery }}»</span>
                </div>
              </div>

              <!-- Обычный режим -->
              <div v-else class="deck-body">
                <aside class="rail">
                  <button
                      v-for="group in allGroups"
                      :key="group.id"
                      class="rail-item"
                      :class="{ active: group.id === activeGroupId }"
                      @click="selectCategory(group)"
                  >
                    <span class="rail-dot" :style="{ '--dot-color': categoryColor(group.title) }">
                      {{ (group.title || '?').charAt(0).toUpperCase() }}
                    </span>
                    <span class="rail-label">{{ group.title }}</span>
                    <span class="rail-count">{{ itemCount(group) }}</span>
                  </button>
                </aside>

                <main class="deck-main">
                  <div class="breadcrumb">
                    <span class="bc-root" @click="jumpBreadcrumb(-1)">~/{{ activeGroup?.title || '' }}</span>
                    <template v-for="(crumb, i) in breadcrumbStack" :key="crumb.id || i">
                      <span class="bc-sep">/</span>
                      <span class="bc-item" @click="jumpBreadcrumb(i)">{{ crumb.title }}</span>
                    </template>
                  </div>

                  <div v-if="currentItems.length" class="items-grid">
                    <MoloButton
                        v-for="item in currentItems"
                        :key="item.id"
                        class="item-card"
                        :class="{ folder: item.items?.length, script: item.isScript }"
                        @click="handleCardClick(item)"
                    >
                      <span class="card-icon">
                        <template v-if="item.items?.length">📁</template>
                        <img v-else-if="item.format === 'ts'" :src="tsIcon" alt=""/>
                        <img v-else-if="item.format === 'js'" :src="jsIcon" alt=""/>
                        <span v-else class="vue-badge">V</span>
                      </span>
                      <span class="card-title">{{ item.title }}</span>
                      <span>{{ item.description }}</span>
                      <span v-if="item.items?.length" class="card-meta">{{ item.items.length }} пунктов</span>
                      <span v-else-if="item.isScript" class="card-meta">скрипт · {{ item.format }}</span>
                      <span v-else class="card-meta">открыть окно</span>

                      <span
                          v-if="item.isScript"
                          class="restart-btn"
                          title="Перезапустить"
                          @click.stop="restartModule(item.moduleData)"
                      >↻</span>
                    </MoloButton>
                  </div>
                  <div v-else class="empty-block">
                    <span class="empty-emoji">📦</span>
                    <span>Здесь пока пусто</span>
                  </div>
                </main>
              </div>
            </div>
          </transition>
        </div>
      </transition>
    </Teleport>

    <!-- Замок -->
    <div v-if="showLock" class="lock-overlay">
      <img :src="lock" class="lock-icon"/>
      <div class="lock-tooltip" :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }">
        Нет доступа
      </div>
    </div>
  </div>
</template>

<style scoped>
.deck-wrapper {
  --panel-border: rgba(255, 255, 255, 0.08);
  --text-muted: #7d8590;
  display: flex;
  z-index: 100;
  padding: 10px 20px;
}

/* ===== Триггер ===== */
.launcher-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.launcher-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px 7px 10px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 999px;
  cursor: pointer;
  color: white;
  backdrop-filter: blur(18px);
  transition: background 0.2s, border-color 0.2s, transform 0.15s;
}

.launcher-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-color_hover);
}

.launcher-btn.open {
  border-color: var(--borber-color_main);
  background: rgba(91, 141, 239, 0.12);
}

.launcher-btn:active {
  transform: scale(0.97);
}

.orb {
  position: relative;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.orb-core {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--borber-color_main);
  box-shadow: 0 0 8px 1px rgba(91, 141, 239, 0.9);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.orb-core.lg {
  background: #ffd700;
  box-shadow: 0 0 16px 3px rgba(255, 215, 0, 0.8);
  animation: glow-pulse 0.8s ease-in-out infinite alternate;
}

.orb-core.empty {
  background: #ff4444;
  box-shadow: 0 0 16px 3px rgba(255, 68, 68, 0.8);
}

.orb-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--borber-color_main);
  animation: radar-pulse 2.4s ease-out infinite;
  transition: border-color 0.3s ease;
}

.orb-ring.lg {
  border-color: #ffd700;
}

.orb-ring.empty {
  border-color: #ff4444;
}

.orb-ring.delay {
  animation-delay: 1.2s;
}

@keyframes radar-pulse {
  0% {
    transform: scale(0.3);
    opacity: 0.9;
  }
  100% {
    transform: scale(2.4);
    opacity: 0;
  }
}

@keyframes glow-pulse {
  0% {
    box-shadow: 0 0 12px 2px rgba(255, 215, 0, 0.6);
  }
  100% {
    box-shadow: 0 0 24px 6px rgba(255, 215, 0, 0.9);
  }
}

.launcher-text {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.launcher-kbd {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 2px 6px;
}

.loading-inline {
  display: flex;
  align-items: center;
  padding: 0 8px;
}

.quick-dock {
  display: flex;
  gap: 6px;
}

.dock-blip {
  --blip-color: #5b8def;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.04);
  color: white;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s, border-color 0.2s;
}

.dock-blip:hover {
  transform: translateY(-2px);
  border-color: var(--blip-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--blip-color) 25%, transparent);
}

/* ===== Оверлей / панель ===== */
.deck-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 9vh 20px 20px;
  z-index: 100;
}

.deck-fade-enter-active, .deck-fade-leave-active {
  transition: opacity 0.2s ease;
}

.deck-fade-enter-from, .deck-fade-leave-to {
  opacity: 0;
}

.deck-panel {
  width: 100%;
  max-width: 920px;
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--half_opacity_border);
  border-radius: 20px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.02) inset;
  overflow: hidden;
}

.deck-pop-enter-active {
  transition: transform 0.25s cubic-bezier(.2, .9, .3, 1.2), opacity 0.2s ease;
}

.deck-pop-enter-from {
  transform: translateY(-14px) scale(0.97);
  opacity: 0;
}

.deck-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--panel-border);
  flex-shrink: 0;
  color: white;
}

.prompt-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 9px 12px;
}

.prompt-caret {
  color: var(--borber-color_main);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
}

.prompt-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: white;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
}

.prompt-input::placeholder {
  color: var(--text-muted);
}

/* ===== Тело: рейка + сетка ===== */
.deck-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.rail {
  position: relative;
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--panel-border);
  overflow-y: auto;
  padding: 6px;
}

.rail-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px 9px 14px;
  border-radius: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  color: white;
}

.rail-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: wheat;
}

.rail-item.active {
  background: rgba(255, 255, 255, 0.07);
  color: white;
}

.rail-dot {
  --dot-color: #5b8def;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #0a0d12;
  background: var(--dot-color);
  flex-shrink: 0;
}

.rail-label {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: white;
}

.rail-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 1px 6px;
  color: white;
}

.deck-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 18px 18px;
  overflow-y: auto;
}

.breadcrumb {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  color: white;
}

.bc-root, .bc-item:active {
  cursor: pointer;
  transition: color 0.15s;
  color: white;
}

.bc-sep {
  color: white;
}

.bc-root:hover, .bc-item:hover {
  color: var(--borber-color_main);
}

.bc-item:last-child {
  color: white;
}

.bc-sep {
  opacity: 0.4;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.item-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, border-color 0.2s, background 0.2s, box-shadow 0.2s;
  color: #d0d0d0;
}

.item-card:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(91, 141, 239, 0.45);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
}

.item-card.folder:hover {
  border-color: rgba(139, 92, 246, 0.5);
}

.card-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  background: rgba(255, 255, 255, 0.05);
}

.card-icon img {
  width: 20px;
  height: 20px;
}

.vue-badge {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #3d3d3d;
  background: linear-gradient(135deg, #42b883, #35495e);
}

.card-title {
  font-size: 13.5px;
  font-weight: 600;
  color: white;
  line-height: 1.3;
}

.card-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.restart-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  font-size: 13px;
  transition: color 0.2s, transform 0.2s, background 0.2s;
}

.restart-btn:hover {
  color: #6ea2ff;
  background: rgba(110, 162, 255, 0.15);
  transform: rotate(180deg);
}

/* ===== Поиск ===== */
.search-mode {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.search-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.search-row:hover {
  background: rgba(255, 255, 255, 0.06);
}

.search-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  font-size: 15px;
  flex-shrink: 0;
}

.search-icon img {
  width: 18px;
  height: 18px;
}

.search-texts {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-title {
  font-size: 13.5px;
  color: white;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-path {
  font-size: 11px;
  color: #b4b4b4;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-go {
  color: #b4b4b4;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
}

.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  font-size: 13px;
  text-align: center;
  color: white;
}

.empty-emoji {
  font-size: 34px;
  opacity: 0.7;
}

/* ===== Замок ===== */
.lock-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(4px);
  z-index: 6000;
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

/* ===== Доступность ===== */
.launcher-btn:focus-visible,
.dock-blip:focus-visible,
.rail-item:focus-visible,
.item-card:focus-visible,
.search-row:focus-visible {
  outline: 2px solid var(--borber-color_main);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .orb-ring {
    animation: none;
  }

  .orb-core.lg {
    animation: none;
  }

  .item-card:hover {
    transform: none;
  }
}

/* ===== Адаптив ===== */
@media (max-width: 720px) {
  .deck-overlay {
    padding: 4vh 10px 10px;
  }

  .deck-panel {
    max-height: 88vh;
  }

  .deck-body {
    flex-direction: column;
  }

  .rail {
    width: 100%;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--panel-border);
    padding: 8px;
  }

  .rail-item {
    flex-shrink: 0;
    width: auto;
  }

  .rail-label {
    max-width: 100px;
  }

  .launcher-kbd {
    display: none;
  }
}
</style>