<script setup>
import {ref, onMounted} from 'vue'
import {useDebounceFn} from '@vueuse/core'
import isOfficial from '~~/public/isOfficial.svg'
import jsIcon from "~~/public/js.png";
import tsIcon from "~~/public/ts.png";
import vueIcon from "~~/public/vue.png";

const {openWindow} = useWindowManager()
const {addNotification} = useNotifications('Браузер')
const {addLog} = useLogger('Браузер')

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
  addLog('info', 'Загружаю модули из базы')
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
    addLog('success', 'Модули из базы загружены')
  } catch (err) {
    addLog('error', `Ошибка загрузки модулей ${err}`)
    addNotification('error', 'Ошибка загрузки модулей')
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
  loadingImportMap.value.set(mod._id, true)
  addLog('info', 'Импортирую модуль в предприятие')
  if (!currentEnterprise.value?._id) {
    addNotification('warning', 'Не удалось определить текущее предприятие')
    loadingImportMap.value.set(mod._id, false)
    return
  }

  try {
    await $fetch(`/api/browser/modules/${mod._id}/import`, {
      method: 'POST',
      body: {targetEnterpriseId: currentEnterprise.value._id}
    })
    addNotification('info', `Модуль импортирован в ваше предприятие`)
    addLog('info', `Модуль "${mod.name}" импортирован в ваше предприятие`)
    window.dispatchEvent(new Event('module-imported'))
  } catch (err) {
    addNotification('error', 'Ошибка импорта')
    addLog('error', `Модуль не импортирован - ${err?.data?.message}`)
  } finally {
    loadingImportMap.value.set(mod._id, false)
  }
}

const isLoadingModule = (moduleId) => {
  return loadingImportMap.value.get(moduleId) || false
}

// Режим редактора с передачей инпутов
const editorMode = () => {
  openWindow(
      'settings',
      'confirm',
      null,
      {width: 450, height: 300, minWidth: 350, minHeight: 220},
      true,
      null,
      null,
      {
        type: 'module',
        onConfirm: async (accessCode) => {
          // Проверка кода доступа
          if (accessCode === 'admin123') {
            addNotification('info', 'Доступ к редактору разрешён')
          } else {
            addNotification('error', 'Неверный код доступа')
            throw new Error('Неверный код доступа')
          }
        },
        message: 'Введите код доступа к режиму редактора',
        inputPlaceholder: 'Введите код доступа',
        inputType: 'password'
      }
  )
}

onMounted(() => {
  const entData = localStorage.getItem('currentEnterprise')
  if (entData) {
    try {
      currentEnterprise.value = JSON.parse(entData)
    } catch (e) {
    }
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

    <button class="action-btn confirm editor" @click="editorMode">Режим редактора</button>

    <!-- Правая часть с модулями -->
    <div class="modules-content">
      <MoloLoaders wndLoader v-if="loading"/>

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
                <span class="badge">{{ mod.format }}</span>
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
            <details class="advanced-settings">
              <summary>Установленные модули</summary>
              <section class="files">
                <span v-for="file in mod.files" :key="file" class="file">
                  <img :src="vueIcon" class="file-icon" alt="" v-if="file.format == 'vue'">
                  <img :src="tsIcon" class="file-icon" alt="" v-else-if="file.format == 'ts'">
                  <img :src="jsIcon" class="file-icon" alt="" v-else>
                  <code>{{ file.name }}</code>
              </span>
              </section>

            </details>
            <button
                class="action-btn confirm"
                @click="importModule(mod)"
                :disabled="isLoadingModule(mod._id)"
            >
              <MoloLoaders btnLoader v-if="isLoadingModule(mod._id)"/>
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

.modules-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.module-card {
  display: flex;
  flex-direction: row;
  background: #1e1e1e;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #2c2c2c;
  transition: all 0.2s ease;
  gap: 16px;
  min-width: 0;
}

.module-card:hover {
  border-color: var(--border-color_hover);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.card-logo {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 12px;
  overflow: hidden;
}

.logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: transparent;
}

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

.files {
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
  padding: 10px 15px;
}

.file {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-icon {
  display: flex;
  flex-direction: row;
  width: 20px;
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

.action-btn.confirm.editor {
  position: absolute;
  top: 90%;
  transform: translateY(0%);
  width: 270px;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

/* Кастомный аккордеон для details */
details.advanced-settings {
  background: var(--half_opacity_bg);
  border-radius: 12px;
  padding: 0;
  margin-bottom: 12px;
  border: 1px solid var(--half_opacity_border);
  overflow: hidden;
  transition: all 0.2s ease;
  &:hover {
    border: 1px solid var(--borber-color_main);
  }
}

details.advanced-settings[open] {
  background: #2a2a2a;
  border-color: #3a6ea5;
}

/* Стилизация summary — убираем стандартный маркер, добавляем свой */
details.advanced-settings > summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  list-style: none; /* убираем треугольник в WebKit */
  user-select: none;
  transition: background 0.2s;
}

details.advanced-settings > summary::-webkit-details-marker {
  display: none; /* убираем треугольник в Chrome/Safari */
}

details.advanced-settings > summary::before {
  content: "▶";
  display: inline-block;
  font-size: 12px;
  color: #3a6ea5;
  transition: transform 0.25s ease;
  margin-right: 8px;
}

details.advanced-settings[open] > summary::before {
  transform: rotate(90deg);
}

/* Внутреннее содержимое — плавное появление */
details.advanced-settings > div,
details.advanced-settings > .details-content {
  padding: 0 18px 18px 18px;
  animation: fadeSlideDown 0.25s ease-out;
}

@keyframes fadeSlideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Альтернативный способ плавного разворота через grid (если хотите анимацию высоты) */
details.advanced-settings {
  transition: all 0.3s ease;
}

details.advanced-settings .dep-tabs,
details.advanced-settings .dep-list,
details.advanced-settings .add-dep-form,
details.advanced-settings .form-row {
  margin-top: 12px;
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

@media (max-width: 1024px) {
  .modules-grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}

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