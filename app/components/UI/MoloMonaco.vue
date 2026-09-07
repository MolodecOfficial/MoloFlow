<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, shallowRef } from 'vue'
import { initMonaco, buildEditorFiles, getMonacoLanguage } from '~~/app/composables/monaco/index'
import type { FileNode } from '~~/app/composables/monaco/filesystem'
import MonacoMenu from '../monaco/Menu.vue'
import type { InsertPayload } from '../monaco/Menu.vue'

// Пропсы
const props = defineProps<{
  initialCode?: string
  language?: string
  files?: FileNode[]
  moduleId?: string | null
  enterpriseId?: string
  onSave?: () => void
}>()

const emit = defineEmits<{
  (e: 'update:code', code: string): void
}>()

// Состояние редактора
const editorContainer = ref<HTMLElement | null>(null)
let editorInstance: any = null
let monacoInstance: any = null
let monacoCtx: any = null

// Состояние меню
const isMenuOpen = ref(false)
const menuPosition = ref({ x: 0, y: 0 })
const menuFiles = shallowRef<FileNode[]>([])

// Инициализация
onMounted(async () => {
  await nextTick()
  if (!editorContainer.value) return

  const files = props.files || []
  const { ctx } = initMonaco(editorContainer.value, {
    language: props.language || 'typescript',
    moduleId: props.moduleId || undefined,
    enterpriseId: props.enterpriseId,
    files,
    onSave: props.onSave
  })

  editorInstance = ctx.editor
  monacoInstance = ctx.monaco
  monacoCtx = ctx

  if (props.initialCode) {
    editorInstance.setValue(props.initialCode)
  }

  editorInstance.onDidChangeModelContent(() => {
    const code = editorInstance.getValue()
    emit('update:code', code)
  })

  // Ctrl+Space открывает меню компонентов/композаблов
  editorInstance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Space, () => {
    openMenuAtCursor()
  })

  setTimeout(() => {
    editorInstance.layout()
  }, 100)

  menuFiles.value = files
})

// Открытие меню в позиции курсора
function openMenuAtCursor() {
  if (!editorInstance || !editorContainer.value) return

  const position = editorInstance.getPosition()
  if (!position) return

  const editorDomNode = editorContainer.value
  const editorRect = editorDomNode.getBoundingClientRect()

  const cursorCoords = editorInstance.getScrolledVisiblePosition(position)
  if (!cursorCoords) return

  const lineHeight = editorInstance.getOption(monacoInstance.editor.EditorOption.lineHeight)
  const x = editorRect.left + cursorCoords.left
  const y = editorRect.top + cursorCoords.top + lineHeight

  menuPosition.value = { x, y }
  menuFiles.value = props.files || []
  isMenuOpen.value = true
}

// Открытие меню по кнопке (в позиции кнопки)
function openMenuFromButton(event: MouseEvent) {
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()

  menuPosition.value = {
    x: rect.left,
    y: rect.bottom + 4
  }
  menuFiles.value = props.files || []
  isMenuOpen.value = true
}


// Находим строку, после которой стоит вставлять новый import
// (сразу после последнего существующего import-блока в начале файла)
function findImportInsertLine(model: any): number {
  const lineCount = model.getLineCount()
  let lastImportLine = 0

  for (let i = 1; i <= lineCount; i++) {
    const lineContent = model.getLineContent(i)
    if (/^\s*import\s.+from\s+['"]/.test(lineContent)) {
      lastImportLine = i
      continue
    }
    if (lineContent.trim() === '' && lastImportLine > 0) {
      continue
    }
    if (lastImportLine > 0) {
      break
    }
  }

  return lastImportLine > 0 ? lastImportLine + 1 : 1
}

// Вставка кода из меню: import (если его ещё нет) + сниппет использования на месте курсора
function insertCode(payload: InsertPayload) {
  if (!editorInstance || !monacoInstance) return

  const model = editorInstance.getModel()
  const position = editorInstance.getPosition()
  if (!model || !position) return

  const edits: any[] = []
  const fullText = model.getValue()

  if (payload.importStatement && !fullText.includes(payload.importStatement)) {
    const insertLine = findImportInsertLine(model)
    edits.push({
      range: new monacoInstance.Range(insertLine, 1, insertLine, 1),
      text: payload.importStatement + '\n'
    })
  }

  edits.push({
    range: new monacoInstance.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
    ),
    text: payload.snippet
  })

  editorInstance.executeEdits('insert-code', edits)
  editorInstance.focus()

  isMenuOpen.value = false
}

// Закрытие меню
function closeMenu() {
  isMenuOpen.value = false
}

// Уничтожение
onUnmounted(() => {
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
  }
  monacoCtx = null
  monacoInstance = null
})

// Обновление при изменении пропсов
watch(() => props.initialCode, (newCode) => {
  if (editorInstance && newCode !== undefined) {
    const current = editorInstance.getValue()
    if (current !== newCode) {
      editorInstance.setValue(newCode)
    }
  }
})

watch(() => props.files, (newFiles) => {
  if (monacoCtx && props.files) {
    monacoCtx.fs.loadFiles(props.files)
    monacoCtx.vfs.loadModuleFiles({
      code: props.initialCode || '',
      files: props.files
    })
    monacoCtx.refreshTypes(props.files)
    menuFiles.value = props.files
  }
}, { deep: true })

watch(() => props.language, (newLang) => {
  if (editorInstance && monacoInstance) {
    const model = editorInstance.getModel()
    if (model) {
      monacoInstance.editor.setModelLanguage(model, newLang)
    }
  }
})

// Expose методы для родителя
defineExpose({
  getValue: () => editorInstance?.getValue() || '',
  setValue: (code: string) => {
    if (editorInstance) {
      editorInstance.setValue(code)
    }
  },
  layout: () => {
    if (editorInstance) {
      editorInstance.layout()
    }
  },
  getEditor: () => editorInstance,
  getMonaco: () => monacoInstance,
  getContext: () => monacoCtx,
  openMenu: openMenuAtCursor,
  closeMenu
})
</script>

<template>
  <div class="monaco-wrapper">
    <!-- Контейнер для редактора -->
    <div ref="editorContainer" class="monaco-container"></div>

    <!-- Плавающая кнопка для вызова меню -->
    <UIMoloButton
        class="monaco-menu-button action"
        @click="openMenuFromButton"
        title="Вставить компонент или композабл (Ctrl+Space)"
    >
      <span class="button-icon">📦</span>
      <span class="button-text">Инструменты</span>
    </UIMoloButton>

    <!-- Меню -->
    <Teleport to="body">
      <MonacoMenu
          v-if="isMenuOpen"
          :files="menuFiles"
          :position="menuPosition"
          :on-insert="insertCode"
          :on-close="closeMenu"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.monaco-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #1a1b26;
  position: relative;
}

.monaco-container {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.monaco-menu-button {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  color: #abb2bf;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.monaco-menu-button:active {
  transform: translateY(0px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.button-icon {
  font-size: 16px;
  line-height: 1;
}

.button-text {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

@media (max-width: 768px) {
  .monaco-menu-button {
    top: 8px;
    right: 8px;
    padding: 4px 10px;
    font-size: 12px;
  }

  .button-text {
    display: none;
  }

  .button-icon {
    font-size: 20px;
  }

  .monaco-menu-button {
    width: 40px;
    height: 40px;
    justify-content: center;
  }
}
</style>