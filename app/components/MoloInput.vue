<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps<{
  label?: string
  tLabel: string
  lRequired?: boolean
  type?: string
  id?: string
  modelValue?: string | number
  iRequired?: boolean
  placeholder?: string
  maxLength?: string
  readonly?: any
  address?: boolean
  phone?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'input': [event: Event]
  'focus': [event: Event]
  'address-selected': [address: any]
}>()

// --- логика для телефона ---
const phoneValue = ref('')

function formatPhone(value: string) {
  if (!value) return '+7'

  let numbers = value.replace(/\D/g, '')

  if (numbers.startsWith('8')) {
    numbers = '7' + numbers.substring(1)
  }
  if (!numbers.startsWith('7')) {
    numbers = '7' + numbers
  }

  numbers = numbers.substring(0, 11)

  let formatted = '+7'
  if (numbers.length > 1) {
    formatted += ' (' + numbers.substring(1, 4)
  }
  if (numbers.length >= 5) {
    formatted += ') ' + numbers.substring(4, 7)
  }
  if (numbers.length >= 8) {
    formatted += '-' + numbers.substring(7, 9)
  }
  if (numbers.length >= 10) {
    formatted += '-' + numbers.substring(9, 11)
  }

  return formatted.trim()
}

function onPhoneInput(event: Event) {
  const input = event.target as HTMLInputElement
  const cursorPosition = input.selectionStart || 0
  const oldValue = phoneValue.value

  const newValue = formatPhone(input.value)

  let newCursorPosition = cursorPosition
  if (newValue.length > oldValue.length) {
    newCursorPosition += newValue.length - oldValue.length
  }

  phoneValue.value = newValue
  emit('update:modelValue', newValue)

  nextTick(() => {
    input.setSelectionRange(newCursorPosition, newCursorPosition)
  })
}

function onPhoneFocus(event: Event) {
  const input = event.target as HTMLInputElement
  if (phoneValue.value === '+7') {
    nextTick(() => {
      input.setSelectionRange(2, 2)
    })
  }
  emit('focus', event)
}

function syncPhoneValue() {
  if (props.modelValue !== undefined) {
    phoneValue.value = formatPhone(String(props.modelValue))
  } else {
    phoneValue.value = '+7'
  }
}

watch(() => props.modelValue, (newVal) => {
  if (props.phone && newVal !== undefined && String(newVal) !== phoneValue.value) {
    phoneValue.value = formatPhone(String(newVal))
  }
})

// --- логика подсказок ---
const addressSearch = ref('')
const showAddressDropdown = ref(false)
const suggestions = ref<any[]>([])
const loading = ref(false)

async function loadAddresses() {
  if (!addressSearch.value || addressSearch.value.length < 3) return

  loading.value = true
  try {
    const response = await $fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Token 92342561939d6fa40d4b834a390cac4c5b2d4d7e'
      },
      body: {
        query: addressSearch.value,
        count: 10,
        locations: [{ country: 'Россия' }]
      }
    })
    suggestions.value = response.suggestions
    showAddressDropdown.value = suggestions.value.length > 0
  } catch (error) {
    console.error('Ошибка загрузки адресов:', error)
  } finally {
    loading.value = false
  }
}

let timeout: NodeJS.Timeout
function onAddressSearch() {
  clearTimeout(timeout)
  timeout = setTimeout(loadAddresses, 300)
}

function selectAddress(address: any) {
  emit('update:modelValue', address.value)
  addressSearch.value = address.value
  showAddressDropdown.value = false
  emit('address-selected', address)
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.address-search-container')) {
    showAddressDropdown.value = false
  }
}

onMounted(() => {
  if (props.address) {
    document.addEventListener('click', handleClickOutside)
  }
  if (props.phone) {
    syncPhoneValue()
  }
  if (!props.address && !props.phone && props.modelValue !== undefined) {
    addressSearch.value = String(props.modelValue)
  }
})

onBeforeUnmount(() => {
  if (props.address) {
    document.removeEventListener('click', handleClickOutside)
  }
  clearTimeout(timeout)
})

watch(() => props.modelValue, (newVal) => {
  if (!props.address && !props.phone && newVal !== undefined) {
    addressSearch.value = String(newVal)
  }
})
</script>

<template>
  <!-- Режим телефона -->
  <div v-if="phone" class="form-group">
    <label :for="id || label">
      {{ tLabel }}
      <span class="required" v-if="lRequired">*</span>
    </label>
    <input
        :type="'tel'"
        :id="id || label"
        :value="phoneValue"
        @input="onPhoneInput"
        @focus="onPhoneFocus"
        :required="iRequired"
        :placeholder="placeholder || '+7 (XXX) XXX-XX-XX'"
        :maxlength="maxLength || 18"
        :readonly="readonly"
    />
  </div>

  <!-- Режим поиска адреса -->
  <div v-else-if="address" class="address-search-container">
    <div class="form-group">
      <label :for="id || label">
        {{ tLabel }}
        <span class="required" v-if="lRequired">*</span>
      </label>
      <div class="search-wrapper">
        <input
            :type="type || 'text'"
            :id="id || label"
            :value="addressSearch"
            @input="(e) => { addressSearch = (e.target as HTMLInputElement).value; $emit('update:modelValue', addressSearch); $emit('input', e); onAddressSearch(); }"
            @focus="onAddressSearch"
            :required="iRequired"
            :placeholder="placeholder"
            :maxlength="maxLength"
            :readonly="readonly"
        />
        <div v-if="loading" class="search-spinner"></div>
      </div>
    </div>

    <div v-if="showAddressDropdown && suggestions.length > 0" class="dropdown">
      <div
          v-for="item in suggestions"
          :key="item.data?.kladr_id || item.value"
          class="dropdown-item"
          @click="selectAddress(item)"
      >
        <span>{{ item.value }}</span>
      </div>
    </div>
  </div>

  <!-- Обычный режим (включая date) -->
  <div v-else class="form-group">
    <label :for="id || label">
      {{ tLabel }}
      <span class="required" v-if="lRequired">*</span>
    </label>
    <input
        :type="type || 'text'"
        :id="id || label"
        :value="addressSearch"
        @input="(e) => { const val = (e.target as HTMLInputElement).value; addressSearch = val; $emit('update:modelValue', type === 'number' ? (val === '' ? null : Number(val)) : val); $emit('input', e); }"
        @focus="$emit('focus', $event)"
        :required="iRequired"
        :placeholder="placeholder"
        :maxlength="maxLength"
        :readonly="readonly"
    />
  </div>
</template>

<style scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}

label {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.required {
  color: #ff4d4d;
}

input {
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 5px;
  padding: 10px 12px;
  color: white;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

input[type="date"] {
  color-scheme: dark;
  position: relative;
}

input[type="date"]::-webkit-calendar-picker-indicator {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
}

input[type="date"]::-webkit-calendar-picker-indicator:hover {
  background-color: rgba(30, 239, 111, 0.3);
}

input:focus {
  border-color: #1eef6f;
  box-shadow: 0 0 0 2px rgba(30, 239, 111, 0.2);
}

input::placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
}

input:read-only {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.5);
  cursor: default;
}
input:read-only:focus {
  border-color: rgba(255, 255, 255, 0.05);
  box-shadow: none;
}

.address-search-container {
  position: relative;
  width: 100%;
}
.search-wrapper {
  position: relative;
}
.search-spinner {
  position: absolute;
  right: 12px;
  top: 10px;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(30, 239, 111, 0.2);
  border-top: 2px solid #1eef6f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: #282828;
  border-radius: 4px;
  margin-top: 2px;
  z-index: 1000;
}
.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}
.dropdown-item:hover {
  background: rgba(30, 239, 111, 0.1);
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>