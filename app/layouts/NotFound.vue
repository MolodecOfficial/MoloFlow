<script setup lang="ts">
import {computed} from 'vue'

const props = defineProps<{
  windowId?: string
  groupId?: string
  subGroupId?: string
}>()

// Формируем предполагаемые имена файлов для отладки
const possibleFileNames = computed(() => {
  const names = []

  if (props.groupId && props.windowId) {
    // Полный путь с подгруппой
    if (props.subGroupId) {
      const fullPath = `${props.groupId}_${props.subGroupId}_${props.windowId}`
          .split('_')
          .map((word, index) =>
              index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join('')
      names.push(`../layouts/${fullPath}.vue (camelCase)`)

      const kebabFull = `${props.groupId}-${props.subGroupId}-${props.windowId}`
      names.push(`../layouts/${kebabFull}.vue (kebab-case)`)
    }

    // Без подгруппы
    const withoutSubGroup = `${props.groupId}_${props.windowId}`
        .split('_')
        .map((word, index) =>
            index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('')
    names.push(`../layouts/${withoutSubGroup}.vue (camelCase)`)

    const kebabWithout = `${props.groupId}-${props.windowId}`
    names.push(`../layouts/${kebabWithout}.vue (kebab-case)`)
  }

  // Только по windowId
  if (props.windowId) {
    names.push(`../layouts/${props.windowId}.vue`)
    names.push(`../layouts/${props.windowId}.vue (camelCase/kebab-case)`)
  }

  return names
})

// Информация о текущем слое
const layerInfo = computed(() => {
  const layers = []
  if (props.groupId) layers.push(`группа: ${props.groupId}`)
  if (props.subGroupId) layers.push(`подгруппа: ${props.subGroupId}`)
  if (props.windowId) layers.push(`окно: ${props.windowId}`)

  return {
    full: layers.join(' → ') || 'нет данных',
    count: layers.length,
    structure: {
      group: props.groupId || null,
      subGroup: props.subGroupId || null,
      window: props.windowId || null
    }
  }
})

// Информация для отладки
const debugInfo = computed(() => ({
  windowId: props.windowId || 'не указан',
  groupId: props.groupId || 'не указан',
  subGroupId: props.subGroupId || 'не указан',
  timestamp: new Date().toLocaleTimeString(),
  userAgent: navigator.userAgent
}))
</script>

<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <h2 class="error-title">Ошибка загрузки компонента</h2>
      <hr>
      <section class="main-info">
        <!-- Информационное сообщение -->
        <div class="error-message">
          <p class="error-message-text">Не удалось загрузить компонент для окна:</p>

          <!-- Текущий слой -->
          <div class="layer-info">
            <span class="layer-label">Текущий слой:</span>
            <span class="layer-path">{{ layerInfo.full }}</span>
          </div>

          <div class="params-display">
            <div class="param-row">
              <span class="param-label">Группа:</span>
              <span class="param-value" :class="{ 'missing': !groupId }">{{ groupId || 'не указана' }}</span>
            </div>
            <hr v-if="subGroupId">
            <div class="param-row" v-if="subGroupId">
              <span class="param-label">Подгруппа:</span>
              <span class="param-value">{{ subGroupId }}</span>
            </div>
            <hr>
            <div class="param-row">
              <span class="param-label">Окно:</span>
              <span class="param-value" :class="{ 'missing': !windowId }">{{ windowId || 'не указано' }}</span>
            </div>
          </div>
        </div>

        <!-- Предполагаемые имена файлов -->
        <div class="debug-section">
          <h4 class="section-title">Поиск выполнялся по именам:</h4>
          <ul class="file-list">
            <li v-for="fileName in possibleFileNames" :key="fileName" class="file-list-item">
              <code class="file-name">{{ fileName }}</code>
            </li>
          </ul>
        </div>
      </section>

      <section class="bonus-info">
        <!-- Рекомендации -->
        <div class="recommendations">
          <h3 class="section-title">Рекомендации по устранению:</h3>
          <ul class="recommendations-list">
            <li>Проверьте наличие файла в директории <code>layouts/</code></li>
            <li>Сверьте имя файла с конфигурацией в menuConfig</li>
            <li>Убедитесь в правильности регистра символов</li>
            <li>Проверьте компонент на наличие синтаксических ошибок</li>
            <li>Используйте одно из предложенных выше имен файла</li>
          </ul>
        </div>

        <!-- Техническая информация -->
        <details class="technical-details">
          <summary class="technical-summary">Техническая информация (Нажми на меня)</summary>
          <div class="technical-content">
            <pre class="debug-pre">{{ JSON.stringify(debugInfo, null, 2) }}</pre>
          </div>
        </details>
      </section>
    </div>
  </div>
</template>

<style scoped>
.not-found-container {
  display: flex;
  align-items: flex-start;
  width: 100%;
  height: 100%;
  overflow: inherit;
  box-sizing: border-box;
}

.not-found-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: hidden;
}

.main-info {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  min-height: 200px;
}

.error-message {
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  padding: 10px 15px;
  width: 80%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.layer-info {
  color: rgba(255, 255, 255, 0.65);
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px;
  margin-bottom: 15px;
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.2);
  border-radius: 4px;
  font-size: 0.95rem;
}

.layer-label {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.3px;
}

.layer-path {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 500;
}

.params-display {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 0.95rem;
  margin-bottom: 15px;
}

.param-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.param-label {
  font-weight: 500;
  min-width: 80px;
  font-size: 0.9rem;
  letter-spacing: 0.3px;
}

.param-value {
  font-weight: 500;
  word-break: break-all;
  padding: 2px 8px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  font-size: 0.95rem;
}

.param-value.missing {
  color: #868e96;
  background: var(--half_opacity_bg);
  font-style: italic;
}

.bonus-info {
  display: flex;
  width: 100%;
  height: 290px;
  gap: 20px;
  justify-content: space-between;
}

.debug-section {
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  width: 50%;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.file-list {
  list-style: none;
  margin: 0;
  font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.file-list-item {
  padding: 8px 12px;
  background: var(--half_opacity_bg);
  border-radius: 4px;
  border-left: 2px solid transparent;
  transition: all 0.2s ease;
}

.file-list-item:hover {
  background: rgba(58, 58, 58, 0.15);
  border-left-color: var(--half_opacity_border_hover);

}

.file-name {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.9rem;
}

.recommendations {
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  width: 50%;
  padding: 20px;
}

.recommendations-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  font-size: 0.95rem;
}

.recommendations-list li {
  margin-bottom: 8px;
}

.recommendations-list code {
  background: var(--half_opacity_bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.65);
}

.technical-details {
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  overflow: hidden;
  width: 100%;
}

.technical-summary {
  padding: 16px 20px;
  background: var(--half_opacity_bg);
  cursor: pointer;
  font-weight: 500;
  list-style: none;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  transition: background 0.2s;
}


.technical-content {
  padding: 20px;
  background: var(--half_opacity_bg);
  border-top: 1px solid var(--half_opacity_border);
}

.debug-pre {
  border-radius: 10px;
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  margin: 0 0 20px 0;
  overflow-x: auto;
  font-size: 0.85rem;
  line-height: 1.6;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.debug-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.debug-btn {
  padding: 8px 16px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: #ffffff;
  color: #495057;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 400;
  transition: all 0.2s;
}

.debug-btn:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.debug-btn.primary {
  background: #228be6;
  color: #ffffff;
  border-color: #1c7ed6;
}

.debug-btn.primary:hover {
  background: #1c7ed6;
}

</style>