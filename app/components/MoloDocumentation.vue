<script setup lang="ts">
import { ref, computed } from "vue"

const inputMode = ref<'default' | 'address' | 'phone'>('default')
const inputValue = ref('')
const addressValue = ref('')
const phoneValue = ref('')

// Для примера с MoloSelect
const selectValue = ref<number | null>(null)
const selectOptions = [
  {id: 1, name: 'Аня', age: 18},
  {id: 2, name: 'Лера', age: 20},
  {id: 3, name: 'Вика', age: 22}
]

// Тестовые данные для примера с parent/children
const testParent = ref([
  {
    id: 1,
    category: 'Фрукты',
    items: [
      {_id: 1, name: 'Яблоко'},
      {_id: 2, name: 'Банан'}
    ]
  },
  {
    id: 2,
    category: 'Овощи',
    items: [
      {_id: 3, name: 'Помидор'},
      {_id: 4, name: 'Огурец'}
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

// Секции для навигации
const sections = [
  { id: 'input', title: 'MoloInput', icon: '📝' },
  { id: 'select', title: 'MoloSelect', icon: '🔽' },
  { id: 'notifications', title: 'useNotifications', icon: '🔔' }
]

const activeSection = ref<string>('input')
</script>

<template>
  <div class="documentation-container">
    <!-- Боковая навигация -->
    <div class="doc-nav">
      <div class="nav-header">
        <h4>Содержание</h4>
      </div>
      <div class="nav-items">
        <button
            v-for="section in sections"
            :key="section.id"
            class="nav-item"
            :class="{ active: activeSection === section.id }"
            @click="activeSection = section.id"
        >
          <span class="nav-icon">{{ section.icon }}</span>
          <code>{{ section.title }}</code>
        </button>
      </div>
    </div>

    <!-- Основной контент -->
    <div class="documentation-wrapper">
      <div class="documentation-header">
        <h3>Документация по компонентам</h3>
      </div>

      <div class="documentation-content">
        <!-- Введение -->
        <div class="intro-box">
          <p>Здесь доступна общая информация о работе с редактором кода и дополнительными элементами, которые помогут в разработке модулей</p>
        </div>

        <!-- Секция MoloInput -->
        <div v-show="activeSection === 'input'" class="doc-section">
          <div class="section-header">
            <h2>MoloInput</h2>
            <span class="section-badge">Компонент ввода</span>
          </div>

          <div class="props-table">
            <h3>Параметры (Props)</h3>
            <table>
              <thead>
              <tr><th>Параметр</th><th>Тип</th><th>Описание</th></tr>
              </thead>
              <tbody>
              <tr><td><code>tLabel</code></td><td>String</td><td>Надпись над полем ввода</td></tr>
              <tr><td><code>lRequired</code></td><td>Boolean</td><td>Показывает звездочку (*) обязательного поля</td></tr>
              <tr><td><code>modelValue</code></td><td>Any</td><td>Аналог v-model</td></tr>
              <tr><td><code>iRequired</code></td><td>Boolean</td><td>Обязательное заполнение поля</td></tr>
              <tr><td><code>placeholder</code></td><td>String</td><td>Подсказка в поле ввода</td></tr>
              <tr><td><code>maxLength</code></td><td>Number</td><td>Максимальная длина текста</td></tr>
              <tr><td><code>readonly</code></td><td>Boolean</td><td>Режим только для чтения</td></tr>
              <tr><td><code>address</code></td><td>Boolean</td><td>Режим ввода адреса с автоподбором</td></tr>
              <tr><td><code>phone</code></td><td>Boolean</td><td>Режим ввода телефона с форматированием</td></tr>
              </tbody>
            </table>
          </div>

          <div class="demo-block">
            <div class="demo-header">
              <span class="demo-title">Демонстрация</span>
            </div>

            <div class="input-modes">
              <label class="mode-label" :class="{ active: inputMode === 'default' }">
                <input type="radio" value="default" v-model="inputMode"/>
                <span>Обычный режим</span>
              </label>
              <label class="mode-label" :class="{ active: inputMode === 'address' }">
                <input type="radio" value="address" v-model="inputMode"/>
                <span>Режим адреса</span>
              </label>
              <label class="mode-label" :class="{ active: inputMode === 'phone' }">
                <input type="radio" value="phone" v-model="inputMode"/>
                <span>Режим телефона</span>
              </label>
            </div>

            <div class="demo-example">
              <MoloInput
                  v-if="inputMode === 'default'"
                  v-model="inputValue"
                  tLabel="Пример обычного ввода"
                  placeholder="Введите текст..."
              />
              <MoloInput
                  v-if="inputMode === 'address'"
                  v-model="addressValue"
                  tLabel="Пример ввода адреса"
                  placeholder="Начните вводить адрес..."
                  :address="true"
              />
              <MoloInput
                  v-if="inputMode === 'phone'"
                  v-model="phoneValue"
                  tLabel="Пример ввода телефона"
                  placeholder="+7 (___) ___-__-__"
                  :phone="true"
              />
            </div>
          </div>
        </div>

        <!-- Секция MoloSelect -->
        <div v-show="activeSection === 'select'" class="doc-section">
          <div class="section-header">
            <h2>MoloSelect</h2>
            <span class="section-badge">Компонент выбора</span>
          </div>

          <div class="props-table">
            <h3>Параметры (Props)</h3>
            <table>
              <thead>
              <tr><th>Параметр</th><th>Тип</th><th>Описание</th></tr>
              </thead>
              <tbody>
              <tr><td><code>tLabel</code></td><td>String</td><td>Надпись над полем выбора</td></tr>
              <tr><td><code>parent</code></td><td>Array</td><td>Массив данных для отображения</td></tr>
              <tr><td><code>children</code></td><td>String</td><td>Ключ для отображения текста опций</td></tr>
              <tr><td><code>valueKey</code></td><td>String</td><td>Ключ для значения опций</td></tr>
              <tr><td><code>disabled</code></td><td>String</td><td>Текст заблокированной опции</td></tr>
              <tr><td><code>all</code></td><td>String</td><td>Опция "Все" в начале списка</td></tr>
              <tr><td><code>placeholder</code></td><td>String</td><td>Placeholder для селекта</td></tr>
              </tbody>
            </table>
          </div>

          <div class="demo-block">
            <div class="demo-header">
              <span class="demo-title">Демонстрация</span>
            </div>

            <div class="demo-examples">
              <!-- Простой пример -->
              <div class="demo-item">
                <h4>Пример 1: Простой список</h4>
                <MoloSelect
                    tLabel="Выберите имя"
                    :parent="selectOptions"
                    children="name"
                    placeholder="Выберите имя"
                />
              </div>

              <!-- Вложенные селекты -->
              <div class="demo-item">
                <h4>Пример 2: Вложенные списки (категории → пункты)</h4>
                <div class="nested-selects">
                  <MoloSelect
                      v-model="selectedCategory"
                      :parent="testParent"
                      children="category"
                      valueKey="id"
                      tLabel="Категория"
                      placeholder="Выберите категорию"
                  />

                  <MoloSelect
                      v-if="selectedCategory"
                      v-model="selectedItem"
                      :parent="testParent.find(c => c.id === Number(selectedCategory))?.items || []"
                      children="name"
                      valueKey="_id"
                      tLabel="Пункт"
                      placeholder="Выберите пункт"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-show="activeSection === 'notifications'" class="doc-section">
          <div class="section-header">
            <h2>useNotifications</h2>
            <span class="section-badge">Инструмент уведомлений</span>
          </div>

          <div class="description-block">
            <p>Инструмент для управления системой уведомлений. Поддерживает:</p>
            <ul>
              <li>Глобальное хранилище уведомлений</li>
              <li>Одиночные уведомления (не показываются повторно)</li>
              <li>Автоматическое предотвращение дубликатов</li>
              <li>Условный показ на основе роли пользователя</li>
            </ul>
          </div>
          <!-- Параметры конфига -->
          <div class="props-table">
            <h3>Параметры уведомления (в конфиге)</h3>
            <table>
              <thead>
              <tr><th>Параметр</th><th>Тип</th><th>Описание</th></tr>
              </thead>
              <tbody>
              <tr><td><code>type</code></td><td>String</td><td>Тип уведомления: info, success, warning, error</td></tr>
              <tr><td><code>title</code></td><td>String</td><td>Заголовок уведомления</td></tr>
              <tr><td><code>text</code></td><td>String</td><td>Текст уведомления</td></tr>
              <tr><td><code>single</code></td><td>Boolean</td><td>Если true — показывается только один раз (сохраняется в localStorage)</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Методы -->
          <div class="props-table">
            <h3>Методы (Returns)</h3>
            <table>
              <thead>
              <tr><th>Метод</th><th>Параметры</th><th>Возвращает</th><th>Описание</th></tr>
              </thead>
              <tbody>
              <tr>
                <td><code>addNotification</code></td>
                <td><code>key: string, dynamicText?: string</code></td>
                <td><code>boolean</code></td>
                <td>Добавляет уведомление по ключу из конфига. Возвращает true если добавлено</td>
              </tr>
              <tr>
                <td><code>removeNotification</code></td>
                <td><code>id: number</code></td>
                <td><code>void</code></td>
                <td>Удаляет уведомление по ID</td>
              </tr>
              <tr>
                <td><code>clearNotifications</code></td>
                <td><code>-</code></td>
                <td><code>void</code></td>
                <td>Очищает все уведомления</td>
              </tr>
              <tr>
                <td><code>checkAndShowNotifications</code></td>
                <td><code>role: string, userId?: string</code></td>
                <td><code>void</code></td>
                <td>Проверяет роль и показывает соответствующие уведомления</td>
              </tr>
              </tbody>
            </table>
          </div>

          <!-- Реактивные данные -->
          <div class="props-table">
            <h3>Пример с добавлением уведомления</h3>
            <table>
              <thead>
              <tr>
                <th>Функция</th>
                <th>Тип</th>
                <th>Динамический текст</th>
                <th>Описание</th>
              </tr>
              </thead>
              <tbody>
              <tr>
                <td><code>addNotification(1, 2)</code></td>
                <td>1. <code>NOTICE_DEFAULT</code></td>
                <td>2. Любой текст</td>
                <td>Имеет стандартное оформление уведомления, используется в основном для положительных результатов выполнения</td>
              </tr>
              <tr>
                <td><code>addNotification(1, 2)</code></td>
                <td>1. <code>DANGER_DEFAULT</code></td>
                <td>2. Любой текст / Предупреждение</td>
                <td>Имеет оформление уведомления, предупреждающее о конфликтном моменте. Используется в основном для предупреждения или дополнительного информирования результатов выполнения</td>
              </tr>
              <tr>
                <td><code>addNotification(1, 2)</code></td>
                <td>1. <code>ERROR_DEFAULT</code></td>
                <td>2. Любой текст / Ошибка</td>
                <td>Имеет оформление, уведомляющее о неудачном выполнении операции. Используется для разбора ошибок и выяснения их происхождения</td>
              </tr>
              </tbody>
            </table>
          </div>
          <!-- Особенности работы -->
          <div class="props-table">
            <h3>⚠️ Особенности работы</h3>
            <table>
              <tbody>
              <tr><td><code>single: true</code></td><td>Уведомление сохраняется в localStorage и больше никогда не покажется</td></tr>
              <tr><td><code>Предотвращение дубликатов</code></td><td>Одинаковые уведомления (title + text) не добавляются повторно</td></tr>
              <tr><td><code>Защита от повторных вызовов</code></td><td><code>checkAndShowNotifications</code> имеет защиту от множественных вызовов</td></tr>
              <tr><td><code>Глобальное хранилище</code></td><td>Состояние уведомлений общее для всех экземпляров хука</td></tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.documentation-container {
  display: flex;
  height: 100%;
  background-color: #1e1e1e;
}

.doc-nav {
  width: 250px;
  background-color: #252526;
  border-right: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.nav-header {
  padding: 16px;
  border-bottom: 1px solid #3c3c3c;
}

.nav-header h4 {
  margin: 0;
  color: #fff;
  font-size: 14px;
}

.nav-items {
  flex: 1;
  padding: 8px;
}

.nav-item {
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  color: #ccc;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  font-size: 13px;
}

.nav-item:hover {
  background-color: #2d2d2d;
  color: #fff;
}

.nav-item.active {
  background-color: #1e6f3f;
  color: #fff;
}

.nav-icon {
  font-size: 18px;
}

.documentation-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.documentation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: #252526;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;
}

.documentation-header h3 {
  margin: 0;
  color: #fff;
  font-size: 16px;
}
.documentation-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* Введение */
.intro-box {
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 24px;
  color: #ccc;
}

.doc-section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #3c3c3c;
}

.section-header h2 {
  margin: 0;
  color: #fff;
  font-size: 22px;
}

.section-badge {
  background-color: #3c3c3c;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  color: #ccc;
}

/* Таблица параметров */
.props-table {
  margin-bottom: 24px;
}

.props-table h3 {
  color: #fff;
  font-size: 16px;
  margin-bottom: 12px;
}

.props-table table {
  width: 100%;
  border-collapse: collapse;
  background-color: #252526;
  border-radius: 6px;
  overflow: hidden;
}

.props-table th,
.props-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #3c3c3c;
}

.props-table th {
  background-color: #2d2d2d;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
}

.props-table td {
  color: #ccc;
  font-size: 12px;
}

.props-table code {
  background-color: #1e1e1e;
}

/* Демо-блоки */
.demo-block {
  background-color: #252526;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 24px;
  border: 1px solid #3c3c3c;
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #2d2d2d;
  border-bottom: 1px solid #3c3c3c;
}

.demo-title {
  color: #fff;
  font-weight: 500;
  font-size: 14px;
}

.input-modes {
  height: fit-content;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid #3c3c3c;
}

.mode-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #1e1e1e;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #3c3c3c;
}

.mode-label:hover {
  background-color: #2d2d2d;
}

.mode-label.active {
  background-color: var(--border-color_hover);
  border-color: var(--border-color_hover);
}

.mode-label input {
  margin: 0;
}

.demo-example,
.demo-examples {
  padding: 16px;
  display: flex;
}

.demo-item {
  margin-bottom: 20px;
}

.demo-item h4 {
  color: #fff;
  font-size: 14px;
  margin: 0 0 12px 0;
}

.nested-selects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}


</style>