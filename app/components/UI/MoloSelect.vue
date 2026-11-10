<script setup lang="ts">
defineProps<{
  label?: string
  tLabel?: string
  lRequired?: boolean
  id?: string
  modelValue?: any
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
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'change': [value: any]
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
  <div class="form-group" :class="{ compact }">
    <label v-if="tLabel" :for="id || label">
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

      <template v-if="parent && parent.length && children">
        <option
            v-for="item in parent"
            :key="item[valueKey || '_id']"
            :value="item[valueKey || '_id']"
        >
          {{ item[children] }}
        </option>
      </template>

      <template v-else-if="parent && parent.length">
        <option
            v-for="(item, idx) in parent"
            :key="idx"
            :value="value || item"
        >
          {{ item }}
        </option>
      </template>

      <slot />
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
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.required {
  color: #ff4d4d;
}

.select {
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  padding: 8px 12px;
  color: white;
  color-scheme: dark;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  border-radius: 5px;
  min-width: 100px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
}

.form-group.compact {
  gap: 0.2rem;
}

.form-group.compact label {
  font-size: 11px;
  color: #8c8c9e;
}

.form-group.compact .select {
  padding: 5px 24px 5px 8px;
  font-size: 12px;
  border-radius: 4px;
}

.select:focus {
  border-color: var(--borber-color_main);
  box-shadow: 0 0 0 2px rgba(30, 103, 239, 0.2);
}

.select option {
  background: #252528;
  color: white;
}
</style>