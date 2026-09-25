<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import pdfIcon from '~~/app/assets/icons/pdf.svg'
const props = defineProps<{
  modelValue?: string | Blob | File
  fileName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: any]
}>()

const zoom = ref(100)
const stampType = ref<'paid' | 'approved' | null>(null)
const objectUrl = ref<string | null>(null)

// Функция надежной конвертации Base64 в Blob URL
function base64ToBlobUrl(base64: string): string {
  try {
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64
    const byteCharacters = atob(cleanBase64 || '')
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/pdf' })
    return URL.createObjectURL(blob)
  } catch (e) {
    console.error('Ошибка декодирования PDF:', e)
    return ''
  }
}

const pdfSrc = computed(() => {
  if (!props.modelValue) return ''

  if (typeof props.modelValue === 'string') {
    if (props.modelValue.startsWith('http') || props.modelValue.startsWith('blob:')) {
      return props.modelValue
    }
    // Конвертируем Base64 в Blob URL
    return base64ToBlobUrl(props.modelValue)
  }

  if (props.modelValue instanceof Blob) {
    return URL.createObjectURL(props.modelValue)
  }

  return ''
})

watch(pdfSrc, (newUrl, oldUrl) => {
  if (oldUrl && oldUrl.startsWith('blob:')) {
    URL.revokeObjectURL(oldUrl)
  }
  objectUrl.value = newUrl
}, { immediate: true })

onBeforeUnmount(() => {
  if (objectUrl.value && objectUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(objectUrl.value)
  }
})

function triggerUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/pdf'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      emit('update:modelValue', reader.result as string)
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function zoomIn() {
  if (zoom.value < 200) zoom.value += 15
}

function zoomOut() {
  if (zoom.value > 50) zoom.value -= 15
}

function resetZoom() {
  zoom.value = 100
}

function downloadPdf() {
  if (!pdfSrc.value) return
  const a = document.createElement('a')
  a.href = pdfSrc.value
  a.download = props.fileName ? (props.fileName.endsWith('.pdf') ? props.fileName : `${props.fileName}.pdf`) : 'document.pdf'
  a.click()
}

function printPdf() {
  const iframe = document.querySelector('.pdf-frame') as HTMLIFrameElement
  if (iframe?.contentWindow) {
    iframe.contentWindow.print()
  } else {
    window.print()
  }
}
</script>

<template>
  <div class="molo-pdf-viewer">
    <!-- Тулбар просмотрщика -->
    <header class="pdf-toolbar no-print">
      <div class="toolbar-left">
        <span class="toolbar-badge">PDF РИДЕР</span>
        <span class="file-name" :title="fileName">{{ fileName || 'Документ PDF' }}</span>
      </div>

      <div class="toolbar-center">
        <button class="tool-btn" title="Отдалить" @click="zoomOut">➖</button>
        <span class="zoom-val" @click="resetZoom">{{ zoom }}%</span>
        <button class="tool-btn" title="Приблизить" @click="zoomIn">➕</button>
      </div>

      <div class="btn-group">
        <UIMoloButton class="small" @click="downloadPdf">
          <img :src="pdfIcon" alt="" style="width: 14px;">
        </UIMoloButton>
        <UIMoloButton class="confirm small" @click="printPdf">Печать</UIMoloButton>
      </div>
    </header>

    <!-- Основная область с PDF и наложением штампов -->
    <div class="pdf-container">
      <div
          v-if="pdfSrc"
          class="pdf-wrapper"
          :style="{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }"
      >
        <!-- Интерактивный штамп -->
        <div v-if="stampType" class="document-stamp" :class="stampType">
          <div class="stamp-inner">
            <span class="stamp-org">ООО «МОЛОФЛОУ»</span>
            <span class="stamp-status">{{ stampType === 'paid' ? 'ОПЛАЧЕНО' : 'СОГЛАСОВАНО' }}</span>
            <span class="stamp-date">{{ new Date().toLocaleDateString('ru-RU') }}</span>
          </div>
        </div>

        <iframe
            :src="`${pdfSrc}#toolbar=0&navpanes=0`"
            class="pdf-frame"
            type="application/pdf"
        />
      </div>

      <div v-else class="pdf-empty">
        <div class="empty-icon">📄</div>
        <h3>PDF-файл не загружен</h3>
        <p>Выберите файл с компьютера или перетащите его в рабочую область</p>
        <UIMoloButton class="confirm small" @click="triggerUpload">Выбрать PDF-файл</UIMoloButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.molo-pdf-viewer {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #141419;
  color: #fff;
  overflow: hidden;
  position: relative;
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--half_opacity_bg, #1a1a22);
  border-bottom: 1px solid var(--half_opacity_border, #2a2a38);
  flex-shrink: 0;
  z-index: 10;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-badge {
  background: #dc2626;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.file-name {
  font-size: 13px;
  color: #d1d1e0;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid var(--half_opacity_border, #2a2a38);
}

.tool-btn {
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 12px;
}

.tool-btn:hover {
  color: #fff;
}

.zoom-val {
  font-size: 12px;
  cursor: pointer;
  min-width: 45px;
  text-align: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pdf-container {
  flex: 1;
  background: #0d0d12;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: 20px;
  position: relative;
}

.pdf-wrapper {
  width: 100%;
  max-width: 900px;
  height: 100%;
  min-height: 800px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  position: relative;
  transition: transform 0.15s ease-out;
}

.pdf-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.pdf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6a6a7a;
  height: 100%;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.4;
}

.document-stamp {
  position: absolute;
  top: 40px;
  right: 40px;
  z-index: 50;
  border: 3px double #dc2626;
  color: #dc2626;
  border-radius: 8px;
  padding: 8px 16px;
  text-transform: uppercase;
  transform: rotate(-12deg);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 10px rgba(220, 38, 38, 0.2);
  pointer-events: none;
  user-select: none;
}

.stamp-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-family: 'Courier New', monospace;
}

.stamp-org {
  font-size: 9px;
  letter-spacing: 1px;
}

.stamp-status {
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 2px;
}

.stamp-date {
  font-size: 9px;
}

.document-stamp.approved {
  border-color: #16a34a;
  color: #16a34a;
}
</style>