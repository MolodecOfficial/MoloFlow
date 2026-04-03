<script setup lang="ts">
import {ref} from "vue"

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
</script>

<template>
  <div class="documentation-header">
    <h3>Документация</h3>
  </div>
  <div class="documentation-content">
    <h3>Здесь доступна общая информация о работе с редактором кода и дополнительными элементами, которые помогут в разработке модулей</h3>
    <ul>
      <li>Встроенный элемент ввода - <code>MoloInput</code>. Содержит в себе несколько параметров:
        <ul>
          <li><code>tLabel</code> - Позволит ввести надпись над вводом текста</li>
          <li><code>lRequired</code> - Устанавливает звездочку над надписью, указывая обязательным это поле</li>
          <li><code>modelValue</code> - Аналог <code>v-model</code>, использовать при неразрешимых проблемах</li>
          <li><code>iRequired</code> - Устанавливает обязательное заполнение данного поля</li>
          <li><code>placeholder</code> - Фоновый текст для поля ввода</li>
          <li><code>maxLength</code> - Позволяет указать максимально разрешимое количество символов для ввода</li>
          <li><code>readonly</code> - Включит режим - только для чтения</li>
          <li><code>address</code> - Специальная надстройка у <code>MoloInput</code>. Установив параметр -
            <code>true</code>, введя начало адреса, отобразится список адресов по введеным данным
          </li>
          <li><code>phone</code> - Специальная надстройка у <code>MoloInput</code>. Установив параметр -
            <code>true</code>, включится специальное форматирование текста под формат номера телефона
          </li>
        </ul>
        <div class="input-modes">
          <label>
            <input type="radio" value="default" v-model="inputMode"/>
            Обычный режим
          </label>

          <label>
            <input type="radio" value="address" v-model="inputMode"/>
            Режим адреса
          </label>

          <label>
            <input type="radio" value="phone" v-model="inputMode"/>
            Режим телефона
          </label>
        </div>
        <MoloInput
            :address="inputMode === 'address'"
            :phone="inputMode === 'phone'"
        />
      </li>
      <li>Встроенный элемент ввода - <code>MoloSelect</code>. Содержит в себе несколько параметров:
        <ul>
          <li><code>tLabel</code> - Позволит ввести надпись над вводом текста</li>
          <li><code>lRequired</code> - Устанавливает звездочку над надписью, указывая обязательным это поле</li>
          <li><code>modelValue</code> - Аналог <code>v-model</code>, использовать при неразрешимых проблемах</li>
          <li><code>iRequired</code> - Устанавливает обязательное заполнение данного поля</li>
          <li><code>placeholder</code> - Фоновый текст для поля ввода</li>
          <li><code>maxLength</code> - Позволяет указать максимально разрешимое количество символов для ввода</li>
          <li><code>readonly</code> - Включит режим - только для чтения</li>
          <li><code>parent</code> - Специальная надстройка у <code>MoloSelect</code>. Прямой аналог <code>v-for</code>,
            позволит напрямую выбрать "родителя" данного объекта
          </li>
          <li><code>children</code> - Специальная надстройка у <code>MoloSelect</code>. Работает вместе с
            <code>parent</code>, но уже отвечает за "детей" внутри "родителя"
          </li>
          <li><code>valueKey</code> - Позволит перебрать "детей" по определённым параметрам (_id)</li>
          <li><code>disabled</code> - Добавляет заблокированный параметр, текст которого Вы можете установить внутри
            параметра
          </li>
          <li><code>all</code> - Включит полный список досутпных вариантов</li>
        </ul>

        <!-- Пример с parent/children - выбор категории -->
        <div class="select-example">
          <MoloSelect
              tLabel="Выберите имя из простого списка"
              :parent="selectOptions"
              children="name"
              disabled="Выберите имя"
          />


          <MoloSelect
              v-model="selectedCategory"
              :parent="testParent"
              children="category"
              valueKey="id"
              tLabel="Выберите категорию из списка с вложениями"
              placeholder="Выберите категорию"
              disabled="Выберите категорию"
          />

          <MoloSelect
              v-if="selectedCategory"
              v-model="selectedItem"
              :parent="testParent.find(c => c.id === Number(selectedCategory))?.items || []"
              children="name"
              valueKey="_id"
              tLabel="Выберите пункт из определённого вложения"
              placeholder="Выберите пункт"
              disabled="Выберите пункт"
          />
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.documentation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #252526;
  border-bottom: 1px solid #3c3c3c;
}

.documentation-header h3 {
  margin: 0;
  color: #fff;
  font-size: 14px;
}

.documentation-content {
  flex: 2;
  padding: 16px;
  color: #ccc;
  font-size: 13px;
  line-height: 1.5;
  overflow-y: auto;
}

.documentation-content ul {
  margin-top: 12px;
  padding-left: 20px;
}

.documentation-content li {
  margin: 8px 0;
}

.documentation-content code {
  background-color: #2d2d2d;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  color: #d4d4d4;
}

.input-modes {
  margin: 10px 0;
  display: flex;
  gap: 15px;
}

.input-modes label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.select-example {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.selected-info {
  margin-top: 10px;
  padding: 8px;
  background-color: #2d2d2d;
  border-radius: 4px;
  color: #4ec9b0;
}
</style>