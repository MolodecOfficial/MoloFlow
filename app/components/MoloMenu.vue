<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEnterprise } from '~~/app/composables/useEnterprise'
import lock from '~~/public/lock.svg'
import tsIcon from '~~/public/ts.png'
import jsIcon from '~~/public/js.png'
import { useAppStore } from '~~/stores/appStore'
import { useMenuStore } from '~~/stores/menuStore'
import { useModulesStore } from '~~/stores/modulesStore'
import { useWindowManager } from '~~/app/composables/window/useWindowManager'
import { useModulePrefetch } from '~/composables/compiler/useModulePrefetch'

const props = defineProps<{ role?: string }>()
const emit = defineEmits<{
  'lock-hover': [value: boolean]
}>()

const menuStore = useMenuStore()
const modulesStore = useModulesStore()
const appStore = useAppStore()

const { openWindow } = useWindowManager()
const { addLog } = useLogger('Меню')

// Извлекаем актуальные реактивные поля из правильных сторов
const { menuGroups, menuLoaded } = storeToRefs(menuStore)
const { enterpriseModules } = storeToRefs(modulesStore)
const { prefetchOne } = useModulePrefetch()

const enterprise = useEnterprise()

const loading = ref(false)
const executingModules = ref<Set<string>>(new Set())
const isLoaded = ref(false)
const showLock = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)

const isOpen = ref(false)
const activeGroupId = ref<string | null>(null)
const breadcrumbStack = ref<any[]>([])
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const createDynamicItems = () => {
  return (enterpriseModules.value || [])
      .filter((m: any) => m && (m._id || m.fileName))
      .map((m: any) => ({
        id: m.fileName || `module_${m._id}`,
        placeName: m.fileName || `module_${m._id}`,
        title: m.name || m.title || 'Без названия',
        format: m.format || 'vue',
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

// Защита от undefined при деструктуризации и объединении
const allGroups = computed(() => {
  const groups = Array.isArray(menuGroups.value) ? [...menuGroups.value] : []
  const dynamicItems = createDynamicItems()

  if (dynamicItems.length > 0) {
    groups.push({
      id: 'custom_dynamic_modules',
      title: 'Мои модули',
      items: dynamicItems
    })
  }

  return groups.map((g: any, idx: number) => ({
    ...g,
    id: g.id || g.groupId || g._id || `group_${idx}`,
    items: g.items || []
  }))
})

const orbClasses = computed(() => ({
  lg: loading.value === true,
  empty: isLoaded.value === true && allGroups.value.length === 0
}))

const loadAll = async (force = false) => {
  loading.value = true
  const enterpriseId = appStore.getEnterpriseId()
  const role = appStore.currentMemberRole || props.role || 'Администратор'

  try {
    await Promise.all([
      menuStore.loadMenu(role, force),
      enterpriseId ? modulesStore.loadEnterpriseModules(enterpriseId, force) : Promise.resolve()
    ])
  } catch (e: any) {
    addLog('error', `Ошибка загрузки меню: ${e?.message || e}`)
  } finally {
    loading.value = false
    isLoaded.value = true
    if (allGroups.value.length > 0 && !activeGroupId.value) {
      activeGroupId.value = allGroups.value[0].id
    }
  }
}

watch(
    () => enterprise.isLoggedIn.value,
    async (isLoggedIn, wasLoggedIn) => {
      if (isLoggedIn !== wasLoggedIn) {
        menuStore.invalidate()
        await loadAll(true)
      }
    }
)

watch(
    () => enterprise.enterpriseId.value,
    async (newId, oldId) => {
      if (newId && newId !== oldId) {
        menuStore.invalidate()
        await loadAll(true)
      }
    }
)

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
    out.push({ item, group, parents: [...parents] })
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

const restartModule = async (moduleData: any) => {
  if (!moduleData) return
  const moduleId = moduleData._id

  if (executingModules.value.has(moduleId)) {
    addLog('warning', `Модуль "${moduleData.name}" уже выполняется`)
    return
  }

  try {
    executingModules.value.add(moduleId)
    addLog('info', `Перезапуск модуля: ${moduleData.name}`)

    const enterpriseId = appStore.getEnterpriseId()
    if (!enterpriseId) {
      addLog('error', 'Нет ID предприятия')
      return
    }

    const response = await $fetch<{ logs?: string[] }>(`/api/execute/${moduleData._id}`, {
      method: 'POST',
      body: {
        data: {
          moduleName: moduleData.name,
          enterpriseId: enterpriseId,
          moduleId: moduleId
        }
      }
    })

    if (response.logs && response.logs.length) {
      const { addLog: addModuleLog } = useLogger('Модуль')
      for (const log of response.logs) {
        let type: 'info' | 'warning' | 'error' | 'success' = 'info'
        if (log.includes('ERROR')) type = 'error'
        else if (log.includes('WARN')) type = 'warning'
        else if (log.includes('SUCCESS')) type = 'success'
        addModuleLog(type, log)
      }
    }

    addLog('success', `Модуль "${moduleData.name}" выполнен успешно`)
  } catch (error: any) {
    addLog('error', `Ошибка при выполнении модуля: ${error.message}`)
  } finally {
    executingModules.value.delete(moduleId)
  }
}

const openItem = (item: any, group: any, parent?: any) => {
  if (item.isScript) {
    restartModule(item.moduleData)
    closePanel()
    return
  }

  if (item.isModule) {
    openWindow(item.placeName, item.moduleData)
  } else {
    openWindow(item.id || item.placeName, item.data)
  }

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

const openPanel = () => {
  isOpen.value = true
  if (!activeGroupId.value || !allGroups.value.some(g => g.id === activeGroupId.value)) {
    activeGroupId.value = allGroups.value[0]?.id || null
  }
  breadcrumbStack.value = []
  searchQuery.value = ''
  nextTick(() => searchInputRef.value?.focus())
}

const closePanel = () => {
  isOpen.value = false
  searchQuery.value = ''
}

const togglePanel = () => (isOpen.value ? closePanel() : openPanel())

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

const handleGlobalKeydown = (e: KeyboardEvent) => {
  const isToggleCombo = (e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyQ'

  if (isToggleCombo) {
    if (e.repeat) return
    e.preventDefault()
    e.stopPropagation()
    togglePanel()
  } else if (e.key === 'Escape' && isOpen.value) {
    closePanel()
  }
}

onMounted(async () => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('keydown', handleGlobalKeydown, { capture: true })
  await loadAll(false)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('keydown', handleGlobalKeydown, { capture: true })
})
</script>

<template>
  <div class="deck-wrapper">
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
        <UIMoloLoaders wnd-loader />
      </div>
    </div>

    <Teleport to="body">
      <transition name="deck-fade">
        <div v-if="isOpen" class="deck-overlay" @click.self="closePanel">
          <transition name="deck-pop" appear>
            <div class="deck-panel">
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
                <UIMoloButton class="small close" title="Закрыть (Esc)" @click="closePanel">✕</UIMoloButton>
              </div>

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
                      <img v-else-if="result.item.format === 'ts'" :src="tsIcon" alt="" />
                      <img v-else-if="result.item.format === 'js'" :src="jsIcon" alt="" />
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
                    <UIMoloButton
                        v-for="item in currentItems"
                        :key="item.id"
                        class="item-card"
                        :class="{
                        folder: item.items?.length,
                        script: item.isScript,
                        executing: item.isScript && executingModules.has(item.moduleId)
                      }"
                        @click="handleCardClick(item)"
                        @mouseenter="item.isModule && item.moduleId && prefetchOne(item.moduleId, appStore.getEnterpriseId() || '')"
                    >
                      <span class="card-icon">
                        <template v-if="item.items?.length">📁</template>
                        <img v-else-if="item.format === 'ts'" :src="tsIcon" alt="" />
                        <img v-else-if="item.format === 'js'" :src="jsIcon" alt="" />
                        <span v-else class="vue-badge">V</span>
                      </span>
                      <span class="card-title">{{ item.title }}</span>
                      <span v-if="item.items?.length" class="card-meta">{{ item.items.length }} пунктов</span>
                      <span v-else-if="item.isScript" class="card-meta">
                        <span v-if="executingModules.has(item.moduleId)" class="executing-indicator">
                          ⏳ выполняется...
                        </span>
                        <span v-else>скрипт · {{ item.format }}</span>
                      </span>
                      <span v-else class="card-meta">открыть окно</span>

                      <span
                          v-if="item.isScript"
                          class="restart-btn"
                          :class="{ spinning: executingModules.has(item.moduleId) }"
                          title="Перезапустить"
                          @click.stop="restartModule(item.moduleData)"
                      >
                        ↻
                      </span>
                    </UIMoloButton>
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

    <div v-if="showLock" class="lock-overlay">
      <img :src="lock" class="lock-icon" />
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
  0% { transform: scale(0.3); opacity: 0.9; }
  100% { transform: scale(2.4); opacity: 0; }
}

@keyframes glow-pulse {
  0% { box-shadow: 0 0 12px 2px rgba(255, 215, 0, 0.6); }
  100% { box-shadow: 0 0 24px 6px rgba(255, 215, 0, 0.9); }
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
  opacity: 0.4;
}

.bc-root:hover, .bc-item:hover {
  color: var(--borber-color_main);
}

.bc-item:last-child {
  color: white;
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

.item-card.executing {
  border-color: var(--borber-color_main);
  box-shadow: 0 0 15px rgba(91, 141, 239, 0.3);
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% { border-color: var(--borber-color_main); }
  50% { border-color: rgba(91, 141, 239, 0.3); }
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

.executing-indicator {
  color: var(--borber-color_main);
  animation: pulse-text 1s ease-in-out infinite;
}

@keyframes pulse-text {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
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

.restart-btn.spinning {
  animation: spin 1s linear infinite;
  color: var(--borber-color_main);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

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

.launcher-btn:focus-visible,
.rail-item:focus-visible,
.item-card:focus-visible,
.search-row:focus-visible {
  outline: 2px solid var(--borber-color_main);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .items-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}

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
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    border-right: none;
    border-bottom: 1px solid var(--panel-border);
    padding: 8px;
  }
  .rail-item {
    flex-shrink: 0;
    width: auto;
    min-height: 44px;
  }
  .rail-label {
    max-width: 100px;
  }
  .launcher-kbd {
    display: none;
  }
}

@media (max-width: 600px) {
  .deck-overlay {
    padding: 0;
    align-items: stretch;
  }
  .deck-panel {
    max-height: 100vh;
    height: 100vh;
    height: 100dvh;
    width: 100vw;
    border-radius: 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .deck-header {
    padding-top: max(12px, env(safe-area-inset-top));
  }
  .prompt-input {
    font-size: 16px;
  }
  .items-grid {
    grid-template-columns: repeat(auto-fill, minmax(122px, 1fr));
    gap: 8px;
  }
  .item-card {
    padding: 10px;
    min-height: 44px;
  }
  .card-title {
    font-size: 12.5px;
  }
  .launcher-text {
    display: none;
  }
  .launcher-btn {
    padding: 8px 10px;
    min-height: 44px;
  }
  .search-row {
    min-height: 44px;
  }
  .breadcrumb {
    flex-wrap: wrap;
  }
}

@media (max-width: 400px) {
  .items-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .rail-label {
    max-width: 72px;
  }
}

@media (hover: none) and (pointer: coarse) {
  .item-card,
  .search-row,
  .rail-item,
  .launcher-btn,
  .restart-btn {
    min-height: 40px;
  }
}
</style>