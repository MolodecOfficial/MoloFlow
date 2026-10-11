<!-- components/ui/MoloSticker.vue -->
<script setup lang="ts">
import {computed} from 'vue'

export type StickerName =
    | 'departments'
    | 'it'
    | 'finance'
    | 'bank'
    | 'bank_accounts'
    | 'counterparties'
    | 'nomenclature'
    | 'warehouse'
    | 'glossary'
    | 'construction'
    | 'store'
    | 'sales'
    | 'management'
    | 'production'
    | 'services'
    | 'folder'
    | 'folder-open'
    | 'history'
    | 'lock'
    | 'edit'
    | 'trash'
    | 'phone'
    | 'zoom-in'
    | 'zoom-out'
    | 'rotate'
    | 'print'
    | 'download'
    | 'fullscreen'
    | 'fullscreen-exit'

const props = withDefaults(
    defineProps<{
      name: StickerName | string
      size?: number | string
      glow?: boolean
    }>(),
    {
      size: 16,
      glow: false
    }
)

const resolvedSize = computed(() => {
  return typeof props.size === 'number' ? `${props.size}px` : props.size
})

const activeIcon = computed(() => {
  switch (props.name) {
    case 'bank_accounts':
      return 'bank'
    case 'warehouse':
      return 'nomenclature'
    case 'sales':
      return 'store'
    default:
      return props.name
  }
})
</script>

<template>
  <span
      class="molo-sticker"
      :class="{ 'with-glow': glow }"
      :style="{ width: resolvedSize, height: resolvedSize }"
  >
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="sticker-svg"
    >
      <defs>
        <!-- Премиальный холодный неон (Linear / Raycast) -->
        <linearGradient id="stk-cyan-core" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#38bdf8"/>
          <stop offset="0.6" stop-color="#3b82f6"/>
          <stop offset="1" stop-color="#1d4ed8"/>
        </linearGradient>

        <!-- Мягкий изумруд (Финансы / Успех) -->
        <linearGradient id="stk-emerald" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#4ade80"/>
          <stop offset="1" stop-color="#059669"/>
        </linearGradient>

        <!-- Тёплый янтарь (Склад / Логистика / Производство) -->
        <linearGradient id="stk-amber" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#fcd34d"/>
          <stop offset="1" stop-color="#d97706"/>
        </linearGradient>

        <!-- Пурпурно-синий (Безопасность / Руководство) -->
        <linearGradient id="stk-purple" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#c084fc"/>
          <stop offset="1" stop-color="#7c3aed"/>
        </linearGradient>

        <!-- Рубиновый (Удаление / Отмена) -->
        <linearGradient id="stk-rose" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#fb7185"/>
          <stop offset="1" stop-color="#e11d48"/>
        </linearGradient>
      </defs>

      <!-- ⏱️ История версий / Снимок (Выверено строго под 24x24) -->
      <g v-if="activeIcon === 'history'">
        <circle cx="12" cy="12" r="8.5" stroke="url(#stk-cyan-core)" stroke-width="1.6" stroke-linecap="round"
                stroke-dasharray="48 6"/>
        <path d="M12 7.5V12L15 14" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3.5 10L6.5 10L5 7" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="1.2" fill="#38bdf8"/>
      </g>

      <!-- 📁 Папка закрытая -->
      <g v-else-if="activeIcon === 'folder'">
        <path
            d="M2.5 7C2.5 5.6 3.6 4.5 5 4.5H8.5C9.2 4.5 9.8 4.8 10.2 5.3L11.5 6.8C11.9 7.2 12.4 7.5 13 7.5H19C20.4 7.5 21.5 8.6 21.5 10V18C21.5 19.4 20.4 20.5 19 20.5H5C3.6 20.5 2.5 19.4 2.5 18V7Z"
            fill="#1e2230" fill-opacity="0.8" stroke="url(#stk-cyan-core)" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M2.5 10.5H21.5" stroke="#38bdf8" stroke-opacity="0.35" stroke-width="1.2"/>
        <path d="M6 14H10" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.4" stroke-linecap="round"/>
      </g>

      <!-- 📂 Папка открытая -->
      <g v-else-if="activeIcon === 'folder-open'">
        <path
            d="M3 7C3 5.9 3.9 5 5 5H8.5C9.1 5 9.7 5.3 10.1 5.8L11.4 7.2C11.8 7.7 12.3 8 13 8H19C20.1 8 21 8.9 21 10V13H3V7Z"
            fill="#1e2230" fill-opacity="0.8" stroke="url(#stk-cyan-core)" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M1.5 20L4 10.5H22.5L20 20H1.5Z" fill="#131722" fill-opacity="0.9" stroke="#38bdf8" stroke-width="1.5"
              stroke-linejoin="round"/>
        <path d="M7 15.5H12" stroke="#38bdf8" stroke-width="1.4" stroke-linecap="round"/>
      </g>

      <!-- 🗖 Полный экран (Четкий прицел в углах) -->
      <g v-else-if="activeIcon === 'fullscreen'">
        <path d="M4 8.5V5C4 4.4 4.4 4 5 4H8.5" stroke="url(#stk-cyan-core)" stroke-width="1.7" stroke-linecap="round"
              stroke-linejoin="round"/>
        <path d="M15.5 4H19C19.6 4 20 4.4 20 5V8.5" stroke="url(#stk-cyan-core)" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 15.5V19C4 19.6 4.4 20 5 20H8.5" stroke="url(#stk-cyan-core)" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.5 20H19C19.6 20 20 19.6 20 19V15.5" stroke="url(#stk-cyan-core)" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <!-- 🗗 Оконный режим -->
      <g v-else-if="activeIcon === 'fullscreen-exit'">
        <path d="M8.5 4V7.5C8.5 8 8 8.5 7.5 8.5H4" stroke="url(#stk-cyan-core)" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.5 4V7.5C15.5 8 16 8.5 16.5 8.5H20" stroke="url(#stk-cyan-core)" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8.5 20V16.5C8.5 16 8 15.5 7.5 15.5H4" stroke="url(#stk-cyan-core)" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.5 20V16.5C15.5 16 16 15.5 16.5 15.5H20" stroke="url(#stk-cyan-core)" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <!-- 👥 Сотрудники и отделы -->
      <g v-else-if="activeIcon === 'departments'">
        <circle cx="16.5" cy="7.5" r="2.8" stroke="url(#stk-purple)" stroke-width="1.4" opacity="0.6"/>
        <path d="M13.5 16.5C13.5 14.5 15 13.5 17 13.5C19 13.5 20.5 14.5 20.5 16.5" stroke="url(#stk-purple)"
              stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>
        <circle cx="9.5" cy="8" r="3.5" stroke="url(#stk-cyan-core)" stroke-width="1.6"/>
        <path d="M4 19.5C4 16.2 6.5 14.5 9.5 14.5C12.5 14.5 15 16.2 15 19.5" stroke="url(#stk-cyan-core)"
              stroke-width="1.7" stroke-linecap="round"/>
      </g>

      <!-- 💻 IT и разработка -->
      <g v-else-if="activeIcon === 'it'">
        <rect x="3" y="4" width="18" height="12.5" rx="2.5" stroke="url(#stk-cyan-core)" stroke-width="1.6"/>
        <path d="M7.5 9.5L9.5 10.5L7.5 11.5" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round"/>
        <path d="M12 11.5H14.5" stroke="#4ade80" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M9 19.5H15M12 16.5V19.5" stroke="url(#stk-cyan-core)" stroke-width="1.6" stroke-linecap="round"/>
      </g>

      <!-- 💰 Финансы -->
      <g v-else-if="activeIcon === 'finance'">
        <circle cx="12" cy="12" r="8.5" stroke="url(#stk-emerald)" stroke-width="1.6"/>
        <path
            d="M12 7.5V16.5M9.8 10C9.8 8.8 10.8 8.2 12 8.2C13.3 8.2 14.2 9 14.2 10.1C14.2 11.5 12.8 11.8 11.5 12.2C10.2 12.6 9.8 13.2 9.8 14.2C9.8 15.5 10.8 16 12 16C13.5 16 14.5 15.2 14.5 14"
            stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      </g>

      <!-- 🏛️ Банк -->
      <g v-else-if="activeIcon === 'bank'">
        <path d="M3.5 8.5L12 4L20.5 8.5H3.5Z" stroke="url(#stk-cyan-core)" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M6 11V16.5M10 11V16.5M14 11V16.5M18 11V16.5" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"
              stroke-linecap="round"/>
        <path d="M3 19.5H21" stroke="url(#stk-cyan-core)" stroke-width="1.8" stroke-linecap="round"/>
      </g>

      <!-- 🤝 Контрагенты -->
      <g v-else-if="activeIcon === 'counterparties'">
        <circle cx="7.5" cy="12" r="4" stroke="url(#stk-cyan-core)" stroke-width="1.6"/>
        <circle cx="16.5" cy="12" r="4" stroke="url(#stk-emerald)" stroke-width="1.6"/>
        <path d="M11 12H13" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="1.3" fill="#ffffff"/>
      </g>

      <!-- 📦 Номенклатура / Склад -->
      <g v-else-if="activeIcon === 'nomenclature'">
        <path d="M12 3.5L20 8V16L12 20.5L4 16V8L12 3.5Z" stroke="url(#stk-amber)" stroke-width="1.6"
              stroke-linejoin="round"/>
        <path d="M12 3.5V20.5M20 8L12 12.5L4 8" stroke="url(#stk-amber)" stroke-width="1.5" stroke-linejoin="round"/>
      </g>

      <!-- 🏗️ Строительство -->
      <g v-else-if="activeIcon === 'construction'">
        <path d="M5 20.5V6.5L15 4V20.5" stroke="url(#stk-amber)" stroke-width="1.6"/>
        <path d="M5 10H15M5 14H15M5 17.5H15" stroke="url(#stk-amber)" stroke-width="1.3" opacity="0.6"/>
        <path d="M15 7L20 9.5V20.5" stroke="#fcd34d" stroke-width="1.5"/>
        <path d="M3 20.5H21" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>
      </g>

      <!-- 🛒 Магазин -->
      <g v-else-if="activeIcon === 'store'">
        <path d="M3.5 5H5.8L8.2 15.5H18.5L20.8 7.5H7" stroke="url(#stk-emerald)" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="9.5" cy="18.5" r="1.7" fill="#ffffff"/>
        <circle cx="17.2" cy="18.5" r="1.7" fill="#ffffff"/>
      </g>

      <!-- 🛡️ Руководство / Менеджмент -->
      <g v-else-if="activeIcon === 'management'">
        <path d="M12 3.5L19 6.5V11.5C19 16 16 19 12 20.5C8 19 5 16 5 11.5V6.5L12 3.5Z" stroke="url(#stk-purple)"
              stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M9.5 11.5L11.5 13.5L15 9.5" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"
              stroke-linejoin="round"/>
      </g>

      <!-- 🏭 Производство -->
      <g v-else-if="activeIcon === 'production'">
        <path d="M3.5 20V10L8.5 12.5V10L13.5 12.5V7.5L20.5 11V20H3.5Z" stroke="url(#stk-amber)" stroke-width="1.6"
              stroke-linejoin="round"/>
        <circle cx="7" cy="16" r="1.2" fill="#ffffff"/>
        <circle cx="12" cy="16" r="1.2" fill="#ffffff"/>
        <circle cx="17" cy="16" r="1.2" fill="#ffffff"/>
      </g>

      <!-- 🛠️ Услуги -->
      <g v-else-if="activeIcon === 'services'">
        <path d="M17.5 7L15 4.5L8.5 11L7.5 14.5L11 13.5L17.5 7Z" stroke="url(#stk-cyan-core)" stroke-width="1.6"
              stroke-linejoin="round"/>
        <path d="M5.5 5.5L8.5 8.5M11.5 11.5L13 13M5 19L7.5 16.5" stroke="#38bdf8" stroke-width="1.7"
              stroke-linecap="round"/>
      </g>

      <!-- 📖 Глоссарий / Документация -->
      <g v-else-if="activeIcon === 'glossary'">
        <path d="M4.5 6C4.5 4.9 5.4 4 6.5 4H19.5V17.5H6.5C5.4 17.5 4.5 18.4 4.5 19.5V6Z" stroke="url(#stk-cyan-core)"
              stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M4.5 17.5C5.5 17.5 6.5 18 7.5 19H19.5" stroke="url(#stk-cyan-core)" stroke-width="1.5"
              stroke-linecap="round"/>
        <path d="M8.5 8.5H15.5M8.5 12H13.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      </g>

      <!-- ✏️ Карандаш -->
      <g v-else-if="activeIcon === 'edit'">
        <path d="M5 19L8 18.5L17.5 9L14.5 6L5 15.5V19Z" stroke="url(#stk-cyan-core)" stroke-width="1.5"
              stroke-linejoin="round"/>
        <path d="M12.5 8L15.5 11" stroke="#ffffff" stroke-width="1.3"/>
      </g>

      <!-- 🗑️ Удалить / Корзина -->
      <g v-else-if="activeIcon === 'trash'">
        <path d="M6.5 8V18C6.5 19.1 7.4 20 8.5 20H15.5C16.6 20 17.5 19.1 17.5 18V8" stroke="white"
              stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M4.5 8H19.5M9.5 5.5H14.5" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M10 11.5V16.5M14 11.5V16.5" stroke="white" stroke-width="1.3" stroke-linecap="round"
              opacity="0.7"/>
      </g>

      <!-- 📞 Телефон -->
      <g v-else-if="activeIcon === 'phone'">
        <path
            d="M6.5 4C6 4 5.5 4.4 5.5 5C5.8 13.5 10.5 18.2 19 18.5C19.6 18.5 20 18 20 17.5V15.5C20 15 19.6 14.6 19.1 14.5L16.2 13.9C15.8 13.8 15.4 14 15.2 14.3L14.1 15.4C12 14.4 10.6 13 9.6 10.9L10.7 9.8C11 9.6 11.2 9.2 11.1 8.8L10.5 5.9C10.4 5.4 10 5 9.5 5H6.5Z"
            stroke="url(#stk-cyan-core)" stroke-width="1.5" stroke-linejoin="round"/>
      </g>

      <!-- 🔍+ Приблизить -->
      <g v-else-if="activeIcon === 'zoom-in'">
        <circle cx="11" cy="11" r="6.5" stroke="url(#stk-cyan-core)" stroke-width="1.6"/>
        <path d="M15.5 15.5L19.5 19.5" stroke="url(#stk-cyan-core)" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M11 8.5V13.5M8.5 11H13.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      </g>

      <!-- 🔍- Отдалить -->
      <g v-else-if="activeIcon === 'zoom-out'">
        <circle cx="11" cy="11" r="6.5" stroke="url(#stk-cyan-core)" stroke-width="1.6"/>
        <path d="M15.5 15.5L19.5 19.5" stroke="url(#stk-cyan-core)" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M8.5 11H13.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      </g>

      <!-- 🔄 Повернуть -->
      <g v-else-if="activeIcon === 'rotate'">
        <path d="M18.5 9C17.6 6.5 15.2 4.8 12.5 4.8C8.8 4.8 5.8 7.8 5.8 11.5" stroke="url(#stk-cyan-core)"
              stroke-width="1.6" stroke-linecap="round"/>
        <path d="M18.5 5V9.5H14" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5.5 15C6.4 17.5 8.8 19.2 11.5 19.2C15.2 19.2 18.2 16.2 18.2 12.5" stroke="url(#stk-cyan-core)"
              stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>
      </g>

      <!-- 🖨️ Печать -->
      <g v-else-if="activeIcon === 'print'">
        <path d="M6.5 7.5V4H17.5V7.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
        <rect x="4" y="7.5" width="16" height="8" rx="2" stroke="url(#stk-cyan-core)" stroke-width="1.5"/>
        <path d="M7 12H17V19.5H7V12Z" fill="#131722" stroke="url(#stk-cyan-core)" stroke-width="1.4"
              stroke-linejoin="round"/>
        <circle cx="16.5" cy="10" r="0.8" fill="#38bdf8"/>
      </g>

      <!-- ⬇️ Скачать -->
      <g v-else-if="activeIcon === 'download'">
        <path d="M12 4.5V14.5M12 14.5L8.5 11M12 14.5L15.5 11" stroke="#38bdf8" stroke-width="1.7" stroke-linecap="round"
              stroke-linejoin="round"/>
        <path d="M5 18.5H19" stroke="url(#stk-cyan-core)" stroke-width="1.7" stroke-linecap="round"/>
      </g>

      <!-- dev:json — фигурные скобки кода с точкой входа -->
<g v-else-if="activeIcon === 'dev-json'">
  <path d="M8.5 4.5C7.2 4.5 6 5.5 6 7V10C6 11 5 12 4 12C5 12 6 13 6 14V17C6 18.5 7.2 19.5 8.5 19.5"
        stroke="url(#stk-cyan-core)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15.5 4.5C16.8 4.5 18 5.5 18 7V10C18 11 19 12 20 12C19 12 18 13 18 14V17C18 18.5 16.8 19.5 15.5 19.5"
        stroke="url(#stk-cyan-core)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="12" r="1.3" fill="#38bdf8"/>
</g>

      <!-- dev:regex — точка со звездочкой и диагональной границей выражения -->
<g v-else-if="activeIcon === 'dev-regex'">
  <circle cx="7" cy="13.5" r="1.7" fill="#c084fc"/>
  <path d="M14 7.5L14 16.5M9.5 12L18.5 12M10.8 8.8L17.2 15.2M10.8 15.2L17.2 8.8" stroke="url(#stk-purple)"
        stroke-width="1.6" stroke-linecap="round"/>
</g>

      <!-- dev:encode — двунаправленный поток трансформации данных -->
<g v-else-if="activeIcon === 'dev-encode'">
  <path d="M4 8.5H17M17 8.5L13.5 5M17 8.5L13.5 12" stroke="url(#stk-emerald)" stroke-width="1.6" stroke-linecap="round"
        stroke-linejoin="round"/>
  <path d="M20 15.5H7M7 15.5L10.5 12M7 15.5L10.5 19" stroke="url(#stk-emerald)" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round"/>
</g>

      <!-- dev:notes — блокнот с текстом и угловым карандашом -->
<g v-else-if="activeIcon === 'dev-notes'">
  <path
      d="M5 4.5H15C16.1 4.5 17 5.4 17 6.5V18.5C17 19.6 16.1 20.5 15 20.5H5C3.9 20.5 3 19.6 3 18.5V6.5C3 5.4 3.9 4.5 5 4.5Z"
      stroke="url(#stk-amber)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M7 8.5H13M7 12.5H11" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M14 14.5L19.5 9L21.5 11L16 16.5L13.5 17L14 14.5Z" fill="#1e2230" stroke="#fcd34d" stroke-width="1.4"
        stroke-linejoin="round"/>
</g>

      <!-- dev:calculator — клавиатурная сетка со знаками вычисления -->
<g v-else-if="activeIcon === 'dev-calculator'">
  <rect x="4" y="3.5" width="16" height="17" rx="3" stroke="url(#stk-cyan-core)" stroke-width="1.6"/>
  <rect x="7" y="6.5" width="10" height="3" rx="1" fill="#38bdf8" fill-opacity="0.25" stroke="#38bdf8"
        stroke-width="1.2"/>
  <circle cx="8" cy="13" r="1" fill="#ffffff"/>
  <circle cx="12" cy="13" r="1" fill="#ffffff"/>
  <circle cx="16" cy="13" r="1" fill="#ffffff"/>
  <circle cx="8" cy="17" r="1" fill="#ffffff"/>
  <circle cx="12" cy="17" r="1" fill="#ffffff"/>
  <path d="M15 17H17" stroke="#4ade80" stroke-width="1.6" stroke-linecap="round"/>
</g>

      <!-- dev:clock — точный циферблат с делениями и стрелками -->
<g v-else-if="activeIcon === 'dev-clock'">
  <circle cx="12" cy="12" r="8.5" stroke="url(#stk-amber)" stroke-width="1.6"/>
  <path d="M12 7.5V12L15.5 13.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="12" r="1.2" fill="#fcd34d"/>
</g>

      <!-- dev:calendar — отрывной настенный календарь с фиксаторами -->
<g v-else-if="activeIcon === 'dev-calendar'">
  <rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="url(#stk-rose)" stroke-width="1.6"/>
  <path d="M3.5 9.5H20.5" stroke="url(#stk-rose)" stroke-width="1.4"/>
  <path d="M8 3V6M16 3V6" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="8" cy="13.5" r="1" fill="#fb7185"/>
  <circle cx="12" cy="13.5" r="1" fill="#ffffff" stroke-opacity="0.8"/>
  <circle cx="16" cy="13.5" r="1" fill="#ffffff" stroke-opacity="0.8"/>
  <circle cx="8" cy="16.5" r="1" fill="#ffffff" stroke-opacity="0.8"/>
  <circle cx="12" cy="16.5" r="1" fill="#ffffff" stroke-opacity="0.8"/>
</g>
    </svg>
  </span>
</template>

<style scoped>
.molo-sticker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: 1;
  flex-shrink: 0;
  box-sizing: border-box;
}

.sticker-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.with-glow {
  filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.45));
}
</style>