<script setup>
import { ref, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import isOfficial from '~~/public/isOfficial.svg'


const { openWindow } = useWindowManager()
const { addNotification } = useNotifications()

const modules = ref([])
const loading = ref(false)
const loadingImportMap = ref(new Map())
const searchQuery = ref('')
const formatFilter = ref('')
const sortBy = ref('downloads')
const page = ref(1)
const totalPages = ref(1)
const limit = 12

const formats = [
  {label: 'Javascript', value: 'js'},
  {label: 'TypeScript', value: 'ts'},
  {label: 'Vue', value: 'vue'}
]

const sorts = [
  {label: 'Количество загрузок', value: 'downloads'},
  {label: 'Рейтинг', value: 'rating'},
  {label: 'Новинки', value: 'createdAt'}
]

const currentEnterprise = ref(null)

const fetchModules = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      search: searchQuery.value,
      format: formatFilter.value,
      sortBy: sortBy.value,
      page: page.value,
      limit: limit.toString()
    })
    const data = await $fetch(`/api/browser/modules?${params.toString()}`)
    modules.value = data.modules
    totalPages.value = data.pagination.pages
  } catch (err) {
    console.error(err)
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки модулей')
  } finally {
    loading.value = false
  }
}

const debouncedFetch = useDebounceFn(fetchModules, 300)

const changePage = (newPage) => {
  page.value = newPage
  fetchModules()
}

// Импорт модуля в своё предприятие
const importModule = async (mod) => {
  // Устанавливаем загрузку для конкретного модуля
  loadingImportMap.value.set(mod._id, true)

  if (!currentEnterprise.value?._id) {
    addNotification('WARNING_DEFAULT', 'Не удалось определить текущее предприятие')
    loadingImportMap.value.set(mod._id, false)
    return
  }

  try {
    await $fetch(`/api/browser/modules/${mod._id}/import`, {
      method: 'POST',
      body: { targetEnterpriseId: currentEnterprise.value._id }
    })
    addNotification('NOTICE_DEFAULT', `Модуль "${mod.name}" импортирован в ваше предприятие`)

    window.dispatchEvent(new Event('module-imported'))

    } catch (err) {
    addNotification('ERROR_DEFAULT', err?.data?.message || 'Ошибка импорта')
  } finally {
    loadingImportMap.value.set(mod._id, false)
  }
}

const isLoadingModule = (moduleId) => {
  return loadingImportMap.value.get(moduleId) || false
}

onMounted(() => {
  // Получаем текущее предприятие из localStorage или из хранилища
  const entData = localStorage.getItem('currentEnterprise')
  if (entData) {
    try {
      currentEnterprise.value = JSON.parse(entData)
    } catch(e) {}
  }
  fetchModules()
})
</script>

<template>
  <div class="browser-container">
    <!-- Левая панель с фильтрами -->
    <aside class="filters-panel">
      <MoloInput
          v-model="searchQuery"
          type="text"
          tLabel="Найдите модуль в поиске"
          placeholder="Поиск по названию, описанию, тегам..."
          @input="debouncedFetch"
      />
      <MoloSelect
          v-model="formatFilter"
          @change="fetchModules"
          :parent="formats"
          tLabel="Выберите формат"
          disabled="Формат файла"
          children="label"
          valueKey="value"
          all="Все форматы"
      />
      <MoloSelect
          v-model="sortBy"
          @change="fetchModules"
          :parent="sorts"
          tLabel="Выберите фильтр"
          disabled="Выбранный фильтр"
          children="label"
          valueKey="value"
      />
    </aside>

    <!-- Правая часть с модулями -->
    <div class="modules-content">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>

      <div v-else-if="modules.length === 0" class="empty">
        Модулей не найдено
      </div>

      <div v-else class="modules-grid">
        <div v-for="mod in modules" :key="mod._id" class="module-card">
          <div class="card-logo">
            <img
                :src="mod.previewImage || '/default-module.png'"
                :alt="mod.name"
                class="logo"
            />
          </div>

          <section class="card-info">
            <div class="card-header">
              <h3>{{ mod.name }}</h3>
              <section class="card-points">
                <img
                    v-if="mod.isOfficial"
                    :src="isOfficial"
                    class="official-badge"
                    alt="Прошёл проверку"
                />
                <span class="badge">{{ mod.format.toUpperCase() }}</span>
              </section>
            </div>

            <p class="description">{{ mod.description || 'Нет описания' }}</p>

            <div class="stats">
              <span>⬇️ {{ mod.stats?.downloads || 0 }}</span>
              <span>⭐ {{ mod.stats?.ratings?.average || 0 }} ({{ mod.stats?.ratings?.count || 0 }})</span>
            </div>

            <div class="tags">
              <span v-for="tag in mod.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>

            <button
                class="action-btn confirm"
                @click="importModule(mod)"
                :disabled="isLoadingModule(mod._id)"
            >
              <div v-if="isLoadingModule(mod._id)" class="modern-loader"></div>
              <span v-else>Импортировать в своё предприятие</span>
            </button>
          </section>
        </div>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="page === 1" @click="changePage(page - 1)">←</button>
        <span>Страница {{ page }} из {{ totalPages }}</span>
        <button :disabled="page === totalPages" @click="changePage(page + 1)">→</button>
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
  min-height: 100%;
}

/* Левая панель фильтров - фиксированная ширина */
.filters-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 20px;
  align-self: flex-start;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

/* Правая область с модулями - занимает всё оставшееся место */
.modules-content {
  flex: 1;
  min-width: 0; /* Важно для правильной работы grid */
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Сетка модулей - горизонтальные карточки в несколько колонн */
.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

/* Карточка модуля */
.module-card {
  display: flex;
  flex-direction: row;
  background: #1e1e1e;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #2c2c2c;
  transition: all 0.2s ease;
  gap: 16px;
  min-width: 0; /* Для предотвращения переполнения */
}

.module-card:hover {
  border-color: var(--border-color_hover);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Логотип модуля */
.card-logo {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2c2c2c;
  border-radius: 12px;
  overflow: hidden;
}

.logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Информация о модуле */
.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.card-points {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.badge {
  background: #2c2c2c;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: bold;
  flex-shrink: 0;
}

.official-badge {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
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
}

.stats {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: #888;
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

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  font-size: 0.85rem;
}

.action-btn.confirm:hover:not(:disabled) {
  background: var(--border-color_disabled);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Пагинация */
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

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: #888;
  font-size: 1.1rem;
}

/* Адаптив для планшетов */
@media (max-width: 1024px) {
  .modules-grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}

/* Адаптив для мобильных устройств */
@media (max-width: 768px) {
  .browser-container {
    flex-direction: column;
    padding: 16px;
  }

  .filters-panel {
    width: 100%;
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
  }

  .filters-panel > * {
    flex: 1;
    min-width: 200px;
  }

  .modules-grid {
    grid-template-columns: 1fr;
  }

  .module-card {
    flex-direction: column;
  }

  .card-logo {
    width: 100%;
    height: 120px;
  }

  .logo {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .card-header h3 {
    white-space: normal;
    word-break: break-word;
  }
}

/* Адаптив для очень маленьких экранов */
@media (max-width: 480px) {
  .filters-panel {
    flex-direction: column;
  }

  .filters-panel > * {
    min-width: auto;
  }

  .modules-grid {
    gap: 16px;
  }

  .module-card {
    padding: 12px;
  }
}
</style>