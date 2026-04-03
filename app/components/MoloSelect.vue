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
  children?: any
  parent?: any
  disabled?: any
  key?: any
  value?: any
  valueKey?: string
  all?: any
}>()

defineEmits<{
  'update:modelValue': [value: string]
  'input': [event: Event]
  'focus': [event: Event]
}>()
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
        @input="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
        @focus="$emit('focus', $event)"
        :required="iRequired"
        class="select"
    >
      <option value="" disabled v-if="disabled">{{ disabled }}</option>
      <option value="" v-if="all">{{ all }}</option>

      <!-- Если parent - массив объектов и есть children -->
      <template v-if="parent && parent.length && children">
        <option
            v-for="item in parent"
            :key="item[valueKey || '_id'] || item"
            :value="item[valueKey || '_id'] || item"
        >
          {{ item[children] }}
        </option>
      </template>

      <!-- Если parent - массив строк или простой массив -->
      <template v-else-if="parent && parent.length">
        <option
            v-for="item in parent"
            :key="key || item"
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
  border-color: #1eef6f;
  box-shadow: 0 0 0 2px rgba(30, 239, 111, 0.2);
}

.select option {
  background: #363535;
  border-radius: 5px;
  color: white;
}
</style>