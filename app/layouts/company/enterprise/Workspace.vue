<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import excelIcon from '~~/app/assets/icons/excel.svg'
import wordIcon from '~~/app/assets/icons/word.svg'
import primaryIcon from '~~/app/assets/icons/forms.svg'
import pdfIcon from '~~/app/assets/icons/pdf.svg'
import imageIcon from '~~/app/assets/icons/image.svg'
import { useDirectoryInterpolator, type DirectoryLookupItem } from '~/composables/useDirectoryInterpolator'
import DirectoryResolutionModal from '~/components/directory/DirectoryResolutionModal.vue'
import { useWorkspaceStore, type DocType, type DocData, type SpaceFolder, type SpaceDocument, type DocVersionMeta } from '~~/stores/workspaceStore'
import MoloSticker from '~/components/ui/MoloSticker.vue'
import mammoth from 'mammoth'

const props = defineProps<{
  enterpriseId?: string
  windowId?: string
  windowData?: Record<string, any>
  moduleData?: Record<string, any>
  uniqueWindowId?: string
}>()

const emit = defineEmits(['close'])

const DOC_ICONS: Record<DocType, string> = {
  excel: excelIcon,
  word: wordIcon,
  pdf: pdfIcon,
  primary: primaryIcon,
  image: imageIcon
}

const workspaceStore = useWorkspaceStore()
const {
  folders,
  documents,
  activeFolderId,
  openIds,
  activeId,
  activeDocument,
  openDocuments,
  saveState,
  lastSavedAt,
  isLoading,
  loadError
} = storeToRefs(workspaceStore)

const { resolveVariable } = useDirectoryInterpolator()
const { addNotification } = useNotifications('Пространство')
const { addLog } = useLogger('Пространство')

type TreeItem =
    | { kind: 'folder'; folder: SpaceFolder; depth: number; hasChildren: boolean; isExpanded: boolean }
    | { kind: 'file'; doc: SpaceDocument; depth: number }

const workspaceRoot = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const expandedFolderIds = ref<Set<string>>(new Set())
const searchQuery = ref('')
const sidebarListMode = ref<'folder' | 'all'>('folder')

const resolutionModalOpen = ref(false)
const candidateList = ref<DirectoryLookupItem[]>()
const pendingVariableCallback = ref<((resolved: string) => void) | null>(null)

const createMenuOpen = ref(false)
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renamingFolderId = ref<string | null>(null)
const folderRenameValue = ref('')
const pendingDelete = ref<{ kind: 'doc' | 'folder'; id: string } | null>(null)
const isModalOpen = ref(false)

/* ── Состояние панели версий ── */
const isVersionPanelOpen = ref(false)
const versions = ref<DocVersionMeta[]>([])
const versionsLoading = ref(false)
const pendingRestore = ref<DocVersionMeta | null>(null)
const isRestoreModalOpen = ref(false)

/* ── Drag and Drop состояние ── */
const dragOverFolderId = ref<string | null>(null)
const isRootDragOver = ref(false)
const draggedDocId = ref<string | null>(null)

let isOpeningRename = false

const deleteModalTitle = computed(() =>
    pendingDelete.value?.kind === 'folder' ? 'Удалить папку?' : 'Удалить документ?'
)
const deleteModalText = computed(() =>
    pendingDelete.value?.kind === 'folder'
        ? 'Папка будет удалена, а документы и подпапки внутри неё переместятся на уровень выше.'
        : 'Вы действительно хотите удалить документ? Это действие необратимо.'
)

const saveStatusText = computed(() => {
  if (saveState.value === 'saving') return 'Сохранение…'
  if (saveState.value === 'error') return 'Не удалось сохранить'
  if (saveState.value === 'saved' && lastSavedAt.value) {
    return 'Сохранено в ' + new Date(lastSavedAt.value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return ''
})

const vFocus = {
  mounted: (el: HTMLInputElement) => {
    nextTick(() => {
      el.focus()
      el.select()
    })
  }
}

async function handleTextInterpolation(rawExpression: string): Promise<string> {
  const result = await resolveVariable(rawExpression)
  if (result.directValue) return result.directValue

  if (result.candidates && result.candidates.length > 0) {
    candidateList.value = result.candidates
    resolutionModalOpen.value = true

    return new Promise((resolve) => {
      pendingVariableCallback.value = (resolvedName: string) => {
        resolve(resolvedName)
      }
    })
  }
  return rawExpression
}

function handleCandidateSelect(item: DirectoryLookupItem) {
  if (pendingVariableCallback.value) {
    pendingVariableCallback.value(item.title)
    pendingVariableCallback.value = null
  }
}

/* ───────────────────────── Дерево папок ───────────────────────── */

const folderChildrenMap = computed(() => {
  const map = new Map<string | null, SpaceFolder[]>()
  for (const f of folders.value) {
    const p = f.parentId ?? null
    const list = map.get(p) ?? []
    list.push(f)
    map.set(p, list)
  }
  return map
})

const folderDocumentsMap = computed(() => {
  const map = new Map<string | null, SpaceDocument[]>()
  for (const d of documents.value) {
    const f = d.folderId ?? null
    const list = map.get(f) ?? []
    list.push(d)
    map.set(f, list)
  }
  return map
})

const explorerTree = computed<TreeItem[]>(() => {
  const items: TreeItem[] = []

  function traverse(parentId: string | null, depth: number) {
    const subFolders = folderChildrenMap.value.get(parentId) || []
    const subDocs = folderDocumentsMap.value.get(parentId) || []

    for (const folder of subFolders) {
      const hasChildren = (folderChildrenMap.value.get(folder.id)?.length || 0) > 0 ||
          (folderDocumentsMap.value.get(folder.id)?.length || 0) > 0
      const isExpanded = expandedFolderIds.value.has(folder.id)

      items.push({
        kind: 'folder',
        folder,
        depth,
        hasChildren,
        isExpanded
      })

      if (isExpanded) {
        traverse(folder.id, depth + 1)
      }
    }

    if (parentId !== null) {
      for (const doc of subDocs) {
        items.push({ kind: 'file', doc, depth })
      }
    }
  }

  traverse(null, 0)
  return items
})

function toggleFolderExpand(folderId: string) {
  const next = new Set(expandedFolderIds.value)
  if (next.has(folderId)) {
    next.delete(folderId)
  } else {
    next.add(folderId)
  }
  expandedFolderIds.value = next
}

function handleFolderClick(folderId: string | null) {
  activeFolderId.value = folderId
  sidebarListMode.value = folderId === null ? 'all' : 'folder'
  if (folderId) {
    expandedFolderIds.value.add(folderId)
  }
}

/* ───────────────────────── Drag-and-Drop ───────────────────────── */

function onDocDragStart(e: DragEvent, docId: string) {
  draggedDocId.value = docId
  e.dataTransfer?.setData('text/plain', docId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onFolderDragOver(e: DragEvent, folderId: string | null) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (folderId === null) {
    isRootDragOver.value = true
  } else {
    dragOverFolderId.value = folderId
  }
}

function onFolderDragLeave() {
  dragOverFolderId.value = null
  isRootDragOver.value = false
}

async function onFolderDrop(e: DragEvent, targetFolderId: string | null) {
  e.preventDefault()
  dragOverFolderId.value = null
  isRootDragOver.value = false

  if (draggedDocId.value) {
    const docId = draggedDocId.value
    draggedDocId.value = null
    const doc = documents.value.find(d => d.id === docId)
    if (!doc || doc.folderId === targetFolderId) return

    try {
      await $fetch(`/api/workspace/documents/${docId}`, {
        method: 'PATCH',
        query: { enterpriseId: props.enterpriseId },
        body: { folderId: targetFolderId }
      })
      doc.folderId = targetFolderId
      addNotification('success', 'Документ перемещён')
    } catch {
      addNotification('error', 'Не удалось переместить документ')
    }
    return
  }

  if (e.dataTransfer?.files?.length) {
    await handleExternalFilesDrop(e.dataTransfer.files, targetFolderId)
  }
}

async function handleExternalFilesDrop(fileList: FileList, folderId: string | null) {
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]!
    const name = file.name
    const lower = name.toLowerCase()
    let docType: DocType = 'word'

    if (lower.endsWith('.pdf')) {
      docType = 'pdf'
    } else if (/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(lower)) {
      docType = 'image'
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
      docType = 'excel'
    }

    try {
      let documentContent = ''
      if (docType === 'pdf' || docType === 'image') {
        documentContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      } else if (name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer()
        const options = {
          styleMap: ['u => u'],
          convertImage: (mammoth as any).images?.imgElement((image: any) => {
            return image.read('base64').then((imageBuffer: string) => ({
              src: `data:${image.contentType};base64,${imageBuffer}`
            }))
          })
        }
        const result = await mammoth.convertToHtml({ arrayBuffer }, options as any)
        documentContent = result.value || '<p></p>'
      } else {
        documentContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsText(file)
        })
      }

      const meta = await $fetch<any>('/api/workspace/documents', {
        method: 'POST',
        query: { enterpriseId: props.enterpriseId },
        body: {
          type: docType,
          name: name.replace(/\.[^/.]+$/, ''),
          folderId,
          data: documentContent
        }
      })

      const clientDoc: SpaceDocument = {
        ...meta,
        data: documentContent,
        loadState: 'loaded'
      }

      documents.value = [clientDoc, ...documents.value]
      workspaceStore.openDoc(clientDoc.id)
      addNotification('success', `Файл «${file.name}» загружен`)
    } catch {
      addLog('error', `Не удалось обработать «${file.name}»`)
    }
  }
}

/* ───────────────────────── Фильтрация и поиск ───────────────────────── */

const filteredBottomDocuments = computed(() => {
  let list = documents.value

  if (sidebarListMode.value === 'folder' && activeFolderId.value) {
    list = list.filter(d => d.folderId === activeFolderId.value)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(d => d.name.toLowerCase().includes(q))
  }

  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
})

const currentFolderName = computed(() => {
  if (!activeFolderId.value) return 'Все документы'
  return folders.value.find(f => f.id === activeFolderId.value)?.name || 'Выбранная папка'
})

/* ───────────────────────── Версионирование ───────────────────────── */

async function loadVersions(docId: string) {
  versionsLoading.value = true
  try {
    versions.value = await $fetch<DocVersionMeta[]>(`/api/workspace/documents/${docId}/versions`, {
      query: { enterpriseId: props.enterpriseId }
    })
  } catch {
    addNotification('error', 'Не удалось загрузить историю версий')
  } finally {
    versionsLoading.value = false
  }
}

async function toggleVersionPanel() {
  if (!activeId.value) return
  isVersionPanelOpen.value = !isVersionPanelOpen.value
  if (isVersionPanelOpen.value) {
    await loadVersions(activeId.value)
  }
}

async function createManualSnapshot() {
  if (!activeId.value) return
  const comment = prompt('Укажите комментарий к снимку:', 'Контрольная точка')?.trim()
  if (!comment) return

  await workspaceStore.flushAll()
  try {
    const version = await $fetch<DocVersionMeta>(`/api/workspace/documents/${activeId.value}/versions`, {
      method: 'POST',
      query: { enterpriseId: props.enterpriseId },
      body: { comment }
    })
    versions.value = [version, ...versions.value]
    addNotification('success', 'Снимок успешно сохранён')
  } catch {
    addNotification('error', 'Не удалось сохранить версию')
  }
}

function requestRestoreVersion(ver: DocVersionMeta) {
  pendingRestore.value = ver
  isRestoreModalOpen.value = true
}

async function confirmRestoreVersion() {
  const ver = pendingRestore.value
  const docId = activeId.value
  isRestoreModalOpen.value = false
  pendingRestore.value = null

  if (!ver || !docId) return

  await workspaceStore.flushAll()
  try {
    const res = await $fetch<any>(`/api/workspace/documents/${docId}/versions/${ver.id}/restore`, {
      method: 'POST',
      query: { enterpriseId: props.enterpriseId }
    })
    const doc = documents.value.find(d => d.id === docId)
    if (doc) {
      doc.data = res.data
      doc.updatedAt = res.updatedAt
      doc.loadState = 'loaded'
    }
    await loadVersions(docId)
    addNotification('success', 'Версия успешно восстановлена')
  } catch {
    addNotification('error', 'Не удалось восстановить версию')
  }
}

/* ───────────────────────── Управление папками ───────────────────────── */

async function createFolder() {
  const name = prompt('Введите название папки:')?.trim()
  if (!name) return
  try {
    const folder = await $fetch<SpaceFolder>('/api/workspace/folders', {
      method: 'POST',
      query: { enterpriseId: props.enterpriseId },
      body: { name, parentId: activeFolderId.value }
    })
    folders.value.push(folder)
    if (activeFolderId.value) {
      expandedFolderIds.value.add(activeFolderId.value)
    }
    addNotification('success', 'Папка создана')
  } catch {
    addNotification('error', 'Не удалось создать папку')
  }
}

function startFolderRename(folder: SpaceFolder) {
  renamingFolderId.value = folder.id
  folderRenameValue.value = folder.name
}

async function confirmFolderRename() {
  const id = renamingFolderId.value
  if (!id) return
  renamingFolderId.value = null
  const name = folderRenameValue.value.trim()
  const folder = folders.value.find(f => f.id === id)
  if (!name || !folder || folder.name === name) return

  const prev = folder.name
  folder.name = name
  try {
    await $fetch(`/api/workspace/folders/${id}`, {
      method: 'PATCH',
      query: { enterpriseId: props.enterpriseId },
      body: { name }
    })
  } catch {
    folder.name = prev
    addNotification('error', 'Не удалось переименовать папку')
  }
}

function cancelFolderRename() {
  renamingFolderId.value = null
  folderRenameValue.value = ''
}

function requestRemoveFolder(id: string) {
  pendingDelete.value = { kind: 'folder', id }
  isModalOpen.value = true
}

async function removeFolder(id: string) {
  const folder = folders.value.find(f => f.id === id)
  if (!folder) return
  try {
    await $fetch(`/api/workspace/folders/${id}`, {
      method: 'DELETE',
      query: { enterpriseId: props.enterpriseId }
    })
  } catch {
    addNotification('error', 'Не удалось удалить папку')
    return
  }
  const parent = folder.parentId
  folders.value = folders.value
      .filter(f => f.id !== id)
      .map(f => (f.parentId === id ? { ...f, parentId: parent } : f))
  documents.value = documents.value.map(d => (d.folderId === id ? { ...d, folderId: parent } : d))
  if (activeFolderId.value === id) activeFolderId.value = parent
  expandedFolderIds.value.delete(id)
  addNotification('success', 'Папка удалена')
}

/* ───────────────────────── Управление документами ───────────────────────── */

function toggleFullscreen() {
  if (!workspaceRoot.value) return
  if (!document.fullscreenElement) {
    workspaceRoot.value.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(err => {
      console.error('Ошибка входа в полноэкранный режим', err)
    })
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    })
  }
}

async function createDocument(type: DocType) {
  createMenuOpen.value = false

  if (type === 'pdf' || type === 'image') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = type === 'pdf' ? 'application/pdf' : 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (file) await handleExternalFilesDrop([file] as unknown as FileList, activeFolderId.value)
    }
    input.click()
    return
  }

  try {
    const meta = await $fetch<any>('/api/workspace/documents', {
      method: 'POST',
      query: { enterpriseId: props.enterpriseId },
      body: {
        type,
        name: type === 'excel' ? 'Новая таблица' : (type === 'primary' ? 'Новая накладная' : 'Новый документ'),
        folderId: activeFolderId.value,
        data: type === 'word' ? '' : {}
      }
    })

    const doc: SpaceDocument = {
      ...meta,
      data: type === 'word' ? '' : {},
      loadState: 'loaded'
    }

    documents.value = [doc, ...documents.value]
    if (activeFolderId.value) {
      expandedFolderIds.value.add(activeFolderId.value)
    }
    workspaceStore.openDoc(doc.id)
    addLog('info', 'Создан новый документ')
  } catch {
    addNotification('error', 'Не удалось создать документ')
  }
}

function closeTab(id: string) {
  workspaceStore.closeDoc(id)
}

function requestRemove(id: string) {
  pendingDelete.value = { kind: 'doc', id }
  isModalOpen.value = true
}

async function removeDocument(id: string) {
  try {
    await $fetch(`/api/workspace/documents/${id}`, {
      method: 'DELETE',
      query: { enterpriseId: props.enterpriseId }
    })
  } catch {
    addNotification('error', 'Не удалось удалить документ')
    return
  }
  documents.value = documents.value.filter(d => d.id !== id)
  closeTab(id)
  addNotification('success', 'Документ удалён')
}

async function confirmRemove() {
  const target = pendingDelete.value
  isModalOpen.value = false
  pendingDelete.value = null
  if (!target) return
  if (target.kind === 'folder') await removeFolder(target.id)
  else await removeDocument(target.id)
}

function cancelRemove() {
  pendingDelete.value = null
  isModalOpen.value = false
}

function startRename(docOrId: SpaceDocument | string) {
  const id = typeof docOrId === 'string' ? docOrId : docOrId.id
  const doc = documents.value.find(d => d.id === id)
  if (!doc) return

  isOpeningRename = true
  renamingId.value = doc.id
  renameValue.value = doc.name

  setTimeout(() => {
    isOpeningRename = false
  }, 150)
}

function handleInputBlur() {
  if (isOpeningRename) return
  void confirmRename()
}

async function confirmRename() {
  const id = renamingId.value
  if (!id) return
  renamingId.value = null
  const name = renameValue.value.trim()
  const doc = documents.value.find(d => d.id === id)
  if (!name || !doc || doc.name === name) return

  const prev = doc.name
  doc.name = name
  doc.updatedAt = Date.now()
  try {
    await $fetch(`/api/workspace/documents/${id}`, {
      method: 'PATCH',
      query: { enterpriseId: props.enterpriseId },
      body: { name }
    })
  } catch {
    doc.name = prev
    addNotification('error', 'Не удалось переименовать документ')
  }
}

function cancelRename() {
  renamingId.value = null
  renameValue.value = ''
}

function updateDocData(id: string, data: DocData) {
  workspaceStore.updateDocData(id, data)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 Б'
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
}

function docIcon(type: DocType): string {
  return DOC_ICONS[type] || excelIcon
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.create-menu-wrap')) {
    createMenuOpen.value = false
  }
}

function onDocumentVariableTrigger(payload: { rawExpression: string; apply: (replacement: string) => void }) {
  handleTextInterpolation(payload.rawExpression).then((resolvedText) => {
    payload.apply(resolvedText)
  })
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  workspaceStore.flushKeepalive()
}

watch(activeId, async (newId) => {
  await nextTick()
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'))
  })
  if (isVersionPanelOpen.value && newId) {
    void loadVersions(newId)
  }
})

watch(() => props.enterpriseId, () => {
  workspaceStore.loadWorkspace(true)
})

onMounted(() => {
  workspaceStore.loadWorkspace()
  window.addEventListener('click', handleClickOutside)
  window.addEventListener('beforeunload', handleBeforeUnload)
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  void workspaceStore.flushAll()
})
</script>

<template>
  <div ref="workspaceRoot" class="workspace" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- Header -->
    <div class="workspace-header">
      <div class="workspace-title">
        <UIMoloInput
            v-model="searchQuery"
            placeholder="Поиск по названию документов..."
        />
      </div>

      <div class="workspace-header-actions">
        <span
            v-if="saveStatusText"
            class="save-status"
            :class="{ error: saveState === 'error' }"
        >{{ saveStatusText }}</span>

        <UIMoloButton
            v-if="activeId"
            class="small icon-action-btn"
            :class="{ confirm: isVersionPanelOpen }"
            title="История версий и точек отката"
            @click="toggleVersionPanel"
        >
          <UIMoloSticker name="history" :size="18" />
        </UIMoloButton>

        <section class="btn-group">
          <UIMoloButton class="small icon-action-btn" title="Создать папку" @click="createFolder">
            <UIMoloSticker name="folder" :size="18" />
          </UIMoloButton>
          <UIMoloButton class="small icon-action-btn" title="На весь экран" @click="toggleFullscreen">
            <UIMoloSticker :name="isFullscreen ? 'fullscreen-exit' : 'fullscreen'" :size="18" />
          </UIMoloButton>
        </section>

        <div class="create-menu-wrap">
          <UIMoloButton class="confirm" @click.stop="createMenuOpen = !createMenuOpen">
            Новый документ
          </UIMoloButton>
          <div v-if="createMenuOpen" class="create-menu">
            <button class="create-menu-item" @click="createDocument('excel')">
              <img class="create-menu-icon" :src="docIcon('excel')" alt="" aria-hidden="true" draggable="false">
              <span>Таблица (Excel)</span>
            </button>
            <button class="create-menu-item" @click="createDocument('word')">
              <img class="create-menu-icon" :src="docIcon('word')" alt="" aria-hidden="true" draggable="false">
              <span>Документ (Word)</span>
            </button>
            <button class="create-menu-item" @click="createDocument('primary')">
              <img class="create-menu-icon" :src="docIcon('primary')" alt="" aria-hidden="true" draggable="false">
              <span>Накладные (ТОРГ)</span>
            </button>
            <button class="create-menu-item" @click="createDocument('pdf')">
              <img class="create-menu-icon" :src="docIcon('pdf')" alt="" aria-hidden="true" draggable="false">
              <span>Документ PDF</span>
            </button>
            <button class="create-menu-item" @click="createDocument('image')">
              <img class="create-menu-icon" :src="docIcon('image')" alt="" aria-hidden="true" draggable="false">
              <span>Изображение</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="workspace-body">
      <!-- Сайдбар Проводника -->
      <aside class="workspace-sidebar">
        <!-- Блок дерева Windows Explorer -->
        <div class="tree-container">
          <div class="explorer-heading">
            <span>Проводник</span>
            <span class="counter">({{ folders.length }} папок)</span>
          </div>

          <div class="folders-tree">
            <!-- Корневой узел "Все документы" -->
            <div
                class="tree-node root-node"
                :class="{
                active: activeFolderId === null,
                'drag-over': isRootDragOver
              }"
                @click="handleFolderClick(null)"
                @dragover="onFolderDragOver($event, null)"
                @dragleave="onFolderDragLeave"
                @drop="onFolderDrop($event, null)"
            >
              <span class="tree-chevron invisible">▾</span>
              <MoloSticker name="folder-open" :size="16" class="tree-icon" />
              <span class="node-title">Все документы</span>
            </div>

            <!-- Иерархические узлы папок и вложенных файлов -->
            <template v-for="(item, idx) in explorerTree" :key="idx">
              <!-- Узел: Папка -->
              <div
                  v-if="item.kind === 'folder'"
                  class="tree-node folder-node"
                  :class="{
                  active: activeFolderId === item.folder.id,
                  'drag-over': dragOverFolderId === item.folder.id
                }"
                  :style="{ paddingLeft: `${item.depth * 14 + 6}px` }"
                  @click="handleFolderClick(item.folder.id)"
                  @dblclick.stop="startFolderRename(item.folder)"
                  @dragover="onFolderDragOver($event, item.folder.id)"
                  @dragleave="onFolderDragLeave"
                  @drop="onFolderDrop($event, item.folder.id)"
              >
                <button
                    type="button"
                    class="tree-chevron"
                    :class="{ invisible: !item.hasChildren, expanded: item.isExpanded }"
                    @click.stop="toggleFolderExpand(item.folder.id)"
                >
                  ▸
                </button>

                <MoloSticker
                    :name="item.isExpanded ? 'folder-open' : 'folder'"
                    :size="16"
                    class="tree-icon"
                />

                <input
                    v-if="renamingFolderId === item.folder.id"
                    v-model="folderRenameValue"
                    v-focus
                    class="rename-input"
                    @click.stop
                    @keydown.enter="confirmFolderRename"
                    @keydown.esc="cancelFolderRename"
                    @blur="confirmFolderRename"
                />

                <template v-else>
                  <span class="node-title">{{ item.folder.name }}</span>
                  <div class="item-actions" @click.stop>
                    <UIMoloButton
                        class="icon-btn"
                        title="Переименовать"
                        @click.stop="startFolderRename(item.folder)"
                    >
                      <MoloSticker name="edit" :size="12" />
                    </UIMoloButton>
                    <UIMoloButton
                        class="icon-btn"
                        title="Удалить папку"
                        @click.stop="requestRemoveFolder(item.folder.id)"
                    >
                      <MoloSticker name="trash" :size="12" />
                    </UIMoloButton>
                  </div>
                </template>
              </div>

              <!-- Узел: Документ прямо в дереве -->
              <div
                  v-else-if="item.kind === 'file'"
                  class="tree-node file-node"
                  :class="{ active: activeId === item.doc.id }"
                  :style="{ paddingLeft: `${item.depth * 14 + 22}px` }"
                  draggable="true"
                  @dragstart="onDocDragStart($event, item.doc.id)"
                  @click="workspaceStore.openDoc(item.doc.id)"
                  @dblclick.stop="startRename(item.doc)"
              >
                <img class="tree-file-icon" :src="docIcon(item.doc.type)" alt="" draggable="false" />

                <input
                    v-if="renamingId === item.doc.id"
                    v-model="renameValue"
                    v-focus
                    class="rename-input"
                    @click.stop
                    @keydown.enter="confirmRename"
                    @keydown.esc="cancelRename"
                    @blur="handleInputBlur"
                />

                <template v-else>
                  <span class="node-title">{{ item.doc.name }}</span>
                  <div class="item-actions" @click.stop>
                    <UIMoloButton
                        class="icon-btn"
                        title="Переименовать"
                        @click.stop="startRename(item.doc)"
                    >
                      <MoloSticker name="edit" :size="12" />
                    </UIMoloButton>
                    <UIMoloButton
                        class="icon-btn"
                        title="Удалить"
                        @click.stop="requestRemove(item.doc.id)"
                    >
                      <MoloSticker name="trash" :size="12" />
                    </UIMoloButton>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>

        <!-- Нижняя панель файлов -->
        <div
            class="bottom-files-section"
            @dragover="onFolderDragOver($event, activeFolderId)"
            @dragleave="onFolderDragLeave"
            @drop="onFolderDrop($event, activeFolderId)"
        >
          <div class="sidebar-heading">
            <div class="heading-controls">
              <span class="heading-title" :title="currentFolderName">
                {{ sidebarListMode === 'folder' ? currentFolderName : 'Все файлы' }}
              </span>
              <span class="counter">({{ filteredBottomDocuments.length }})</span>
            </div>

            <button
                type="button"
                class="mode-toggle-btn"
                :title="sidebarListMode === 'folder' ? 'Показать все файлы' : 'Показать файлы папки'"
                @click="sidebarListMode = sidebarListMode === 'folder' ? 'all' : 'folder'"
            >
              {{ sidebarListMode === 'folder' ? 'Все' : 'В папке' }}
            </button>
          </div>

          <div v-if="isLoading" class="sidebar-empty">
            <span>Загрузка…</span>
          </div>

          <div v-else-if="loadError" class="sidebar-empty">
            <span>{{ loadError }}</span>
            <UIMoloButton class="small" @click="workspaceStore.loadWorkspace(true)">Повторить</UIMoloButton>
          </div>

          <div v-else-if="filteredBottomDocuments.length === 0" class="sidebar-empty">
            <span>Нет файлов (перетащите сюда)</span>
          </div>

          <div v-else class="sidebar-list">
            <div
                v-for="doc in filteredBottomDocuments"
                :key="doc.id"
                class="sidebar-item"
                :class="{ active: doc.id === activeId }"
                draggable="true"
                @dragstart="onDocDragStart($event, doc.id)"
                @click="workspaceStore.openDoc(doc.id)"
            >
              <img class="sidebar-item-icon" :src="docIcon(doc.type)" alt="" draggable="false" />

              <div class="sidebar-item-info">
                <input
                    v-if="renamingId === doc.id"
                    v-model="renameValue"
                    v-focus
                    class="rename-input"
                    @click.stop
                    @keydown.enter="confirmRename"
                    @keydown.esc="cancelRename"
                    @blur="handleInputBlur"
                />
                <template v-else>
                  <span
                      class="sidebar-item-name"
                      @dblclick.stop="startRename(doc)"
                  >{{ doc.name }}</span>
                  <span class="sidebar-item-meta">{{ formatDate(doc.updatedAt) }}</span>
                </template>
              </div>

              <div class="item-actions" @click.stop>
                <UIMoloButton
                    v-if="renamingId !== doc.id"
                    class="icon-btn"
                    title="Переименовать"
                    @click.stop="startRename(doc)"
                >
                  <MoloSticker name="edit" :size="12" />
                </UIMoloButton>
                <UIMoloButton
                    v-if="renamingId !== doc.id"
                    class="icon-btn"
                    title="Удалить"
                    @click.stop="requestRemove(doc.id)"
                >
                  <MoloSticker name="trash" :size="12" />
                </UIMoloButton>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Основная область редактирования -->
      <section class="workspace-main">
        <div v-if="openDocuments.length === 0" class="empty-state">
          <div class="empty-icon-wrap">
            <MoloSticker name="folder-open" :size="36" glow />
          </div>

          <h3>Рабочая область свободна</h3>
          <p class="empty-subtitle">
            Выберите нужный файл в проводнике слева или перетащите его прямо сюда с компьютера
          </p>

          <div class="supported-formats">
            <span class="formats-title">Поддерживаемые форматы и документы:</span>

            <div class="formats-grid">
              <div class="format-card" @click="createDocument('excel')">
                <img class="format-icon" :src="docIcon('excel')" alt="Excel" draggable="false" />
                <div class="format-info">
                  <strong>Таблицы</strong>
                  <span class="format-ext">.xlsx, .xls, .csv</span>
                </div>
              </div>

              <div class="format-card" @click="createDocument('word')">
                <img class="format-icon" :src="docIcon('word')" alt="Word" draggable="false" />
                <div class="format-info">
                  <strong>Документы</strong>
                  <span class="format-ext">.docx, .txt, .html</span>
                </div>
              </div>

              <div class="format-card" @click="createDocument('pdf')">
                <img class="format-icon" :src="docIcon('pdf')" alt="PDF" draggable="false" />
                <div class="format-info">
                  <strong>PDF-файлы</strong>
                  <span class="format-ext">.pdf (с печатью и штампом)</span>
                </div>
              </div>

              <div class="format-card" @click="createDocument('primary')">
                <img class="format-icon" :src="docIcon('primary')" alt="Бланки" draggable="false" />
                <div class="format-info">
                  <strong>Бланки</strong>
                  <span class="format-ext">ТОРГ-12, Акты, Счета</span>
                </div>
              </div>

              <div class="format-card" @click="createDocument('image')">
                <img class="format-icon" :src="docIcon('image')" alt="image" draggable="false" />
                <div class="format-info">
                  <strong>Просмотр изображений</strong>
                  <span class="format-ext">.png, .jpeg, .webp</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <template v-else>
          <div class="tabs-bar">
            <div
                v-for="doc in openDocuments"
                :key="doc.id"
                class="tab-item"
                :class="{ active: doc.id === activeId }"
                @click="activeId = doc.id"
                @mousedown.middle.prevent="closeTab(doc.id)"
                @dblclick="startRename(doc)"
            >
              <img class="tab-icon" :src="docIcon(doc.type)" alt="" draggable="false">

              <input
                  v-if="renamingId === doc.id"
                  v-model="renameValue"
                  v-focus
                  class="rename-input tab-rename"
                  @blur="handleInputBlur"
                  @keydown.enter="confirmRename"
                  @click.stop
              />
              <span v-else class="tab-name">{{ doc.name }}</span>

              <button class="tab-close" title="Закрыть вкладку" @click.stop="closeTab(doc.id)">✕</button>
            </div>
          </div>

          <div class="tab-content">
            <div
                v-for="doc in openDocuments"
                v-show="doc.id === activeId"
                :key="doc.id"
                class="tab-panel"
            >
              <div v-if="doc.loadState === 'error'" class="doc-status error">
                <span>Не удалось загрузить документ</span>
                <UIMoloButton class="small" @click="workspaceStore.loadDocumentContent(doc.id)">Повторить</UIMoloButton>
              </div>
              <div v-else-if="doc.loadState !== 'loaded'" class="doc-status">
                <span>Загрузка…</span>
              </div>
              <template v-else>
                <AppsMoloTable
                    v-if="doc.type === 'excel'"
                    :model-value="doc.data"
                    @update:model-value="(val) => updateDocData(doc.id, val)"
                />
                <AppsMoloDocument
                    v-else-if="doc.type === 'word'"
                    :model-value="doc.data"
                    :file-name="doc.name"
                    @update:model-value="(val) => updateDocData(doc.id, val)"
                    @resolve-variable="onDocumentVariableTrigger"
                />
                <AppsMoloPrimaryDoc
                    v-else-if="doc.type === 'primary'"
                    :model-value="doc.data"
                    @update:model-value="(val) => updateDocData(doc.id, val)"
                />
                <AppsMoloPDFReader
                    v-else-if="doc.type === 'pdf'"
                    :model-value="doc.data"
                    :file-name="doc.name"
                    @update:model-value="(val) => updateDocData(doc.id, val)"
                />
                <AppsMoloImageViewer
                    v-else-if="doc.type === 'image'"
                    :model-value="doc.data"
                    :file-name="doc.name"
                />
              </template>
            </div>
          </div>
        </template>
      </section>

      <!-- Правая панель истории версий -->
      <transition name="slide-panel">
        <aside v-if="isVersionPanelOpen && activeDocument" class="version-sidebar">
          <div class="version-header">
            <div class="version-header-title">
              <strong>История версий</strong>
              <small>{{ activeDocument.name }}</small>
            </div>
            <UIMoloButton class="small fit" title="Закрыть панель" @click="isVersionPanelOpen = false">✕</UIMoloButton>
          </div>

          <div class="version-actions-bar">
            <UIMoloButton class="confirm small full" @click="createManualSnapshot">
              Создать контрольную точку
            </UIMoloButton>
          </div>

          <div v-if="versionsLoading" class="version-loading">
            <span>Загрузка ревизий…</span>
          </div>

          <div v-else-if="versions.length === 0" class="version-empty">
            <span>История пока пуста. При сохранении снимков они появятся здесь.</span>
          </div>

          <div v-else class="version-list">
            <div
                v-for="ver in versions"
                :key="ver.id"
                class="version-card"
            >
              <div class="version-card-main">
                <div class="version-date">{{ formatDate(ver.createdAt) }}</div>
                <div class="version-comment">{{ ver.comment || 'Контрольная точка' }}</div>
                <div class="version-size">{{ formatSize(ver.size) }}</div>
              </div>

              <div class="version-card-actions">
                <UIMoloButton
                    class="small"
                    title="Откатить документ к этой версии"
                    @click="requestRestoreVersion(ver)"
                >
                  Восстановить
                </UIMoloButton>
              </div>
            </div>
          </div>
        </aside>
      </transition>
    </div>
  </div>

  <UIMoloModal
      v-model="isModalOpen"
      :title="deleteModalTitle"
      :modal-text="deleteModalText"
      cancel-text="Отмена"
      confirm-text="Удалить"
      @confirm="confirmRemove"
      @cancel="cancelRemove"
  />

  <UIMoloModal
      v-model="isRestoreModalOpen"
      title="Восстановить версию?"
      modal-text="Текущее состояние будет сохранено как снимок, а документ откатится к выбранной версии."
      cancel-text="Отмена"
      confirm-text="Восстановить"
      @confirm="confirmRestoreVersion"
      @cancel="pendingRestore = null"
  />

  <DirectoryResolutionModal
      v-model="resolutionModalOpen"
      :candidates="candidateList || []"
      title="Выберите сотрудника для вставки"
      @select="handleCandidateSelect"
  />
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: #e0e0e0;
  box-sizing: border-box;
  user-select: none;
}

.workspace.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  height: 100vh !important;
  width: 100vw !important;
}

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  border-bottom: 1px solid var(--half_opacity_border);
  flex-shrink: 0;
}

.workspace-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
}

.workspace-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
}

.screen-glyph {
  width: 14px;
  height: 14px;
  color: #b0b0c0;
}

.save-status {
  font-size: 11px;
  color: #8e8e9e;
  white-space: nowrap;
}

.save-status.error {
  color: #ef4444;
  font-weight: 600;
}

.create-menu-wrap {
  position: relative;
}

.create-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #1e1e1e;
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  min-width: 180px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

.create-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  color: #e0e0e0;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}

.create-menu-item:hover {
  background: rgba(100, 150, 255, 0.12);
}

.create-menu-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.workspace-body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.workspace-sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--half_opacity_border);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgba(0, 0, 0, 0.15);
}

.tree-container {
  flex: 1 1 30%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 10px 8px;
  min-height: 120px;
  border-bottom: 1px solid var(--half_opacity_border);
}

.explorer-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #7b7b8f;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 6px 8px 6px;
}

.folders-tree {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  position: relative;
  transition: background 0.1s ease, outline 0.1s ease;
}

.tree-node:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tree-node.active {
  background: rgba(100, 150, 255, 0.18);
  color: #fff;
  font-weight: 500;
}

.tree-node.drag-over {
  background: rgba(59, 130, 246, 0.25) !important;
  outline: 1px dashed #3b82f6;
}

.tree-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 11px;
  background: none;
  border: none;
  color: #8b8b9b;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, color 0.15s;
}

.tree-chevron:hover {
  color: #ffffff;
}

.tree-chevron.expanded {
  transform: rotate(90deg);
}

.tree-chevron.invisible {
  visibility: hidden;
  pointer-events: none;
}

.tree-icon {
  flex-shrink: 0;
}

.tree-file-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  flex-shrink: 0;
}

.node-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-node {
  color: #c4c4d4;
}

.file-node:hover {
  color: #ffffff;
}

.bottom-files-section {
  flex: 1 1 60%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 10px 8px;
  min-height: 120px;
}

.sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: #8e8e9e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  padding: 0 4px;
}

.heading-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.heading-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
  font-weight: 700;
}

.mode-toggle-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  color: #b0b0c0;
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
}

.mode-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 20px 8px;
  color: #6e6e7e;
  font-size: 12px;
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.sidebar-item.active {
  background: rgba(100, 150, 255, 0.16);
}

.sidebar-item-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}

.sidebar-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-item-name {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-item-meta {
  font-size: 10px;
  color: #6e6e7e;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.tree-node:hover .item-actions,
.file-node:hover .item-actions,
.sidebar-item:hover .item-actions {
  opacity: 1;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.rename-input {
  background: #0f0f14;
  border: 1px solid #6496ff;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  padding: 2px 4px;
  width: 100%;
}

.workspace-main {
  flex: 1 1 0%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px;
  box-sizing: border-box;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  user-select: none;
  animation: fadeIn 0.25s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.empty-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.empty-state h3 {
  margin: 0 0 6px;
  font-size: 19px;
  font-weight: 600;
  color: #f3f3f6;
}

.empty-subtitle {
  max-width: 480px;
  margin: 0 0 28px;
  font-size: 13px;
  color: #8e8e9e;
  line-height: 1.5;
}

.supported-formats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 680px;
  width: 100%;
}

.formats-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #6e6e80;
  font-weight: 700;
}

.formats-grid {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.format-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.format-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(100, 150, 255, 0.4);
  transform: translateY(-2px);
}

.format-icon {
  width: 26px;
  height: 26px;
  object-fit: contain;
  flex-shrink: 0;
}

.format-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.format-info strong {
  font-size: 12.5px;
  color: #e2e2ec;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.format-ext {
  font-size: 10px;
  color: #7b7b8f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .formats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .formats-grid {
    grid-template-columns: 1fr;
  }
}

.doc-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8e8e9e;
  font-size: 13px;
}

.doc-status.error {
  color: #ef4444;
}

.tabs-bar {
  display: flex;
  overflow-x: auto;
  flex-shrink: 0;
  gap: 4px;
  padding-bottom: 6px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px 8px 0 0;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  border: 1px solid transparent;
  max-width: 200px;
}

.tab-item.active {
  background: var(--half_opacity_bg);
  border-color: var(--half_opacity_border);
  border-bottom-color: transparent;
  font-weight: 600;
}

.tab-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  flex-shrink: 0;
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-rename {
  max-width: 120px;
}

.tab-close {
  background: none;
  border: none;
  color: #8e8e9e;
  cursor: pointer;
  font-size: 10px;
  padding: 2px;
  border-radius: 3px;
}

.tab-close:hover {
  color: #ef4444;
  background: rgba(255, 255, 255, 0.1);
}

.tab-content {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.tab-panel {
  flex: 1 1 0%;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-panel > * {
  flex: 1 1 0%;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.version-sidebar {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--half_opacity_border);
  background: var(--half_opacity_bg);
  display: flex;
  flex-direction: column;
  min-height: 0;
  z-index: 10;
}

.version-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--half_opacity_border);
}

.version-header-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.version-header-title strong {
  font-size: 14px;
  color: #fff;
}

.version-header-title small {
  color: #8e8e9e;
  font-size: 11px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-actions-bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--half_opacity_border);
}

.version-loading,
.version-empty {
  padding: 24px 16px;
  text-align: center;
  color: #7b7b8f;
  font-size: 12px;
  line-height: 1.5;
}

.version-list {
  padding: 12px;
  display: flex;
  height: 650px;
  overflow-y: auto;
  flex-direction: column;
  gap: 10px;
}

.version-card {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: background 0.15s ease;
}

.version-card:hover {
  background: rgba(255, 255, 255, 0.06);
}

.version-card-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.version-date {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.version-comment {
  font-size: 12px;
  color: #9fa2b4;
}

.version-size {
  font-size: 10px;
  color: #636575;
}

.version-card-actions {
  display: flex;
  justify-content: flex-end;
}

.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.25s ease, opacity 0.2s ease;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .workspace-body {
    flex-direction: column;
  }

  .workspace-sidebar {
    width: 100%;
    max-height: 240px;
    border-right: none;
    border-bottom: 1px solid var(--half_opacity_border);
  }

  .version-sidebar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 320px;
    box-shadow: -4px 0 16px rgba(0,0,0,0.5);
  }
}
</style>