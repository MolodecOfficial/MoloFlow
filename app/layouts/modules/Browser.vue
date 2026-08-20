<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useModulesStore } from '~~/stores/moduleStore'
import isOfficial from '~~/public/isOfficial.svg'
import jsIcon from "~~/public/js.png"
import tsIcon from "~~/public/ts.png"
import vueIcon from "~~/public/vue.png"

const { openWindow } = useWindowManager()
const { addNotification } = useNotifications('Браузер')
const { addLog } = useLogger('Браузер')

const moduleStore = useModulesStore()
const {
  browserModules: modules,
  browserLoading: loading,
  browserTotalPages: totalPages,
  browserCurrentPage: currentPage,
  browserSearchQuery: searchQuery,
  browserFormatFilter: formatFilter,
  browserSortBy: sortBy,
  hasEditorAccess
} = storeToRefs(moduleStore)

const {
  setBrowserSearchQuery,
  setBrowserFormatFilter,
  setBrowserSortBy,
  setBrowserPage,
  importBrowserModule,
  isImportingModule,
  checkEditorAccess,
  enableEditor,
  disableEditor
} = moduleStore

const activeTooltip = ref(null)
const currentEnterprise = ref(null)

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
  if (!currentEnterprise.value?._id) {
    addNotification('warning', 'Не удалось определить текущее предприятие')
    return
  }
  addLog('info', `Импорт модуля "${mod.name}"`)
  try {
    await importBrowserModule(mod._id, currentEnterprise.value._id)
    addNotification('success', `Модуль "${mod.name}" импортирован`)
    addLog('success', `Модуль "${mod.name}" импортирован`)
  } catch (err) {
    addNotification('error', 'Ошибка импорта')
    addLog('error', `Ошибка импорта: ${err?.data?.message || err.message}`)
  }
}

onMounted(() => {
  const entData = localStorage.getItem('currentEnterprise')
  if (entData) {
    try {
      currentEnterprise.value = JSON.parse(entData)
    } catch (e) {
      console.error('Error parsing enterprise data', e)
    }
  }
  checkEditorAccess()
  moduleStore.fetchBrowserModules()
})
</script>

<template>
  <div class="browser-container">
    <!-- Фильтры - фиксированная ширина -->
    <div class="filters-panel">
      <MoloSection>
        <template #header>
          Фильтры
        </template>
        <template #main>
          <MoloInput
              v-model="searchQuery"
              type="text"
              tLabel="Найдите модуль в поиске"
              placeholder="Поиск по названию, описанию, тегам..."
              @input="setBrowserSearchQuery"
          />
          <MoloSelect
              v-model="formatFilter"
              @change="setBrowserFormatFilter"
              :parent="formats"
              tLabel="Выберите формат"
              disabled="Формат файла"
              children="label"
              valueKey="value"
              all="Все форматы"
          />
          <MoloSelect
              v-model="sortBy"
              @change="setBrowserSortBy"
              :parent="sorts"
              tLabel="Выберите фильтр"
              disabled="Выбранный фильтр"
              children="label"
              valueKey="value"
          />
        </template>
      </MoloSection>
    </div>

    <!-- Основной контент -->
    <div class="modules-content">
      <MoloLoaders wndLoader v-if="loading" />

      <div v-else-if="modules.length === 0" class="empty">
        Модулей не найдено
      </div>

      <div v-else class="modules-grid">
        <MoloSection v-for="mod in modules" :key="mod._id" class="module-card">
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
                <MoloButton
                    v-if="mod.files?.length"
                    class="confirm small"
                    @click="showTooltip(mod._id)"
                >
                  Файлы
                </MoloButton>
                <Transition name="tooltip">
                  <div v-if="activeTooltip === mod._id" class="files-tooltip">
                    <div class="tooltip-content">
                      <div v-for="file in mod.files" :key="file.path" class="tooltip-file">
                        <img :src="vueIcon" class="file-icon" alt="" v-if="file.format == 'vue'">
                        <img :src="tsIcon" class="file-icon" alt="" v-else-if="file.format == 'ts'">
                        <img :src="jsIcon" class="file-icon" alt="" v-else>
                        <code>{{ file.name }}</code>
                      </div>
                    </div>
                  </div>
                </Transition>
                <MoloButton
                    class="confirm small"
                    @click="handleImport(mod)"
                    :disabled="isImportingModule(mod._id)"
                >
                  <MoloLoaders btnLoader v-if="isImportingModule(mod._id)" />
                  <span v-else>Импорт</span>

                </MoloButton>
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
                  <span>⭐ {{ mod.stats?.ratings?.average || 0 }} ({{ mod.stats?.ratings?.count || 0 }})</span>
                </div>
                <div class="tags">
                  <span v-for="tag in mod.tags" :key="tag" class="tag">{{ tag }}</span>
                </div>
              </div>
            </div>
            <code class="mod_version">Номер сборки: {{ mod.version }}</code>
          </template>
        </MoloSection>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <MoloButton :disabled="currentPage === 1" @click="setBrowserPage(currentPage - 1)">←</MoloButton>
        <span>Страница {{ currentPage }} из {{ totalPages }}</span>
        <MoloButton :disabled="currentPage === totalPages" @click="setBrowserPage(currentPage + 1)">→</MoloButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.browser-container {
  display: flex;
  gap: 24px;
  padding: 20px;
  color: #e0e0e0;
  font-family: sans-serif;
  min-height: 100vh;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
}

/* Фильтры - фиксированная ширина */
.filters-panel {
  flex: 0 0 300px;
  min-width: 250px;
  max-width: 350px;
}

.modules-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 20px;
}

/* ПРАВИЛЬНЫЙ ГРИД - без 2fr */
.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 10px;
  width: 100%;
}

/* Карточка модуля */
.module-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 12px;
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
  gap: 12px;
  flex-wrap: wrap;
}

.card-name {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.module-title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  width: 100%;
  position: relative;
}

.card-logo {
  flex-shrink: 0;
  width: 90px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.logo {
  width: 80%;
  height: 80%;
  object-fit: contain;
  background: transparent;
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.05);
}

.fallback-image {
  object-fit: cover;
}

.card-info-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.description {
  font-size: 0.85rem;
  color: #b0b0b0;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  word-break: break-word;
}

.stats {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: #888;
  flex-wrap: wrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  background: #2c2c2c;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  color: #ccc;
}

.official-badge {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.actions {
  display: flex;
  gap: 10px;
  position: relative;
  flex-shrink: 0;
}

.files-tooltip {
  position: absolute;
  right: 100%;
  top: 75%;
  z-index: 100;
  min-width: 200px;
}

.tooltip-content {
  background: #1e1e1e;
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tooltip-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  font-size: 0.8rem;
}

.file-icon {
  width: 20px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding: 16px 0;
}

.pagination button {
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination button:hover:not(:disabled) {
  background: #2c2c2c;
  border-color: #3a6ea5;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: #888;
  font-size: 1.1rem;
}

/* Анимация тултипа */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.2s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.mod_version {
  position: absolute;
  right: 6px;
  bottom: 6px;
  font-size: 10px;
}

/* Адаптивность */
@media (max-width: 1024px) {
  .modules-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 768px) {
  .browser-container {
    flex-direction: column;
    padding: 16px;
  }

  .filters-panel {
    flex: none;
    width: 100%;
    max-width: 100%;
    min-width: unset;
  }

  .modules-grid {
    grid-template-columns: 1fr;
  }

  .card-logo {
    width: 70px;
    height: 70px;
  }

  .card-body {
    flex-direction: row;
    align-items: flex-start;
  }

  .card-header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .card-name {
    width: 100%;
  }

  .module-title {
    white-space: normal;
    word-break: break-word;
  }

  .actions {
    justify-content: flex-end;
    width: 100%;
  }
}

@media (max-width: 480px) {
  .card-body {
    flex-direction: column;
    align-items: center;
  }

  .card-logo {
    width: 100%;
    height: 120px;
  }

  .card-info-main {
    width: 100%;
  }

  .actions {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>