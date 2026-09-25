<script setup>
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useModulesStore } from '~~/stores/modulesStore'
import { useAppStore } from '~~/stores/appStore'
import { useModulePrefetch } from '~/composables/compiler/useModulePrefetch'
import isOfficial from '~~/public/isOfficial.svg'
import jsIcon from '~~/public/js.png'
import tsIcon from '~~/public/ts.png'
import vueIcon from '~~/public/vue.png'

const { addNotification } = useNotifications('Браузер')
const { addLog } = useLogger('Браузер')

const appStore = useAppStore()
const modulesStore = useModulesStore()
const { prefetchOne } = useModulePrefetch()

const {
  browserModules: modules,
  browserLoading: loading,
  browserTotalPages: totalPages,
  browserCurrentPage: currentPage,
  browserSearchQuery: searchQuery,
  browserFormatFilter: formatFilter,
  browserSortBy: sortBy
} = storeToRefs(modulesStore)

const activeTooltip = ref(null)
const importingId = ref(null)

const handleImageError = (event) => {
  const img = event.target
  img.src = '/default-module.png'
  img.classList.add('fallback-image')
}

const formats = [
  { label: 'Javascript', value: 'js' },
  { label: 'TypeScript', value: 'ts' },
  { label: 'Vue', value: 'vue' }
]

const sorts = [
  { label: 'Количество загрузок', value: 'downloads' },
  { label: 'Рейтинг', value: 'rating' },
  { label: 'Новинки', value: 'createdAt' }
]

const showTooltip = (moduleId) => {
  activeTooltip.value = moduleId
  setTimeout(() => {
    if (activeTooltip.value === moduleId) activeTooltip.value = null
  }, 3000)
}

const handleImport = async (mod) => {
  const enterpriseId = appStore.getEnterpriseId()
  if (!enterpriseId) {
    addNotification('warning', 'Не удалось определить текущее предприятие')
    return
  }
  importingId.value = mod._id
  addLog('info', `Импорт модуля "${mod.name}"...`)
  try {
    await modulesStore.importBrowserModule(mod._id, enterpriseId)
    addNotification('success', `Модуль "${mod.name}" успешно импортирован`)
    addLog('success', `Модуль "${mod.name}" импортирован`)

    // Сразу прогреваем импортированный модуль в фоновом кэше предприятия
    void prefetchOne(mod._id, enterpriseId)
  } catch (err) {
    addNotification('error', 'Ошибка импорта')
    addLog('error', `Ошибка импорта: ${err?.data?.message || err?.message}`)
  } finally {
    importingId.value = null
  }
}

let searchTimer = null
const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    modulesStore.fetchBrowserModules()
  }, 300)
}

const changePage = (page) => {
  currentPage.value = page
  modulesStore.fetchBrowserModules()
}

watch([formatFilter, sortBy], () => {
  currentPage.value = 1
  modulesStore.fetchBrowserModules()
})

onMounted(() => {
  modulesStore.fetchBrowserModules()
})
</script>

<template>
  <div class="browser-container">
    <div class="filters-panel">
      <UIMoloSection>
        <template #header>
          Фильтры
        </template>
        <template #main>
          <UIMoloInput
              v-model="searchQuery"
              type="text"
              tLabel="Найдите модуль в поиске"
              placeholder="Поиск по названию, описанию, тегам..."
              @input="onSearchInput"
          />
          <UIMoloSelect
              v-model="formatFilter"
              :parent="formats"
              tLabel="Выберите формат"
              disabled="Формат файла"
              children="label"
              valueKey="value"
              all="Все форматы"
          />
          <UIMoloSelect
              v-model="sortBy"
              :parent="sorts"
              tLabel="Выберите фильтр"
              disabled="Выбранный фильтр"
              children="label"
              valueKey="value"
          />
        </template>
      </UIMoloSection>
    </div>

    <div class="modules-content">
      <UIMoloLoaders v-if="loading" wndLoader />

      <div v-else-if="modules.length === 0" class="empty">
        Модулей не найдено
      </div>

      <div v-else class="modules-grid">
        <UIMoloSection
            v-for="mod in modules"
            :key="mod._id"
            class="module-card"
        >
          <template #header>
            <div class="card-header-content">
              <div class="card-name">
                <span class="module-title">{{ mod.name }}</span>
                <img
                    v-if="mod.isOfficial"
                    :src="isOfficial"
                    class="official-badge"
                    alt="Прошёл проверку"
                />
              </div>
              <div class="actions">
                <UIMoloButton
                    v-if="mod.files?.length"
                    class="confirm small"
                    @click="showTooltip(mod._id)"
                >
                  Файлы
                </UIMoloButton>
                <Transition name="tooltip">
                  <div v-if="activeTooltip === mod._id" class="files-tooltip">
                    <div class="tooltip-content">
                      <div v-for="file in mod.files" :key="file.path" class="tooltip-file">
                        <img v-if="file.format == 'vue'" :src="vueIcon" class="file-icon" alt="" />
                        <img v-else-if="file.format == 'ts'" :src="tsIcon" alt="" />
                        <img v-else :src="jsIcon" class="file-icon" alt="" />
                        <code>{{ file.name }}</code>
                      </div>
                    </div>
                  </div>
                </Transition>
                <UIMoloButton
                    class="confirm small"
                    :disabled="importingId === mod._id"
                    @click="handleImport(mod)"
                >
                  <UIMoloLoaders v-if="importingId === mod._id" btnLoader />
                  <span v-else>Импорт</span>
                </UIMoloButton>
              </div>
            </div>
          </template>
          <template #main>
            <div class="card-body">
              <div class="card-logo">
                <img
                    :src="mod.previewImage || '/default-module.png'"
                    :alt="mod.name"
                    class="logo"
                    loading="lazy"
                    @error="handleImageError"
                />
              </div>
              <div class="card-info-main">
                <p class="description">{{ mod.description || 'Нет описания' }}</p>
                <div class="stats">
                  <span>⬇️ {{ mod.stats?.downloads || 0 }}</span>
                </div>
                <div class="tags">
                  <span v-for="tag in mod.tags" :key="tag" class="tag">{{ tag }}</span>
                </div>
              </div>
            </div>
            <code class="mod_version">Номер сборки: {{ mod.version || 1 }}</code>
          </template>
        </UIMoloSection>
      </div>

      <div v-if="totalPages > 1" class="pagination">
        <UIMoloButton :disabled="currentPage === 1" @click="changePage(currentPage - 1)">←</UIMoloButton>
        <span>Страница {{ currentPage }} из {{ totalPages }}</span>
        <UIMoloButton :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">→</UIMoloButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.browser-container {
  display: flex;
  gap: 20px;
  padding: 16px;
  color: #e0e0e0;
  min-height: 100%;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
}

.filters-panel {
  flex: 0 0 280px;
  min-width: 240px;
  max-width: 320px;
}

.modules-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 16px;
  overflow-y: auto;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 10px;
  width: 100%;
}

.module-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  transition: all 0.2s ease;
}

.module-card:hover {
  border-color: var(--borber-color_main);
  transform: translateY(-2px);
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 10px;
}

.card-name {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.module-title {
  font-size: 14.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-body {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  width: 100%;
  position: relative;
}

.card-logo {
  flex-shrink: 0;
  width: 74px;
  height: 74px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
}

.logo {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.card-info-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.description {
  font-size: 0.82rem;
  color: #a0a0b0;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.stats {
  display: flex;
  gap: 10px;
  font-size: 0.75rem;
  color: #888;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  color: #bbb;
}

.official-badge {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.actions {
  display: flex;
  gap: 6px;
  position: relative;
  flex-shrink: 0;
}

.files-tooltip {
  position: absolute;
  right: 100%;
  top: 50%;
  z-index: 100;
  min-width: 180px;
}

.tooltip-content {
  background: #1e1e1e;
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.tooltip-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  font-size: 0.8rem;
}

.file-icon {
  width: 16px;
  height: 16px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}

.empty {
  text-align: center;
  padding: 50px 20px;
  color: #888;
}

.mod_version {
  position: absolute;
  right: 6px;
  bottom: 4px;
  font-size: 9.5px;
  color: #666;
}
</style>