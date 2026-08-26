<script setup lang="ts">
defineProps<{
  label?: string
  tLabel?: string
  lRequired?: boolean
  id?: string
  modelValue?: string
  iRequired?: boolean
  placeholder?: string
  maxLength?: string
  readonly?: any
  children?: string
  parent?: any[]
  disabled?: any
  key?: any
  value?: any
  valueKey?: string
  all?: any
  clearable?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
  'input': [event: Event]
  'focus': [event: Event]
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const value = target.value
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div class="form-group">
    <label :for="id || label">
      {{ tLabel }}
      <span class="required" v-if="lRequired">*</span>
    </label>
    <select
        :id="id || label"
        :value="modelValue"
        @input="handleInput"
        @focus="$emit('focus', $event)"
        :required="iRequired"
        class="select"
    >
      <option value="" disabled v-if="disabled">{{ disabled }}</option>
      <option value="" v-if="all">{{ all }}</option>
      <option value="" v-if="clearable && modelValue">— Очистить —</option>

      <!-- Если parent - массив объектов и есть children -->
      <template v-if="parent && parent.length && children">
        <option
            v-for="item in parent"
            :key="item[valueKey || '_id']"
            :value="item[valueKey || '_id']"
        >
          {{ item[children] }}
        </option>
      </template>

      <!-- Если parent - массив строк или простой массив -->
      <template v-else-if="parent && parent.length">
        <option
            v-for="(item, idx) in parent"
            :key="idx"
            :value="value || item"
        >
          {{ item }}
        </option>
      </template>
    </select>
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

.select {
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  padding: 10px 12px;
  color: white;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  border-radius: 4px;
  min-width: 150px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 20px;
}

.select:focus {
  border-color: var(--borber-color_main);
  box-shadow: 0 0 0 2px rgba(30, 103, 239, 0.2);
}

.select option {
  background: #363535;
  border-radius: 5px;
  color: white;
}
</style>