<script setup lang="ts">
defineProps<{
  label?: string
  tLabel: string
  lRequired?: boolean
  type?: string
  id?: string
  modelValue?: string
  iRequired?: boolean
  placeholder?: string
  maxLength?: string
  readonly?: any
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
    <input
        :type="type || 'text'"
        :id="id || label"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value); $emit('input', $event)"
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
  margin-left: 2px;
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
</style>