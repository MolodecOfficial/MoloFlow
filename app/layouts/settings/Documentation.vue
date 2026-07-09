<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const inputMode = ref<'default' | 'address' | 'phone'>('default')
const inputValue = ref('')
const addressValue = ref('')
const phoneValue = ref('')

const selectValue = ref<number | null>(null)
const selectOptions = [
  { id: 1, name: 'Аня', age: 18 },
  { id: 2, name: 'Лера', age: 20 },
  { id: 3, name: 'Вика', age: 22 }
]

const testParent = ref([
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
  const category = testParent.value.find(c => c.id === Number(selectedCategory.value))
  const item = category?.items.find(i => i._id === Number(selectedItem.value))
  return item?.name || null
})

// Секции с иконками и описаниями
const sections = [
  {
    id: 'input',
    title: 'MoloInput',
    icon: '📝',
    description: 'Поле ввода с дополнительными режимами'
  },
  {
    id: 'select',
    title: 'MoloSelect',
    icon: '🔽',
    description: 'Компонент выбора с вложенными списками'
  },
  {
    id: 'notifications',
    title: 'useNotifications',
    icon: '🔔',
    description: 'Система управления уведомлениями'
  }
]

const activeSection = ref<string>('input')

// Автоматический скролл к секции
const scrollToSection = (id: string) => {
  activeSection.value = id
  const element = document.getElementById(`section-${id}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

onMounted(() => {
  scrollToSection('input')
})
</script>

<template>
  <div class="doc-container">
    <!-- Боковая панель -->
    <aside class="doc-sidebar">
      <div class="sidebar-header">
        <div class="logo-wrapper">
          <span class="logo-icon">📚</span>
          <span class="logo-text">Документация</span>
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
          <div class="nav-content">
            <span class="nav-title">{{ section.title }}</span>
            <span class="nav-description">{{ section.description }}</span>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="footer-info">
          <span>💡 Используйте в своих модулях</span>
        </div>
      </div>
    </aside>

    <!-- Основной контент -->
    <main class="doc-main">
      <!-- Заголовок -->
      <header class="doc-header">
        <div class="header-content">
          <h1>Документация компонентов</h1>
          <p class="header-subtitle">Полное руководство по использованию UI-компонентов и хуков</p>
        </div>
        <div class="header-actions">
          <span class="status-badge">
            <span class="status-dot"></span>
            Актуально
          </span>
        </div>
      </header>

      <!-- Контент -->
      <div class="doc-content">
        <!-- Вступление -->
        <section class="intro-section">
          <div class="intro-card">
            <div class="intro-icon">🚀</div>
            <div>
              <h2>Добро пожаловать</h2>
              <p>
                Здесь собрана информация о работе с редактором кода и дополнительными элементами,
                которые помогут в разработке динамических модулей.
              </p>
            </div>
          </div>
        </section>

        <!-- Секция MoloInput -->
        <section :id="`section-${sections[0].id}`" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">📝</span>
              <h2>MoloInput</h2>
              <span class="section-badge">Компонент ввода</span>
            </div>
            <div class="section-actions">
              <span class="usage-badge">⭐ Основной</span>
            </div>
          </div>

          <div class="section-body">
            <!-- Описание -->
            <div class="description-box">
              <p>Мощный компонент ввода с поддержкой различных режимов: обычный ввод, адрес с автоподбором и телефон с форматированием.</p>
            </div>

            <!-- Props -->
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
                    <td>Надпись над полем ввода</td>
                  </tr>
                  <tr>
                    <td><code>lRequired</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Показывает звездочку (*) обязательного поля</td>
                  </tr>
                  <tr>
                    <td><code>modelValue</code></td>
                    <td><span class="type-tag any">Any</span></td>
                    <td>Аналог v-model</td>
                  </tr>
                  <tr>
                    <td><code>iRequired</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Обязательное заполнение поля</td>
                  </tr>
                  <tr>
                    <td><code>placeholder</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Подсказка в поле ввода</td>
                  </tr>
                  <tr>
                    <td><code>maxLength</code></td>
                    <td><span class="type-tag number">Number</span></td>
                    <td>Максимальная длина текста</td>
                  </tr>
                  <tr>
                    <td><code>readonly</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Режим только для чтения</td>
                  </tr>
                  <tr>
                    <td><code>address</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Режим ввода адреса с автоподбором</td>
                  </tr>
                  <tr>
                    <td><code>phone</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Режим ввода телефона с форматированием</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Демо -->
            <div class="demo-card">
              <div class="card-header">
                <span class="card-icon">🎮</span>
                <h3>Интерактивная демонстрация</h3>
              </div>
              <div class="demo-content">
                <div class="mode-selector">
                  <button
                      v-for="mode in [
                      { value: 'default', label: '✏️ Обычный', icon: '📝' },
                      { value: 'address', label: '📍 Адрес', icon: '🏠' },
                      { value: 'phone', label: '📞 Телефон', icon: '📱' }
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
                      tLabel="Пример обычного ввода"
                      placeholder="Введите текст..."
                      class="demo-input"
                  />
                  <MoloInput
                      v-if="inputMode === 'address'"
                      v-model="addressValue"
                      tLabel="Пример ввода адреса"
                      placeholder="Начните вводить адрес..."
                      :address="true"
                      class="demo-input"
                  />
                  <MoloInput
                      v-if="inputMode === 'phone'"
                      v-model="phoneValue"
                      tLabel="Пример ввода телефона"
                      placeholder="+7 (___) ___-__-__"
                      :phone="true"
                      class="demo-input"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Секция MoloSelect -->
        <section :id="`section-${sections[1].id}`" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">🔽</span>
              <h2>MoloSelect</h2>
              <span class="section-badge">Компонент выбора</span>
            </div>
            <div class="section-actions">
              <span class="usage-badge">⭐ Основной</span>
            </div>
          </div>

          <div class="section-body">
            <div class="description-box">
              <p>Универсальный компонент выбора с поддержкой плоских и вложенных списков, поиска и кастомизации.</p>
            </div>

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
                    <td>Надпись над полем выбора</td>
                  </tr>
                  <tr>
                    <td><code>parent</code></td>
                    <td><span class="type-tag array">Array</span></td>
                    <td>Массив данных для отображения</td>
                  </tr>
                  <tr>
                    <td><code>children</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Ключ для отображения текста опций</td>
                  </tr>
                  <tr>
                    <td><code>valueKey</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Ключ для значения опций</td>
                  </tr>
                  <tr>
                    <td><code>disabled</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Текст заблокированной опции</td>
                  </tr>
                  <tr>
                    <td><code>all</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Опция "Все" в начале списка</td>
                  </tr>
                  <tr>
                    <td><code>placeholder</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Placeholder для селекта</td>
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
                  <div class="demo-item">
                    <h4>📋 Простой список</h4>
                    <MoloSelect
                        tLabel="Выберите имя"
                        :parent="selectOptions"
                        children="name"
                        placeholder="Выберите имя"
                        class="demo-select"
                    />
                  </div>
                  <div class="demo-item">
                    <h4>📂 Вложенные списки</h4>
                    <div class="nested-selects">
                      <MoloSelect
                          v-model="selectedCategory"
                          :parent="testParent"
                          children="category"
                          valueKey="id"
                          tLabel="Категория"
                          placeholder="Выберите категорию"
                          class="demo-select"
                      />
                      <MoloSelect
                          v-if="selectedCategory"
                          v-model="selectedItem"
                          :parent="testParent.find(c => c.id === Number(selectedCategory))?.items || []"
                          children="name"
                          valueKey="_id"
                          tLabel="Пункт"
                          placeholder="Выберите пункт"
                          class="demo-select"
                      />
                      <div v-if="selectedItemName" class="selected-info">
                        ✅ Вы выбрали: <strong>{{ selectedItemName }}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Секция Notifications -->
        <section :id="`section-${sections[2].id}`" class="doc-section">
          <div class="section-header">
            <div class="section-title-wrapper">
              <span class="section-icon">🔔</span>
              <h2>useNotifications</h2>
              <span class="section-badge">Хук уведомлений</span>
            </div>
            <div class="section-actions">
              <span class="usage-badge success">🔥 Продвинутый</span>
            </div>
          </div>

          <div class="section-body">
            <div class="description-box">
              <p>Мощная система управления уведомлениями с поддержкой глобального хранилища, предотвращением дубликатов и условным показом.</p>
            </div>

            <div class="feature-grid">
              <div class="feature-card">
                <span class="feature-icon">💾</span>
                <h4>Глобальное хранилище</h4>
                <p>Единое состояние уведомлений для всех экземпляров хука</p>
              </div>
              <div class="feature-card">
                <span class="feature-icon">🛡️</span>
                <h4>Защита от дубликатов</h4>
                <p>Автоматическое предотвращение повторных уведомлений</p>
              </div>
              <div class="feature-card">
                <span class="feature-icon">💡</span>
                <h4>Одноразовые уведомления</h4>
                <p>Возможность показать уведомление только один раз</p>
              </div>
              <div class="feature-card">
                <span class="feature-icon">👤</span>
                <h4>Условный показ</h4>
                <p>Показ уведомлений на основе роли пользователя</p>
              </div>
            </div>

            <div class="props-card">
              <div class="card-header">
                <span class="card-icon">⚙️</span>
                <h3>Параметры уведомления</h3>
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
                    <td><code>type</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Тип: <span class="highlight">info</span>, <span class="highlight success">success</span>, <span class="highlight warning">warning</span>, <span class="highlight error">error</span></td>
                  </tr>
                  <tr>
                    <td><code>title</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Заголовок уведомления</td>
                  </tr>
                  <tr>
                    <td><code>text</code></td>
                    <td><span class="type-tag string">String</span></td>
                    <td>Текст уведомления</td>
                  </tr>
                  <tr>
                    <td><code>single</code></td>
                    <td><span class="type-tag boolean">Boolean</span></td>
                    <td>Показывается только один раз (сохраняется в localStorage)</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="props-card">
              <div class="card-header">
                <span class="card-icon">📋</span>
                <h3>Методы</h3>
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
                    <td><span class="type-tag">key: string, dynamicText?: string</span></td>
                    <td>Добавляет уведомление по ключу из конфига</td>
                  </tr>
                  <tr>
                    <td><code>removeNotification</code></td>
                    <td><span class="type-tag">id: number</span></td>
                    <td>Удаляет уведомление по ID</td>
                  </tr>
                  <tr>
                    <td><code>clearNotifications</code></td>
                    <td><span class="type-tag">-</span></td>
                    <td>Очищает все уведомления</td>
                  </tr>
                  <tr>
                    <td><code>checkAndShowNotifications</code></td>
                    <td><span class="type-tag">role: string, userId?: string</span></td>
                    <td>Проверяет роль и показывает соответствующие уведомления</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="example-card">
              <div class="card-header">
                <span class="card-icon">💻</span>
                <h3>Пример использования</h3>
              </div>
              <div class="code-example">
                <pre><code><span class="comment">// Инициализация хука</span>
<span class="keyword">const</span> { addNotification } = <span class="function">useNotifications</span>(<span class="string">'Мой модуль'</span>)

<span class="comment">// Добавление уведомления</span>
<span class="function">addNotification</span>(<span class="string">'success'</span>, <span class="string">'Модуль успешно создан'</span>)

<span class="comment">// С конфигом</span>
<span class="function">addNotification</span>(<span class="string">'NOTICE_DEFAULT'</span>, <span class="string">'Модуль обновлён'</span>)</code></pre>
              </div>
            </div>

            <div class="tips-card">
              <div class="card-header">
                <span class="card-icon">💡</span>
                <h3>Особенности работы</h3>
              </div>
              <ul class="tips-list">
                <li>
                  <span class="tip-icon">✅</span>
                  <div>
                    <strong>single: true</strong>
                    <p>Уведомление сохраняется в localStorage и больше никогда не покажется</p>
                  </div>
                </li>
                <li>
                  <span class="tip-icon">🛡️</span>
                  <div>
                    <strong>Предотвращение дубликатов</strong>
                    <p>Одинаковые уведомления (title + text) не добавляются повторно</p>
                  </div>
                </li>
                <li>
                  <span class="tip-icon">⏱️</span>
                  <div>
                    <strong>Защита от повторных вызовов</strong>
                    <p>checkAndShowNotifications имеет защиту от множественных вызовов</p>
                  </div>
                </li>
                <li>
                  <span class="tip-icon">🌐</span>
                  <div>
                    <strong>Глобальное хранилище</strong>
                    <p>Состояние уведомлений общее для всех экземпляров хука</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ===== Основные стили ===== */
.doc-container {
  display: flex;
  height: 100vh;
  background: #0d1117;
  color: #e6edf3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  overflow: hidden;
}

/* ===== Сайдбар ===== */
.doc-sidebar {
  width: 280px;
  min-width: 280px;
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

.logo-icon {
  font-size: 24px;
}

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
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 4px;
}

.nav-item:hover {
  background: #1c2333;
}

.nav-item.active {
  background: #1f2937;
  border-left: 3px solid #58a6ff;
}

.nav-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.nav-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.nav-title {
  font-size: 14px;
  font-weight: 500;
  color: #e6edf3;
}

.nav-description {
  font-size: 12px;
  color: #8b949e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid #30363d;
  flex-shrink: 0;
}

.footer-info {
  font-size: 13px;
  color: #8b949e;
  text-align: center;
}

/* ===== Основной контент ===== */
.doc-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* ===== Заголовок ===== */
.doc-header {
  padding: 24px 40px;
  border-bottom: 1px solid #30363d;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  background: #0d1117;
}

.header-content h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 4px 0;
  background: linear-gradient(135deg, #f0f6fc, #8b949e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-subtitle {
  font-size: 15px;
  color: #8b949e;
  margin: 0;
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

/* ===== Контент ===== */
.doc-content {
  flex: 1;
  padding: 24px 40px 60px;
  overflow-y: auto;
}

/* ===== Секции ===== */
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

.section-icon {
  font-size: 28px;
}

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

.usage-badge {
  font-size: 12px;
  padding: 4px 14px;
  border-radius: 12px;
  background: #1f2937;
  color: #58a6ff;
  border: 1px solid #1f2937;
}

.usage-badge.success {
  color: #3fb950;
}

/* ===== Вступление ===== */
.intro-section {
  margin-bottom: 40px;
}

.intro-card {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 24px 28px;
  background: linear-gradient(135deg, #161b22, #0d1117);
  border-radius: 12px;
  border: 1px solid #30363d;
}

.intro-icon {
  font-size: 40px;
  flex-shrink: 0;
}

.intro-card h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.intro-card p {
  color: #8b949e;
  margin: 0;
  line-height: 1.6;
  font-size: 15px;
}

/* ===== Карточки ===== */
.props-card,
.demo-card,
.example-card,
.tips-card {
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
  padding: 16px 20px;
  background: #1c2333;
  border-bottom: 1px solid #30363d;
}

.card-icon {
  font-size: 18px;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

/* ===== Таблицы ===== */
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

thead {
  background: #0d1117;
}

th {
  text-align: left;
  padding: 12px 20px;
  font-weight: 600;
  color: #8b949e;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #30363d;
}

td {
  padding: 12px 20px;
  border-bottom: 1px solid #21262d;
  color: #e6edf3;
}

tr:last-child td {
  border-bottom: none;
}

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

.highlight {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}
.highlight.success { color: #3fb950; }
.highlight.warning { color: #d29922; }
.highlight.error { color: #f85149; }

/* ===== Description Box ===== */
.description-box {
  padding: 16px 20px;
  background: #0d1117;
  border-radius: 8px;
  border: 1px solid #21262d;
  margin-bottom: 24px;
}

.description-box p {
  margin: 0;
  color: #8b949e;
  font-size: 15px;
  line-height: 1.6;
}

/* ===== Feature Grid ===== */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.feature-card {
  padding: 16px 20px;
  background: #0d1117;
  border-radius: 8px;
  border: 1px solid #21262d;
  transition: all 0.2s;
}

.feature-card:hover {
  border-color: #30363d;
  transform: translateY(-2px);
}

.feature-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 8px;
}

.feature-card h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.feature-card p {
  font-size: 13px;
  color: #8b949e;
  margin: 0;
}

/* ===== Демо ===== */
.demo-content {
  padding: 20px;
}

.mode-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.mode-btn {
  padding: 8px 16px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.mode-btn:hover {
  background: #1c2333;
  color: #e6edf3;
}

.mode-btn.active {
  background: #1f2937;
  border-color: #58a6ff;
  color: #58a6ff;
}

.demo-inputs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.demo-input {
  max-width: 500px;
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.demo-item h4 {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 12px 0;
  color: #8b949e;
}

.demo-select {
  min-width: 200px;
}

.nested-selects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selected-info {
  padding: 10px 14px;
  background: #0d2818;
  border: 1px solid #238636;
  border-radius: 6px;
  color: #3fb950;
  font-size: 14px;
}

/* ===== Code Example ===== */
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

.code-example code {
  color: #e6edf3;
}

.code-example .comment { color: #8b949e; }
.code-example .keyword { color: #ff7b72; }
.code-example .function { color: #d2a8ff; }
.code-example .string { color: #3fb950; }

/* ===== Tips ===== */
.tips-list {
  list-style: none;
  padding: 16px 20px;
  margin: 0;
}

.tips-list li {
  display: flex;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #21262d;
}

.tips-list li:last-child {
  border-bottom: none;
}

.tip-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.tips-list li strong {
  display: block;
  color: #e6edf3;
}

.tips-list li p {
  margin: 2px 0 0 0;
  color: #8b949e;
  font-size: 14px;
}

/* ===== Адаптивность ===== */
@media (max-width: 1024px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .doc-sidebar {
    width: 60px;
    min-width: 60px;
  }

  .doc-sidebar .logo-text,
  .doc-sidebar .version-badge,
  .doc-sidebar .nav-description,
  .doc-sidebar .footer-info {
    display: none;
  }

  .doc-sidebar .nav-item {
    padding: 12px;
    justify-content: center;
  }

  .doc-sidebar .nav-content {
    display: none;
  }

  .doc-header {
    padding: 16px 20px;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .doc-content {
    padding: 16px 20px 40px;
  }

  .doc-header h1 {
    font-size: 22px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .mode-selector {
    flex-direction: column;
  }

  .mode-btn {
    width: 100%;
    justify-content: center;
  }

  .demo-input {
    max-width: 100%;
  }
}

@media (max-width: 480px) {
  .doc-sidebar {
    display: none;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .section-title-wrapper h2 {
    font-size: 20px;
  }

  .doc-header h1 {
    font-size: 20px;
  }
}
</style>