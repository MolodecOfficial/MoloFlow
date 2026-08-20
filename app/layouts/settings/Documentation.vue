<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLogger } from '~/composables/useLogger'
import { useNotifications } from '~/composables/useNotifications'

// ============================================================
// 1. Состояния для демонстрации компонентов
// ============================================================

// ---- MoloInput ----
const inputMode = ref<'default' | 'address' | 'phone'>('default')
const inputValue = ref('')
const addressValue = ref('')
const phoneValue = ref('')

// ---- MoloSelect ----
const selectOptions = [
  { id: 1, name: 'Аня', age: 18 },
  { id: 2, name: 'Лера', age: 20 },
  { id: 3, name: 'Вика', age: 22 }
]
const selectedUser = ref<number | null>(null)

const categories = ref([
  {
    id: 1,
    category: '🍎 Фрукты',
    items: [
      { _id: 1, name: '🍏 Яблоко' },
      { _id: 2, name: '🍌 Банан' }
    ]
  },
  {
    id: 2,
    category: '🥬 Овощи',
    items: [
      { _id: 3, name: '🍅 Помидор' },
      { _id: 4, name: '🥒 Огурец' }
    ]
  }
])
const selectedCategory = ref<string>('')
const selectedItem = ref<string>('')
const selectedItemName = computed(() => {
  if (!selectedCategory.value || !selectedItem.value) return null
  const category = categories.value.find(c => c.id === Number(selectedCategory.value))
  const item = category?.items.find(i => i._id === Number(selectedItem.value))
  return item?.name || null
})

// ---- MoloModal ----
const showModal = ref(false)
const modalLoading = ref(false)
const modalResult = ref('')

// ---- MoloLogger ----
const { addLog, clearLogs, logs } = useLogger('Документация')
const logMessage = ref('')
const logType = ref<'info' | 'warning' | 'error' | 'success'>('info')

// ---- MoloNotice (уведомления) ----
const { addNotification, clearNotifications, notifications } = useNotifications('Документация')
const noticeType = ref<'info' | 'warning' | 'error'>('info')
const noticeText = ref('')
const noticeTitle = ref('')

// ---- MoloLoaders ----
const showLoader = ref(false)

// ============================================================
// 2. Методы для демонстрации
// ============================================================

// Modal
const handleModalConfirm = async () => {
  modalLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1500))
    modalResult.value = 'Действие успешно выполнено!'
    addLog('success', 'Модальное окно подтверждено')
    addNotification('success', 'Модальное окно подтверждено', 'Успех')
  } catch {
    modalResult.value = 'Произошла ошибка'
  } finally {
    modalLoading.value = false
    showModal.value = false
  }
}

// Logger
const addCustomLog = () => {
  if (logMessage.value.trim()) {
    addLog(logType.value, logMessage.value)
    logMessage.value = ''
  }
}

// Notices
const addCustomNotice = () => {
  if (noticeText.value.trim()) {
    addNotification(noticeType.value, noticeText.value, noticeTitle.value || undefined)
    noticeText.value = ''
    noticeTitle.value = ''
  }
}

// ============================================================
// 3. Навигация по секциям
// ============================================================
const sections = [
  { id: 'input', title: 'MoloInput', icon: '📝' },
  { id: 'select', title: 'MoloSelect', icon: '🔽' },
  { id: 'button', title: 'MoloButton', icon: '🔘' },
  { id: 'modal', title: 'MoloModal', icon: '📦' },
  { id: 'section', title: 'MoloSection', icon: '📐' },
  { id: 'logger', title: 'MoloLogger', icon: '📋' },
  { id: 'notice', title: 'MoloNotice', icon: '🔔' },
  { id: 'loaders', title: 'MoloLoaders', icon: '⏳' },
  { id: 'hooks', title: 'Хуки', icon: '🧩' },
]

const activeSection = ref('input')

const scrollToSection = (id: string) => {
  activeSection.value = id
  const el = document.getElementById(`section-${id}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="doc-container">
    <!-- ===== Боковая панель ===== -->
    <aside class="doc-sidebar">
      <div class="sidebar-header">
        <div class="logo-wrapper">
          <span class="logo-icon">📚</span>
          <span class="logo-text">Molo UI</span>
        </div>
        <span class="version-badge">v2.0</span>
      </div>

      <nav class="sidebar-nav">
        <div
            v-for="section in sections"
            :key="section.id"
            class="nav-item"
            :class="{ active: activeSection === section.id }"
            @click="scrollToSection(section.id)"
        >
          <span class="nav-icon">{{ section.icon }}</span>
          <span class="nav-title">{{ section.title }}</span>
        </div>
      </nav>

      <div class="sidebar-footer">
        <span>💡 Полная документация</span>
      </div>
    </aside>

    <!-- ===== Основной контент ===== -->
    <main class="doc-main">
      <!-- Заголовок -->
      <header class="doc-header">
        <div>
          <h1>Документация компонентов Molo</h1>
          <p class="subtitle">Полное руководство по использованию UI‑компонентов и хуков</p>
        </div>
        <div class="header-actions">
          <span class="status-badge">
            <span class="status-dot"></span> Актуально
          </span>
        </div>
      </header>

      <div class="doc-content">
        <!-- Вступление -->
        <section class="intro-section">
          <div class="intro-card">
            <div class="intro-icon">🚀</div>
            <div>
              <h2>Добро пожаловать</h2>
              <p>
                Набор компонентов и хуков для быстрого создания современных веб‑приложений.
                Включает поля ввода, селекты, модальные окна, систему логирования,
                уведомления и многое другое.
              </p>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: MoloInput                                             -->
        <!-- ============================================================ -->
        <section id="section-input" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">📝</span>
              <h2>MoloInput</h2>
              <span class="section-badge">Компонент ввода</span>
            </div>
          </div>

          <div class="section-body">
            <p class="description">
              Многофункциональное поле ввода с поддержкой трёх режимов:
              обычный, адрес (с автоподбором через DaData) и телефон (с маской).
            </p>

            <div class="props-card">
              <div class="card-header">
                <span class="card-icon">⚙️</span>
                <h3>Параметры (Props)</h3>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Параметр</th>
                    <th>Тип</th>
                    <th>Описание</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr>
                    <td><code>tLabel</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Надпись над полем</td>
                  </tr>
                  <tr>
                    <td><code>lRequired</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Показывает звёздочку (*) обязательного поля</td>
                  </tr>
                  <tr>
                    <td><code>modelValue</code></td>
                    <td><span class="type-tag any">Any</span></td>
                    <td>Значение (v‑model)</td>
                  </tr>
                  <tr>
                    <td><code>address</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Режим ввода адреса с автоподбором</td>
                  </tr>
                  <tr>
                    <td><code>phone</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Режим ввода телефона с маской</td>
                  </tr>
                  <tr>
                    <td><code>placeholder</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Подсказка внутри поля</td>
                  </tr>
                  <tr>
                    <td><code>readonly</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Режим только для чтения</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">🎮</span>
                <h3>Интерактивная демонстрация</h3>
              </div>
              <div class="demo-content">
                <div class="mode-selector">
                  <button
                      v-for="mode in [
                      { value: 'default', label: '✏️ Обычный' },
                      { value: 'address', label: '📍 Адрес' },
                      { value: 'phone', label: '📞 Телефон' }
                    ]"
                      :key="mode.value"
                      class="mode-btn"
                      :class="{ active: inputMode === mode.value }"
                      @click="inputMode = mode.value as any"
                  >
                    {{ mode.label }}
                  </button>
                </div>

                <div class="demo-inputs">
                  <MoloInput
                      v-if="inputMode === 'default'"
                      v-model="inputValue"
                      tLabel="Обычный ввод"
                      placeholder="Введите текст..."
                  />
                  <MoloInput
                      v-if="inputMode === 'address'"
                      v-model="addressValue"
                      tLabel="Ввод адреса"
                      placeholder="Начните вводить адрес..."
                      :address="true"
                  />
                  <MoloInput
                      v-if="inputMode === 'phone'"
                      v-model="phoneValue"
                      tLabel="Ввод телефона"
                      placeholder="+7 (___) ___-__-__"
                      :phone="true"
                  />
                </div>
                <div class="demo-value">
                  Значение: <code>{{ inputMode === 'default' ? inputValue : inputMode === 'address' ? addressValue : phoneValue }}</code>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: MoloSelect                                            -->
        <!-- ============================================================ -->
        <section id="section-select" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">🔽</span>
              <h2>MoloSelect</h2>
              <span class="section-badge">Компонент выбора</span>
            </div>
          </div>

          <div class="section-body">
            <p class="description">
              Универсальный выпадающий список с поддержкой плоских и вложенных данных.
            </p>

            <div class="props-card">
              <div class="card-header">
                <span class="card-icon">⚙️</span>
                <h3>Параметры (Props)</h3>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Параметр</th>
                    <th>Тип</th>
                    <th>Описание</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr>
                    <td><code>tLabel</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Надпись над полем</td>
                  </tr>
                  <tr>
                    <td><code>parent</code></td>
                    <td><span class="type-tag array">Array</span></td>
                    <td>Массив данных</td>
                  </tr>
                  <tr>
                    <td><code>children</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Ключ для отображения текста опций</td>
                  </tr>
                  <tr>
                    <td><code>valueKey</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Ключ для значения (по умолчанию <code>_id</code>)</td>
                  </tr>
                  <tr>
                    <td><code>all</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Опция «Все» в начале</td>
                  </tr>
                  <tr>
                    <td><code>disabled</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Текст заблокированной опции</td>
                  </tr>
                  <tr>
                    <td><code>clearable</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Показывает опцию «— Очистить —»</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">🎮</span>
                <h3>Интерактивная демонстрация</h3>
              </div>
              <div class="demo-content">
                <div class="demo-grid">
                  <div>
                    <h4>📋 Простой список</h4>
                    <MoloSelect
                        v-model="selectedUser"
                        :parent="selectOptions"
                        children="name"
                        tLabel="Выберите пользователя"
                        placeholder="Выберите..."
                    />
                    <div v-if="selectedUser" class="selected-info">
                      Выбрано: <strong>{{ selectOptions.find(u => u.id === selectedUser)?.name }}</strong>
                    </div>
                  </div>
                  <div>
                    <h4>📂 Вложенные списки</h4>
                    <MoloSelect
                        v-model="selectedCategory"
                        :parent="categories"
                        children="category"
                        valueKey="id"
                        tLabel="Категория"
                        placeholder="Выберите категорию"
                    />
                    <MoloSelect
                        v-if="selectedCategory"
                        v-model="selectedItem"
                        :parent="categories.find(c => c.id === Number(selectedCategory))?.items || []"
                        children="name"
                        valueKey="_id"
                        tLabel="Товар"
                        placeholder="Выберите товар"
                    />
                    <div v-if="selectedItemName" class="selected-info">
                      ✅ Вы выбрали: <strong>{{ selectedItemName }}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: MoloButton                                            -->
        <!-- ============================================================ -->
        <section id="section-button" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">🔘</span>
              <h2>MoloButton</h2>
              <span class="section-badge">Компонент кнопки</span>
            </div>
          </div>

          <div class="section-body">
            <p class="description">
              Стилизованная кнопка с поддержкой состояний загрузки, различных вариантов оформления.
            </p>

            <div class="props-card">
              <div class="card-header">
                <span class="card-icon">⚙️</span>
                <h3>Параметры (Props)</h3>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Параметр</th>
                    <th>Тип</th>
                    <th>Описание</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr>
                    <td><code>disabled</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Блокировка кнопки</td>
                  </tr>
                  <tr>
                    <td><code>loading</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Показывает спиннер загрузки</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">🎨</span>
                <h3>Варианты кнопок</h3>
              </div>
              <div class="demo-content">
                <div class="button-grid">
                  <MoloButton>Обычная</MoloButton>
                  <MoloButton variant="confirm">Подтвердить</MoloButton>
                  <MoloButton variant="close">Удалить</MoloButton>
                  <MoloButton variant="small">Маленькая</MoloButton>
                  <MoloButton variant="full">На всю ширину</MoloButton>
                  <MoloButton variant="transparent">Прозрачная</MoloButton>
                  <MoloButton variant="action">Действие</MoloButton>
                  <MoloButton :loading="true">Загрузка</MoloButton>
                  <MoloButton disabled>Отключена</MoloButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: MoloModal                                             -->
        <!-- ============================================================ -->
        <section id="section-modal" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">📦</span>
              <h2>MoloModal</h2>
              <span class="section-badge">Модальное окно</span>
            </div>
          </div>

          <div class="section-body">
            <p class="description">
              Модальное окно с поддержкой состояний загрузки, асинхронных действий, слотов и подсказок.
            </p>

            <div class="props-card">
              <div class="card-header">
                <span class="card-icon">⚙️</span>
                <h3>Параметры (Props)</h3>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Параметр</th>
                    <th>Тип</th>
                    <th>Описание</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr>
                    <td><code>modelValue</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Видимость (v‑model)</td>
                  </tr>
                  <tr>
                    <td><code>title</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Заголовок</td>
                  </tr>
                  <tr>
                    <td><code>width</code></td>
                    <td><span class="type-tag string\|number">String / Number</span></td>
                    <td>Ширина (по умолчанию 480px)</td>
                  </tr>
                  <tr>
                    <td><code>closeOnOverlay</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Закрытие по клику на фон</td>
                  </tr>
                  <tr>
                    <td><code>modalText</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Текст содержимого (если не используется слот)</td>
                  </tr>
                  <tr>
                    <td><code>helpText</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Подсказка под модалкой</td>
                  </tr>
                  <tr>
                    <td><code>loading</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Состояние загрузки</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">🎮</span>
                <h3>Интерактивная демонстрация</h3>
              </div>
              <div class="demo-content">
                <MoloButton variant="confirm" @click="showModal = true">
                  Открыть модальное окно
                </MoloButton>
                <div v-if="modalResult" class="modal-result">
                  {{ modalResult }}
                </div>

                <MoloModal
                    v-model="showModal"
                    title="Подтверждение действия"
                    modalText="Вы уверены, что хотите выполнить это действие?"
                    :loading="modalLoading"
                    :closeOnOverlay="true"
                    helpText="Это действие необратимо. Убедитесь, что вы всё правильно заполнили."
                    @confirm="handleModalConfirm"
                    @cancel="modalResult = 'Действие отменено'"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: MoloSection                                           -->
        <!-- ============================================================ -->
        <section id="section-section" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">📐</span>
              <h2>MoloSection</h2>
              <span class="section-badge">Контейнер секции</span>
            </div>
          </div>

          <div class="section-body">
            <p class="description">
              Компонент для группировки элементов формы с заголовком и основным содержимым.
            </p>

            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">🧩</span>
                <h3>Пример использования</h3>
              </div>
              <div class="demo-content">
                <MoloSection>
                  <template #header>
                    <span style="font-weight:600;">Личные данные</span>
                    <MoloButton variant="small">Редактировать</MoloButton>
                  </template>
                  <template #main>
                    <MoloInput tLabel="Имя" placeholder="Введите имя" />
                    <MoloInput tLabel="Email" placeholder="Введите email" />
                  </template>
                </MoloSection>
              </div>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: MoloLogger                                            -->
        <!-- ============================================================ -->
        <section id="section-logger" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">📋</span>
              <h2>MoloLogger</h2>
              <span class="section-badge">Компонент логирования</span>
            </div>
          </div>

          <div class="section-body">
            <p class="description">
              Визуальный компонент для отображения логов, получаемых из хука <code>useLogger</code>.
              Поддерживает фильтрацию по типу и поиск.
            </p>

            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">✏️</span>
                <h3>Добавление лога</h3>
              </div>
              <div class="demo-content">
                <div class="logger-controls">
                  <MoloInput v-model="logMessage" tLabel="Текст лога" placeholder="Введите сообщение..." />
                  <div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;">
                    <MoloSelect
                        v-model="logType"
                        :parent="['info', 'warning', 'error', 'success']"
                        tLabel="Тип"
                    />
                    <MoloButton variant="confirm" @click="addCustomLog">Добавить лог</MoloButton>
                    <MoloButton variant="close" @click="clearLogs">Очистить</MoloButton>
                  </div>
                </div>
                <div style="margin-top:16px; height:250px; overflow:hidden; border-radius:8px; border:1px solid var(--half_opacity_border);">
                  <MoloLogger />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: MoloNotice                                            -->
        <!-- ============================================================ -->
        <section id="section-notice" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">🔔</span>
              <h2>MoloNotice</h2>
              <span class="section-badge">Компонент уведомления</span>
            </div>
          </div>

          <div class="section-body">
            <p class="description">
              Отдельное уведомление, которое можно использовать совместно с хуком <code>useNotifications</code>.
              Поддерживает три типа: <code>info</code>, <code>warning</code>, <code>error</code>.
            </p>

            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">✏️</span>
                <h3>Создание уведомления</h3>
              </div>
              <div class="demo-content">
                <div class="notice-controls">
                  <MoloInput v-model="noticeTitle" tLabel="Заголовок (опционально)" placeholder="Введите заголовок" />
                  <MoloInput v-model="noticeText" tLabel="Текст уведомления" placeholder="Введите текст..." />
                  <div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;">
                    <MoloSelect
                        v-model="noticeType"
                        :parent="['info', 'warning', 'error']"
                        tLabel="Тип"
                    />
                    <MoloButton variant="confirm" @click="addCustomNotice">Показать</MoloButton>
                    <MoloButton variant="close" @click="clearNotifications">Очистить все</MoloButton>
                  </div>
                </div>
                <div style="margin-top:16px; position:relative; min-height:100px; border-radius:8px; border:1px dashed var(--half_opacity_border); padding:10px;">
                  <p v-if="notifications.length === 0" style="color: #8b949e; text-align:center;">Нет уведомлений</p>
                  <div v-for="n in notifications" :key="n.id" style="margin-bottom:8px;">
                    <MoloNotice
                        :notice_type="n.type"
                        :notice_title="n.title"
                        :notice_text="n.text"
                        @close="() => { /* удаление через хук */ }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: MoloLoaders                                           -->
        <!-- ============================================================ -->
        <section id="section-loaders" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">⏳</span>
              <h2>MoloLoaders</h2>
              <span class="section-badge">Индикаторы загрузки</span>
            </div>
          </div>

          <div class="section-body">
            <p class="description">
              Компонент для отображения спиннеров загрузки: крупный (для окна) и маленький (для кнопок).
            </p>

            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">🎮</span>
                <h3>Демонстрация</h3>
              </div>
              <div class="demo-content">
                <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap;">
                  <MoloButton @click="showLoader = !showLoader">
                    {{ showLoader ? 'Скрыть' : 'Показать' }} загрузку
                  </MoloButton>
                  <div v-if="showLoader" style="padding:20px; background: rgba(0,0,0,0.3); border-radius:8px;">
                    <MoloLoaders :wndLoader="true" />
                  </div>
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span>Спиннер для кнопки:</span>
                    <MoloLoaders :btnLoader="true" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- Секция: Хуки                                                  -->
        <!-- ============================================================ -->
        <section id="section-hooks" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">🧩</span>
              <h2>Хуки</h2>
              <span class="section-badge">useLogger & useNotifications</span>
            </div>
          </div>

          <div class="section-body">
            <!-- useLogger -->
            <div class="sub-section">
              <h3>useLogger</h3>
              <p>
                Хук для логирования с глобальным хранилищем. Автоматически определяет источник (компонент).
              </p>
              <div class="props-card">
                <div class="card-header">
                  <span class="card-icon">📋</span>
                  <h4>Методы</h4>
                </div>
                <div class="table-wrapper">
                  <table>
                    <thead>
                    <tr>
                      <th>Метод</th>
                      <th>Параметры</th>
                      <th>Описание</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                      <td><code>addLog</code></td>
                      <td><span class="type-tag">type: LogType, text: string, dynamicParams?: Record</span></td>
                      <td>Добавляет лог. Поддерживает интерполяцию <code>${key}</code></td>
                    </tr>
                    <tr>
                      <td><code>clearLogs</code></td>
                      <td>-</td>
                      <td>Очищает все логи</td>
                    </tr>
                    <tr>
                      <td><code>removeLog</code></td>
                      <td><span class="type-tag">id: number</span></td>
                      <td>Удаляет лог по ID</td>
                    </tr>
                    <tr>
                      <td><code>getLogsByType</code></td>
                      <td><span class="type-tag">type: LogType</span></td>
                      <td>Возвращает логи указанного типа</td>
                    </tr>
                    <tr>
                      <td><code>getLogsBySource</code></td>
                      <td><span class="type-tag">source: string</span></td>
                      <td>Возвращает логи из источника</td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="example-card">
                <div class="card-header">
                  <span class="card-icon">💻</span>
                  <h4>Пример использования</h4>
                </div>
                <div class="code-example">
                  <pre><code><span class="comment">// Инициализация</span>
<span class="keyword">const</span> { addLog, clearLogs } = <span class="function">useLogger</span>(<span class="string">'МойМодуль'</span>)

<span class="comment">// Добавление лога с интерполяцией</span>
<span class="function">addLog</span>(<span class="string">'info'</span>, <span class="string">'Загружено ${count} записей'</span>, { count: <span class="number">42</span> })

<span class="comment">// Очистка</span>
<span class="function">clearLogs</span>()</code></pre>
                </div>
              </div>
            </div>

            <!-- useNotifications -->
            <div class="sub-section" style="margin-top:40px;">
              <h3>useNotifications</h3>
              <p>
                Хук для управления уведомлениями с глобальным хранилищем и защитой от дубликатов.
              </p>
              <div class="props-card">
                <div class="card-header">
                  <span class="card-icon">🔔</span>
                  <h4>Методы</h4>
                </div>
                <div class="table-wrapper">
                  <table>
                    <thead>
                    <tr>
                      <th>Метод</th>
                      <th>Параметры</th>
                      <th>Описание</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                      <td><code>addNotification</code></td>
                      <td><span class="type-tag">type: NoticeType, text: string, title?: string</span></td>
                      <td>Добавляет уведомление. Автоматически формирует заголовок.</td>
                    </tr>
                    <tr>
                      <td><code>removeNotification</code></td>
                      <td><span class="type-tag">id: number</span></td>
                      <td>Удаляет уведомление по ID</td>
                    </tr>
                    <tr>
                      <td><code>clearNotifications</code></td>
                      <td>-</td>
                      <td>Очищает все уведомления</td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="example-card">
                <div class="card-header">
                  <span class="card-icon">💻</span>
                  <h4>Пример использования</h4>
                </div>
                <div class="code-example">
                  <pre><code><span class="keyword">const</span> { addNotification } = <span class="function">useNotifications</span>(<span class="string">'МойМодуль'</span>)

<span class="function">addNotification</span>(<span class="string">'success'</span>, <span class="string">'Операция выполнена'</span>)
<span class="function">addNotification</span>(<span class="string">'error'</span>, <span class="string">'Ошибка соединения'</span>, <span class="string">'Сетевая ошибка'</span>)</code></pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="doc-footer">
          <p>© 2025 Molo UI — Документация v2.0</p>
        </footer>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ============================================================
   Глобальные стили документации
   ============================================================ */
.doc-container {
  display: flex;
  height: 100vh;
  background: #0d1117;
  color: #e6edf3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  overflow: hidden;
}

/* ---- Sidebar ---- */
.doc-sidebar {
  width: 260px;
  min-width: 260px;
  background: #161b22;
  border-right: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  overflow: hidden;
}
.sidebar-header {
  padding: 20px 24px;
  border-bottom: 1px solid #30363d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.logo-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-icon { font-size: 24px; }
.logo-text {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #58a6ff, #3fb950);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.version-badge {
  font-size: 11px;
  background: #21262d;
  color: #8b949e;
  padding: 2px 10px;
  border-radius: 12px;
  border: 1px solid #30363d;
}
.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}
.nav-item:hover { background: #1c2333; }
.nav-item.active {
  background: #1f2937;
  border-left: 3px solid #58a6ff;
}
.nav-icon { font-size: 20px; }
.nav-title { font-size: 14px; font-weight: 500; }
.sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid #30363d;
  text-align: center;
  font-size: 13px;
  color: #8b949e;
}

/* ---- Main ---- */
.doc-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.doc-header {
  padding: 24px 40px;
  border-bottom: 1px solid #30363d;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  background: #0d1117;
}
.doc-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, #f0f6fc, #8b949e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.subtitle {
  font-size: 15px;
  color: #8b949e;
  margin: 4px 0 0 0;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #3fb950;
  padding: 6px 14px;
  background: #0d2818;
  border-radius: 20px;
  border: 1px solid #238636;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3fb950;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.doc-content {
  flex: 1;
  padding: 24px 40px 60px;
  overflow-y: auto;
}

/* ---- Общие секции ---- */
.doc-section {
  margin-bottom: 48px;
  scroll-margin-top: 20px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #30363d;
}
.section-title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-icon { font-size: 28px; }
.section-title-wrapper h2 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}
.section-badge {
  font-size: 12px;
  background: #1f2937;
  color: #8b949e;
  padding: 2px 12px;
  border-radius: 12px;
  border: 1px solid #30363d;
}
.description {
  font-size: 15px;
  color: #8b949e;
  line-height: 1.6;
  margin-bottom: 24px;
}

/* ---- Intro ---- */
.intro-section { margin-bottom: 40px; }
.intro-card {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 24px 28px;
  background: linear-gradient(135deg, #161b22, #0d1117);
  border-radius: 12px;
  border: 1px solid #30363d;
}
.intro-icon { font-size: 40px; flex-shrink: 0; }
.intro-card h2 { font-size: 20px; margin: 0 0 8px 0; }
.intro-card p { color: #8b949e; margin: 0; line-height: 1.6; font-size: 15px; }

/* ---- Карточки ---- */
.props-card, .demo-card, .example-card {
  background: #161b22;
  border-radius: 12px;
  border: 1px solid #30363d;
  overflow: hidden;
  margin-bottom: 24px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #1c2333;
  border-bottom: 1px solid #30363d;
}
.card-icon { font-size: 18px; }
.card-header h3, .card-header h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.table-wrapper { overflow-x: auto; }
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
thead { background: #0d1117; }
th {
  text-align: left;
  padding: 10px 16px;
  font-weight: 600;
  color: #8b949e;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #30363d;
}
td {
  padding: 10px 16px;
  border-bottom: 1px solid #21262d;
  color: #e6edf3;
}
tr:last-child td { border-bottom: none; }
td code {
  background: #0d1117;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  color: #f0883e;
}
.type-tag {
  display: inline-block;
  padding: 1px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  font-family: 'JetBrains Mono', monospace;
}
.type-tag.string { background: #1f2937; color: #58a6ff; }
.type-tag.boolean { background: #1f2937; color: #f0883e; }
.type-tag.number { background: #1f2937; color: #3fb950; }
.type-tag.any { background: #1f2937; color: #d2a8ff; }
.type-tag.array { background: #1f2937; color: #ff7b72; }

/* ---- Демо-контенты ---- */
.demo-content { padding: 20px; }
.mode-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.mode-btn {
  padding: 6px 16px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}
.mode-btn:hover { background: #1c2333; color: #e6edf3; }
.mode-btn.active {
  background: #1f2937;
  border-color: #58a6ff;
  color: #58a6ff;
}
.demo-inputs { display: flex; flex-direction: column; gap: 16px; max-width: 500px; }
.demo-value {
  margin-top: 12px;
  font-size: 14px;
  color: #8b949e;
}
.demo-value code { background: #0d1117; padding: 2px 8px; border-radius: 4px; }
.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.demo-grid h4 {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 12px 0;
  color: #8b949e;
}
.selected-info {
  margin-top: 8px;
  padding: 8px 14px;
  background: #0d2818;
  border: 1px solid #238636;
  border-radius: 6px;
  color: #3fb950;
  font-size: 14px;
}
.button-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.modal-result {
  margin-top: 12px;
  padding: 10px 16px;
  background: #1f2937;
  border-radius: 6px;
  color: #58a6ff;
}
.hint {
  font-size: 13px;
  color: #8b949e;
  margin-top: 12px;
}
.logger-controls, .notice-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ---- Код-примеры ---- */
.code-example {
  padding: 20px;
  background: #0d1117;
}
.code-example pre {
  margin: 0;
  padding: 16px 20px;
  background: #161b22;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.8;
}
.code-example code { color: #e6edf3; }
.code-example .comment { color: #8b949e; }
.code-example .keyword { color: #ff7b72; }
.code-example .function { color: #d2a8ff; }
.code-example .string { color: #3fb950; }
.code-example .number { color: #f0883e; }

/* ---- Footer ---- */
.doc-footer {
  margin-top: 40px;
  padding: 16px 0;
  border-top: 1px solid #30363d;
  text-align: center;
  color: #8b949e;
  font-size: 13px;
}

/* ---- Адаптивность ---- */
@media (max-width: 1024px) {
  .demo-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .doc-sidebar { display: none; }
  .doc-header { padding: 16px 20px; flex-direction: column; align-items: flex-start; gap: 12px; }
  .doc-content { padding: 16px 20px 40px; }
  .doc-header h1 { font-size: 22px; }
  .section-title-wrapper h2 { font-size: 20px; }
}
</style>