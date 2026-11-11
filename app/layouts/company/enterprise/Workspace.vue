<!-- app/layouts/company/enterprise/Workspace.vue -->
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
import { useAppStore } from '~~/stores/appStore'
import mammoth from 'mammoth'

const props = defineProps<{
  enterpriseId?: string
  windowId?: string
  windowData?: Record<string, any>
  moduleData?: Record<string, any>
  uniqueWindowId?: string
}>()

const emit = defineEmits(['close'])

const appStore = useAppStore()

function getWorkspaceEnterpriseId(): string {
  const fromProps = typeof props.enterpriseId === 'string' ? props.enterpriseId.trim() : ''
  if (/^[a-f\d]{24}$/i.test(fromProps)) return fromProps

  const fromStore = String(appStore.getEnterpriseId?.() || '').trim()
  if (/^[a-f\d]{24}$/i.test(fromStore)) return fromStore

  if (import.meta.client) {
    try {
      const raw = localStorage.getItem('currentEnterprise')
      const enterprise = raw ? JSON.parse(raw) : null
      const storedId = String(enterprise?._id || enterprise?.id || '').trim()
      if (/^[a-f\d]{24}$/i.test(storedId)) return storedId
    } catch (error) {
      console.warn('[Workspace] Не удалось прочитать currentEnterprise:', error)
    }
  }
  return ''
}

const DOC_ICONS: Record<DocType, string> = {
  excel: excelIcon,
  word: wordIcon,
  pdf: pdfIcon,
  primary: primaryIcon,
  image: imageIcon
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  excel: 'Таблица (Excel)',
  word: 'Документ (Word)',
  primary: 'Первичный документ (ТОРГ)',
  pdf: 'Документ PDF',
  image: 'Изображение / Скан'
}

const workspaceStore = useWorkspaceStore()
watch(() => workspaceStore.lastError, (msg) => { if (msg) addNotification('error', msg) })
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

/* ── Модалка создания папки ── */
const createFolderModalOpen = ref(false)
const newFolderName = ref('')
const newFolderParentId = ref<string | null>(null)
const isFolderCreating = ref(false)

/* ── Модалка создания документа ── */
const createDocModalOpen = ref(false)
const newDocType = ref<DocType>('excel')
const newDocName = ref('')
const newDocFolderId = ref<string | null>(null)
const selectedExternalFile = ref<File | null>(null)
const isDocCreating = ref(false)

/* ── Модалка создания контрольной точки ── */
const createSnapshotModalOpen = ref(false)
const snapshotComment = ref('')
const isSnapshotCreating = ref(false)

/* ── Панель версий ── */
const isVersionPanelOpen = ref(false)
const versions = ref<DocVersionMeta[]>([])
const versionsLoading = ref(false)
const pendingRestore = ref<DocVersionMeta | null>(null)
const isRestoreModalOpen = ref(false)

/* ── Drag & Drop ── */
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
  if (saveState.value === 'error') return 'Ошибка сохранения'
  if (saveState.value === 'saved' && lastSavedAt.value) {
    return 'Сохранено в ' + new Date(lastSavedAt.value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return 'Актуально'
})

const folderOptions = computed(() => [
  { label: 'Корень пространства (без папки)', value: '' },
  ...folders.value.map(f => ({ label: f.name, value: f.id }))
])

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

/* ── Дерево проводника ── */

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

/* ── Drag & Drop ── */

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
        query: { enterpriseId: getWorkspaceEnterpriseId() },
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
        query: { enterpriseId: getWorkspaceEnterpriseId() },
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
      addNotification('error', `Файл «${file.name}» не сохранён в базу`)
    }
  }
}

/* ── Поиск и фильтрация ── */

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

const totalBytesCount = computed(() => {
  return documents.value.reduce((acc, doc) => acc + (doc.size || 0), 0)
})

/* ── Версионирование ── */

async function loadVersions(docId: string) {
  versionsLoading.value = true
  try {
    versions.value = await $fetch<DocVersionMeta[]>(`/api/workspace/documents/${docId}/versions`, {
      query: { enterpriseId: getWorkspaceEnterpriseId() }
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

function openCreateSnapshotModal() {
  if (!activeId.value) return
  snapshotComment.value = `Контрольная точка (${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`
  createSnapshotModalOpen.value = true
}

async function confirmCreateManualSnapshot() {
  if (!activeId.value) return
  const comment = snapshotComment.value.trim()
  if (!comment) {
    addNotification('warning', 'Укажите комментарий к снимку')
    return
  }

  isSnapshotCreating.value = true
  await workspaceStore.flushAll()
  try {
    const version = await $fetch<DocVersionMeta>(`/api/workspace/documents/${activeId.value}/versions`, {
      method: 'POST',
      query: { enterpriseId: getWorkspaceEnterpriseId() },
      body: { comment }
    })
    versions.value = [version, ...versions.value]
    createSnapshotModalOpen.value = false
    addNotification('success', 'Контрольная точка сохранена')
  } catch {
    addNotification('error', 'Не удалось сохранить версию')
  } finally {
    isSnapshotCreating.value = false
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
      query: { enterpriseId: getWorkspaceEnterpriseId() }
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

/* ── Управление папками в UIMoloModal ── */

function openCreateFolderModal() {
  newFolderName.value = ''
  newFolderParentId.value = activeFolderId.value || ''
  createFolderModalOpen.value = true
}

async function confirmCreateFolder() {
  const name = newFolderName.value.trim()
  if (!name) {
    addNotification('warning', 'Введите название папки')
    return
  }

  isFolderCreating.value = true
  const parentId = newFolderParentId.value ? newFolderParentId.value : null

  try {
    const folder = await $fetch<SpaceFolder>('/api/workspace/folders', {
      method: 'POST',
      query: { enterpriseId: getWorkspaceEnterpriseId() },
      body: { name, parentId }
    })
    folders.value.push(folder)
    if (parentId) {
      expandedFolderIds.value.add(parentId)
    }
    createFolderModalOpen.value = false
    addNotification('success', `Папка «${name}» создана`)
  } catch {
    addNotification('error', 'Не удалось создать папку')
  } finally {
    isFolderCreating.value = false
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
      query: { enterpriseId: getWorkspaceEnterpriseId() },
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
      query: { enterpriseId: getWorkspaceEnterpriseId() }
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

/* ── Управление документами в UIMoloModal ── */

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

function openCreateDocModal(type: DocType) {
  createMenuOpen.value = false
  newDocType.value = type
  newDocFolderId.value = activeFolderId.value || ''
  selectedExternalFile.value = null

  if (type === 'excel') newDocName.value = 'Новая таблица'
  else if (type === 'primary') newDocName.value = 'Новая товарная накладная'
  else if (type === 'pdf') newDocName.value = 'Новый скан / PDF'
  else if (type === 'image') newDocName.value = 'Новое изображение'
  else newDocName.value = 'Новый документ'

  createDocModalOpen.value = true
}

function onModalFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedExternalFile.value = input.files[0]
    newDocName.value = input.files[0].name.replace(/\.[^/.]+$/, '')
  }
}

async function confirmCreateDocument() {
  const enterpriseId = getWorkspaceEnterpriseId()
  if (!enterpriseId) {
    addNotification('error', 'Не выбрано предприятие')
    return
  }

  const name = newDocName.value.trim()
  if (!name) {
    addNotification('warning', 'Укажите название документа')
    return
  }

  const type = newDocType.value
  const targetFolderId = newDocFolderId.value ? newDocFolderId.value : null

  // Если это файл с диска (PDF / Изображение)
  if ((type === 'pdf' || type === 'image') && selectedExternalFile.value) {
    isDocCreating.value = true
    try {
      await handleExternalFilesDrop([selectedExternalFile.value] as unknown as FileList, targetFolderId)
      createDocModalOpen.value = false
    } finally {
      isDocCreating.value = false
    }
    return
  }

  isDocCreating.value = true
  try {
    const meta = await $fetch<any>('/api/workspace/documents', {
      method: 'POST',
      query: { enterpriseId },
      body: {
        type,
        name,
        folderId: targetFolderId,
        data: type === 'word' ? '' : {}
      }
    })

    const doc: SpaceDocument = {
      ...meta,
      data: type === 'word' ? '' : {},
      loadState: 'loaded'
    }

    documents.value = [doc, ...documents.value]
    if (targetFolderId) {
      expandedFolderIds.value.add(targetFolderId)
    }
    workspaceStore.openDoc(doc.id)
    createDocModalOpen.value = false
    addLog('info', `Создан документ «${name}»`)
    addNotification('success', `Документ «${name}» создан`)
  } catch {
    addNotification('error', 'Документ не создан: проверьте подключение')
  } finally {
    isDocCreating.value = false
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
      query: { enterpriseId: getWorkspaceEnterpriseId() }
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
      query: { enterpriseId: getWorkspaceEnterpriseId() },
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

function handleBeforeUnload() {
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
  <div ref="workspaceRoot" class="workspace-app" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- HEADER -->
    <header class="workspace-header">
      <div class="header-main">
        <div class="header-icon">
          <UIMoloSticker name="folder-open" :size="19" glow />
        </div>

        <div class="header-heading">
          <div class="header-title">Пространство документов</div>
          <div class="header-subtitle">Таблицы, документы, бланки и история версий</div>
        </div>
      </div>

      <div class="btn-group">
        <UIMoloButton class="save-status-badge small" :class="{ error: saveState === 'error', saving: saveState === 'saving' }">
          <span class="save-dot"></span>
          {{ saveStatusText }}
        </UIMoloButton>

        <UIMoloButton
            v-if="activeId"
            class="action small"
            :class="{ confirm: isVersionPanelOpen }"
            title="История версий и точек отката"
            @click="toggleVersionPanel"
        >
          <UIMoloSticker name="history" :size="14" />
          Версии
        </UIMoloButton>

        <UIMoloButton class="action small" title="Создать папку" @click="openCreateFolderModal">
          <UIMoloSticker name="plus" :size="14" />
          Папка
        </UIMoloButton>

        <UIMoloButton class="action small" :title="isFullscreen ? 'Обычный режим' : 'На весь экран'" @click="toggleFullscreen">
          <UIMoloSticker :name="isFullscreen ? 'fullscreen-exit' : 'fullscreen'" :size="14" />
        </UIMoloButton>

        <div class="create-menu-wrap">
          <UIMoloButton class="confirm small" @click.stop="createMenuOpen = !createMenuOpen">
            <UIMoloSticker name="file-plus" :size="14" />
            Создать документ
          </UIMoloButton>

          <div v-if="createMenuOpen" class="create-menu">
            <button class="create-menu-item" @click="openCreateDocModal('excel')">
              <img class="create-menu-icon" :src="docIcon('excel')" alt="" />
              <span>Таблица (Excel)</span>
            </button>
            <button class="create-menu-item" @click="openCreateDocModal('word')">
              <img class="create-menu-icon" :src="docIcon('word')" alt="" />
              <span>Документ (Word)</span>
            </button>
            <button class="create-menu-item" @click="openCreateDocModal('primary')">
              <img class="create-menu-icon" :src="docIcon('primary')" alt="" />
              <span>Первичка (ТОРГ)</span>
            </button>
            <button class="create-menu-item" @click="openCreateDocModal('pdf')">
              <img class="create-menu-icon" :src="docIcon('pdf')" alt="" />
              <span>PDF Документ</span>
            </button>
            <button class="create-menu-item" @click="openCreateDocModal('image')">
              <img class="create-menu-icon" :src="docIcon('image')" alt="" />
              <span>Изображение</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- ОСНОВНОЙ ЛЕЙАУТ -->
    <div class="workspace-layout">
      <!-- САЙДБАР: ДЕРЕВО И ФАЙЛЫ -->
      <aside class="workspace-sidebar">
        <!-- Поиск -->
        <div class="sidebar-search-box">
          <UIMoloInput
              v-model="searchQuery"
              compact
              placeholder="Поиск по документам..."
          />
        </div>

        <!-- Дерево папок -->
        <div class="folders-tree-panel">
          <div class="sidebar-section-heading">
            <span>Проводник</span>
            <div class="tree-heading-actions">
              <button class="add-folder-mini-btn" title="Новая папка" @click="openCreateFolderModal">
                <UIMoloSticker name="plus" :size="11" />
              </button>
              <span class="badge-pill">{{ folders.length }}</span>
            </div>
          </div>

          <div class="folders-tree">
            <!-- Корневой узел -->
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
              <UIMoloSticker name="folder-open" :size="15" class="node-icon" />
              <span class="node-title">Все документы</span>
              <span class="badge-pill">{{ documents.length }}</span>
            </div>

            <!-- Иерархия -->
            <template v-for="(item, idx) in explorerTree" :key="idx">
              <!-- Папка -->
              <div
                  v-if="item.kind === 'folder'"
                  class="tree-node folder-node"
                  :class="{
                  active: activeFolderId === item.folder.id,
                  'drag-over': dragOverFolderId === item.folder.id
                }"
                  :style="{ paddingLeft: `${item.depth * 12 + 8}px` }"
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
                  <UIMoloSticker name="right" :size="10" />
                </button>

                <UIMoloSticker
                    :name="item.isExpanded ? 'folder-open' : 'folder'"
                    :size="15"
                    class="node-icon"
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
                  <div class="node-actions" @click.stop>
                    <button class="node-action-btn" title="Переименовать" @click.stop="startFolderRename(item.folder)">
                      <UIMoloSticker name="pen" :size="12" />
                    </button>
                    <button class="node-action-btn delete" title="Удалить" @click.stop="requestRemoveFolder(item.folder.id)">
                      <UIMoloSticker name="trash" :size="12" />
                    </button>
                  </div>
                </template>
              </div>

              <!-- Файл прямо в ветке дерева -->
              <div
                  v-else-if="item.kind === 'file'"
                  class="tree-node file-node"
                  :class="{ active: activeId === item.doc.id }"
                  :style="{ paddingLeft: `${item.depth * 12 + 22}px` }"
                  draggable="true"
                  @dragstart="onDocDragStart($event, item.doc.id)"
                  @click="workspaceStore.openDoc(item.doc.id)"
                  @dblclick.stop="startRename(item.doc)"
              >
                <img class="tree-type-icon" :src="docIcon(item.doc.type)" alt="" draggable="false" />

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
                  <div class="node-actions" @click.stop>
                    <UIMoloButton class="small transparent" title="Переименовать" @click.stop="startRename(item.doc)">
                      <UIMoloSticker name="pen" :size="12" />
                    </UIMoloButton>
                    <UIMoloButton class="small transparent close" title="Удалить" @click.stop="requestRemove(item.doc.id)">
                      <UIMoloSticker name="trash" :size="12" />
                    </UIMoloButton>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>

        <!-- Нижний список файлов текущего контекста -->
        <div
            class="files-list-panel"
            @dragover="onFolderDragOver($event, activeFolderId)"
            @dragleave="onFolderDragLeave"
            @drop="onFolderDrop($event, activeFolderId)"
        >
          <div class="sidebar-section-heading">
            <div class="heading-text-group">
              <span class="current-folder-title" :title="currentFolderName">
                {{ sidebarListMode === 'folder' ? currentFolderName : 'Все файлы' }}
              </span>
              <span class="badge-pill">{{ filteredBottomDocuments.length }}</span>
            </div>

            <button
                type="button"
                class="list-mode-toggle"
                :title="sidebarListMode === 'folder' ? 'Показать все файлы' : 'Показать файлы папки'"
                @click="sidebarListMode = sidebarListMode === 'folder' ? 'all' : 'folder'"
            >
              {{ sidebarListMode === 'folder' ? 'Все' : 'Папка' }}
            </button>
          </div>

          <div v-if="isLoading" class="files-empty-state">
            <UIMoloLoaders btnLoader />
            <span>Загрузка...</span>
          </div>

          <div v-else-if="filteredBottomDocuments.length === 0" class="files-empty-state">
            <UIMoloSticker name="inbox" :size="20" />
            <span>Нет файлов в этом разделе</span>
          </div>

          <div v-else class="files-stack">
            <div
                v-for="doc in filteredBottomDocuments"
                :key="doc.id"
                class="file-card-item"
                :class="{ active: doc.id === activeId }"
                draggable="true"
                @dragstart="onDocDragStart($event, doc.id)"
                @click="workspaceStore.openDoc(doc.id)"
            >
              <img class="file-card-icon" :src="docIcon(doc.type)" alt="" draggable="false" />

              <div class="file-card-info">
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
                  <span class="file-card-name" @dblclick.stop="startRename(doc)">{{ doc.name }}</span>
                  <div class="file-card-meta">
                    <span>{{ formatDate(doc.updatedAt) }}</span>
                    <span>•</span>
                    <span>{{ formatSize(doc.size) }}</span>
                  </div>
                </template>
              </div>

              <div class="node-actions" @click.stop>
                <button
                    v-if="renamingId !== doc.id"
                    class="node-action-btn"
                    title="Переименовать"
                    @click.stop="startRename(doc)"
                >
                  <UIMoloSticker name="pen" :size="12" />
                </button>
                <button
                    v-if="renamingId !== doc.id"
                    class="node-action-btn delete"
                    title="Удалить"
                    @click.stop="requestRemove(doc.id)"
                >
                  <UIMoloSticker name="trash" :size="12" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar-bottom-info">
          <span>Общий объём документов:</span>
          <b>{{ formatSize(totalBytesCount) }}</b>
        </div>
      </aside>

      <!-- ОСНОВНАЯ ОБЛАСТЬ -->
      <main class="workspace-viewport">
        <!-- ПУСТОЙ ЭКРАН (СВОДКА И БЫСТРЫЕ ДЕЙСТВИЯ) -->
        <div v-if="openDocuments.length === 0" class="workspace-empty-container">
          <!-- СТАТИСТИКА -->
          <section class="stats-row">
            <div class="stat-card">
              <div class="stat-icon"><UIMoloSticker name="database" :size="17" /></div>
              <div class="stat-content">
                <span>Всего файлов</span>
                <strong>{{ documents.length }}</strong>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon"><UIMoloSticker name="folder" :size="17" /></div>
              <div class="stat-content">
                <span>Папок создано</span>
                <strong>{{ folders.length }}</strong>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon"><UIMoloSticker name="save" :size="17" /></div>
              <div class="stat-content">
                <span>Общий вес</span>
                <strong>{{ formatSize(totalBytesCount) }}</strong>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon"><UIMoloSticker name="check-circle" :size="17" /></div>
              <div class="stat-content">
                <span>Автосохранение</span>
                <strong>{{ saveStatusText }}</strong>
              </div>
            </div>
          </section>

          <!-- ПРИГЛАШЕНИЕ К РАБОТЕ -->
          <div class="empty-glass-hero">
            <div class="empty-hero-icon">
              <UIMoloSticker name="folder-open" :size="38" glow />
            </div>

            <h3 class="hero-title">Рабочее пространство документов</h3>
            <p class="hero-subtitle">
              Выберите файл в проводнике слева, перетащите существующий с вашего компьютера или создайте новый нужного формата
            </p>

            <div class="supported-formats-box">
              <span class="formats-header-label">БЫСТРОЕ СОЗДАНИЕ:</span>

              <div class="formats-grid">
                <div class="format-card" @click="openCreateDocModal('excel')">
                  <img class="format-icon" :src="docIcon('excel')" alt="Таблицы" />
                  <div class="format-info">
                    <strong>Таблицы</strong>
                    <span class="format-ext">.xlsx, .xls, .csv</span>
                  </div>
                </div>

                <div class="format-card" @click="openCreateDocModal('word')">
                  <img class="format-icon" :src="docIcon('word')" alt="Документы" />
                  <div class="format-info">
                    <strong>Документы</strong>
                    <span class="format-ext">.docx, текст, A4</span>
                  </div>
                </div>

                <div class="format-card" @click="openCreateDocModal('primary')">
                  <img class="format-icon" :src="docIcon('primary')" alt="Бланки" />
                  <div class="format-info">
                    <strong>Первичка</strong>
                    <span class="format-ext">ТОРГ-12, Акты, Счета</span>
                  </div>
                </div>

                <div class="format-card" @click="openCreateDocModal('pdf')">
                  <img class="format-icon" :src="docIcon('pdf')" alt="PDF" />
                  <div class="format-info">
                    <strong>PDF Документы</strong>
                    <span class="format-ext">Печать, штампы, подпись</span>
                  </div>
                </div>

                <div class="format-card" @click="openCreateDocModal('image')">
                  <img class="format-icon" :src="docIcon('image')" alt="Изображения" />
                  <div class="format-info">
                    <strong>Изображения</strong>
                    <span class="format-ext">.png, .jpeg, сканы</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- РЕДАКТОР С ВКЛАДКАМИ -->
        <template v-else>
          <!-- ВКЛАДКИ -->
          <div class="tabs-toolbar">
            <div class="tabs-scroll-container">
              <div
                  v-for="doc in openDocuments"
                  :key="doc.id"
                  class="workspace-tab"
                  :class="{ active: doc.id === activeId }"
                  @click="activeId = doc.id"
                  @mousedown.middle.prevent="closeTab(doc.id)"
                  @dblclick="startRename(doc)"
              >
                <img class="tab-type-icon" :src="docIcon(doc.type)" alt="" draggable="false" />

                <input
                    v-if="renamingId === doc.id"
                    v-model="renameValue"
                    v-focus
                    class="rename-input tab-rename"
                    @blur="handleInputBlur"
                    @keydown.enter="confirmRename"
                    @click.stop
                />
                <span v-else class="tab-label" :title="doc.name">{{ doc.name }}</span>

                <button class="tab-close-btn" title="Закрыть вкладку" @click.stop="closeTab(doc.id)">
                  <UIMoloSticker name="x" :size="12" />
                </button>
              </div>
            </div>
          </div>

          <!-- СОДЕРЖИМОЕ ВЫБРАННОГО ДОКУМЕНТА -->
          <div class="editor-viewport-container">
            <div
                v-for="doc in openDocuments"
                v-show="doc.id === activeId"
                :key="doc.id"
                class="editor-tab-canvas"
            >
              <div v-if="doc.loadState === 'error'" class="canvas-state-error">
                <UIMoloSticker name="alert" :size="24" />
                <span>Не удалось загрузить содержимое документа</span>
                <UIMoloButton class="small confirm" @click="workspaceStore.loadDocumentContent(doc.id)">Повторить</UIMoloButton>
              </div>

              <div v-else-if="doc.loadState !== 'loaded'" class="canvas-state-loading">
                <UIMoloLoaders wndLoader />
                <span>Загрузка данных документа...</span>
              </div>

              <template v-else>
                <AppsMoloTable
                    v-if="doc.type === 'excel'"
                    :model-value="doc.data"
                    @update:model-value="(val) => updateDocData(doc.id, val)"
                    @resolve-variable="onDocumentVariableTrigger"
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
      </main>

      <!-- ПАНЕЛЬ ИСТОРИИ ВЕРСИЙ -->
      <aside v-if="isVersionPanelOpen && activeDocument" class="version-drawer">
        <div class="drawer-header">
          <div>
            <span class="drawer-eyebrow">ИСТОРИЯ ИЗМЕНЕНИЙ</span>
            <strong>Точки отката</strong>
          </div>

          <UIMoloButton class="transparent small" title="Закрыть панель" @click="isVersionPanelOpen = false">
            <UIMoloSticker name="x" :size="15" />
          </UIMoloButton>
        </div>

        <div class="drawer-info-card">
          <img class="drawer-doc-icon" :src="docIcon(activeDocument.type)" alt="" />
          <strong>{{ activeDocument.name }}</strong>
          <span>Текущий размер: {{ formatSize(activeDocument.size) }}</span>
        </div>

        <div class="drawer-action-block">
          <UIMoloButton class="confirm small full" @click="openCreateSnapshotModal">
            <UIMoloSticker name="save" :size="13" />
            Создать контрольную точку
          </UIMoloButton>
        </div>

        <hr />

        <div v-if="versionsLoading" class="drawer-loading">
          <UIMoloLoaders btnLoader />
          <span>Загрузка ревизий…</span>
        </div>

        <div v-else-if="versions.length === 0" class="drawer-empty">
          <div class="empty-icon-mini">
            <UIMoloSticker name="history" :size="24" />
          </div>
          <strong>История пуста</strong>
          <span>Создавайте контрольные точки перед важными правками документа</span>
        </div>

        <div v-else class="versions-scroll-stack">
          <div
              v-for="ver in versions"
              :key="ver.id"
              class="version-entry-card"
          >
            <div class="version-entry-meta">
              <span class="version-time">{{ formatDate(ver.createdAt) }}</span>
              <strong class="version-label">{{ ver.comment || 'Автоматический снимок' }}</strong>
              <small class="version-bytes">{{ formatSize(ver.size) }}</small>
            </div>

            <UIMoloButton
                class="action small"
                title="Откатить документ к этой точке"
                @click="requestRestoreVersion(ver)"
            >
              Откатить
            </UIMoloButton>
          </div>
        </div>
      </aside>
    </div>

    <!-- МОДАЛКА: СОЗДАНИЕ ПАПКИ -->
    <UIMoloModal
        v-model="createFolderModalOpen"
        title="Новая папка"
        width="460px"
        confirm-text="Создать папку"
        cancel-text="Отмена"
        :loading="isFolderCreating"
        close-on-overlay
        @confirm="confirmCreateFolder"
    >
      <template #body>
        <div class="modal-form-vertical">
          <UIMoloInput
              v-model="newFolderName"
              compact
              l-required
              t-label="Название папки"
              placeholder="Например: Договоры 2026 или Проекты"
              @keydown.enter="confirmCreateFolder"
          />

          <UIMoloSelect
              v-model="newFolderParentId"
              compact
              t-label="Расположение (родительская папка)"
              :parent="folderOptions"
              children="label"
              value-key="value"
          />
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: СОЗДАНИЕ / ИМПОРТ ДОКУМЕНТА -->
    <UIMoloModal
        v-model="createDocModalOpen"
        :title="`Новый ${DOC_TYPE_LABELS[newDocType]}`"
        width="520px"
        confirm-text="Создать"
        cancel-text="Отмена"
        :loading="isDocCreating"
        close-on-overlay
        @confirm="confirmCreateDocument"
    >
      <template #body>
        <div class="modal-form-vertical">
          <div class="type-preview-banner">
            <img class="type-banner-icon" :src="docIcon(newDocType)" alt="" />
            <div class="type-banner-text">
              <strong>{{ DOC_TYPE_LABELS[newDocType] }}</strong>
              <span>
                {{ newDocType === 'excel' ? 'Электронная таблица со сложными формулами, стилями и сводными данными' :
                  newDocType === 'word' ? 'Текстовый документ А4 с типографикой, колонтитулами и экспортом в .docx' :
                      newDocType === 'primary' ? 'Первичная учётная документация государственного стандарта (ТОРГ-12, Акты)' :
                          newDocType === 'pdf' ? 'Просмотр, наложение подписей, факсимиле и синих штампов организации' :
                              'Изображения, сканы актов, паспорта и приложенные фотографии' }}
              </span>
            </div>
          </div>

          <UIMoloInput
              v-model="newDocName"
              compact
              l-required
              t-label="Название документа"
              placeholder="Введите название файла..."
              @keydown.enter="confirmCreateDocument"
          />

          <UIMoloSelect
              v-model="newDocFolderId"
              compact
              t-label="Поместить в папку"
              :parent="folderOptions"
              children="label"
              value-key="value"
          />

          <!-- Загрузка файла при создании PDF / Image -->
          <div v-if="newDocType === 'pdf' || newDocType === 'image'" class="file-uploader-box">
            <label class="field-label-text">
              Выберите файл с устройства
              <span class="required">*</span>
            </label>

            <div class="file-drop-trigger">
              <input
                  type="file"
                  :accept="newDocType === 'pdf' ? 'application/pdf' : 'image/*'"
                  @change="onModalFileSelect"
              />
              <div class="upload-dummy">
                <UIMoloSticker name="upload" :size="16" />
                <span v-if="selectedExternalFile">{{ selectedExternalFile.name }} ({{ formatSize(selectedExternalFile.size) }})</span>
                <span v-else>Нажмите или перетащите файл сюда</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: СОЗДАНИЕ СНИМКА ВЕРСИИ -->
    <UIMoloModal
        v-model="createSnapshotModalOpen"
        title="Создать контрольную точку"
        width="460px"
        confirm-text="Зафиксировать версию"
        cancel-text="Отмена"
        :loading="isSnapshotCreating"
        close-on-overlay
        @confirm="confirmCreateManualSnapshot"
    >
      <template #body>
        <div class="modal-form-vertical">
          <UIMoloInput
              v-model="snapshotComment"
              compact
              l-required
              t-label="Комментарий к точке отката"
              placeholder="Например: Перед согласованием с заказчиком"
              @keydown.enter="confirmCreateManualSnapshot"
          />
          <small class="modal-hint-text">
            Снимок сохранит полное текущее состояние документа и позволит вернуться к нему в любой момент.
          </small>
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКИ ПОДТВЕРЖДЕНИЙ -->
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
        modal-text="Текущее состояние будет сохранено в историю, а документ вернется к выбранной контрольной точке."
        cancel-text="Отмена"
        confirm-text="Восстановить"
        @confirm="confirmRestoreVersion"
        @cancel="pendingRestore = null"
    />

    <DirectoryResolutionModal
        v-model="resolutionModalOpen"
        :candidates="candidateList || []"
        title="Выберите запись для вставки"
        @select="handleCandidateSelect"
    />
  </div>
</template>

<style scoped>
.workspace-app {
  --ws-panel: rgba(255, 255, 255, 0.025);
  --ws-border: var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  --ws-text: #e6edf7;
  --ws-muted: #8491a5;
  --ws-blue: #38bdf8;

  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--ws-text);
  background: var(--half_opacity_bg, #07101e);
  font-size: 13px;
  user-select: none;
}

.workspace-app,
.workspace-app * {
  box-sizing: border-box;
}

.workspace-app.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  height: 100vh !important;
  width: 100vw !important;
}

/* ШАПКА В СТИЛЕ DIRECTORY */
.workspace-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ws-border);
  background: rgba(0, 0, 0, 0.13);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 11px;
  background: rgba(56, 189, 248, 0.08);
  color: #38bdf8;
  flex-shrink: 0;
}

.header-heading {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.header-subtitle {
  font-size: 11px;
  color: var(--ws-muted);
}

.save-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ws-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--ws-border);
  padding: 4px 8px;
  border-radius: 6px;
}

.save-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
}

.save-status-badge.saving .save-dot {
  background: #fbbf24;
  animation: pulse 1s infinite;
}

.save-status-badge.error {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.save-status-badge.error .save-dot {
  background: #f87171;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* ВЫПАДАЮЩЕЕ МЕНЮ СОЗДАНИЯ */
.create-menu-wrap {
  position: relative;
}

.create-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #181920;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  z-index: 100;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
}

.create-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  color: #e2e8f0;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12.5px;
  text-align: left;
  transition: background 0.12s;
}

.create-menu-item:hover {
  background: rgba(56, 189, 248, 0.12);
  color: #fff;
}

.create-menu-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

/* ОСНОВНОЙ ЛЕЙАУТ */
.workspace-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* САЙДБАР */
.workspace-sidebar {
  width: 270px;
  min-width: 240px;
  max-width: 340px;
  flex-shrink: 0;
  border-right: 1px solid var(--ws-border);
  background: rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sidebar-search-box {
  padding: 10px;
  border-bottom: 1px solid var(--ws-border);
  flex-shrink: 0;
}

.sidebar-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--ws-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tree-heading-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.add-folder-mini-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--ws-border);
  border-radius: 4px;
  color: var(--ws-muted);
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s;
}

.add-folder-mini-btn:hover {
  background: rgba(56, 189, 248, 0.18);
  border-color: #38bdf8;
  color: #fff;
}

.heading-text-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.current-folder-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.list-mode-toggle {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--ws-border);
  border-radius: 4px;
  color: #cbd5e1;
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.12s;
}

.list-mode-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.badge-pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--ws-muted);
  font-family: monospace;
}

.folders-tree-panel {
  flex: 1 1 45%;
  min-height: 120px;
  overflow-y: auto;
  border-bottom: 1px solid var(--ws-border);
  padding: 4px;
}

.folders-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  position: relative;
  transition: background 0.12s ease;
  color: #cbd5e1;
}

.tree-node:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
}

.tree-node.active {
  background: rgba(56, 189, 248, 0.14);
  color: #fff;
  font-weight: 500;
}

.tree-node.drag-over {
  background: rgba(56, 189, 248, 0.25) !important;
  outline: 1px dashed #38bdf8;
}

.tree-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, color 0.15s;
}

.tree-chevron.expanded {
  transform: rotate(90deg);
}

.tree-chevron.invisible {
  visibility: hidden;
  pointer-events: none;
}

.node-icon {
  flex-shrink: 0;
  color: #38bdf8;
}

.tree-type-icon {
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

.node-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.tree-node:hover .node-actions,
.file-card-item:hover .node-actions {
  opacity: 1;
}

.node-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  color: var(--ws-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}

.node-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.node-action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.rename-input {
  background: #0f1118;
  border: 1px solid #38bdf8;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  width: 100%;
}

.files-list-panel {
  flex: 1 1 50%;
  min-height: 120px;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.files-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 10px;
  color: var(--ws-muted);
  font-size: 11.5px;
  text-align: center;
}

.files-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-card-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease;
  background: rgba(255, 255, 255, 0.015);
}

.file-card-item:hover {
  background: rgba(255, 255, 255, 0.045);
}

.file-card-item.active {
  background: rgba(56, 189, 248, 0.14);
}

.file-card-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}

.file-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.file-card-name {
  font-size: 12px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-card-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  color: var(--ws-muted);
}

.sidebar-bottom-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--ws-border);
  font-size: 10px;
  color: var(--ws-muted);
  flex-shrink: 0;
}

.sidebar-bottom-info b {
  color: var(--ws-text);
  font-family: monospace;
}

/* ОСНОВНАЯ ЗОНА */
.workspace-viewport {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.08);
}

/* ПУСТОЙ ЭКРАН */
.workspace-empty-container {
  flex: 1;
  overflow-y: auto;
  padding: 18px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* СТАТИСТИКА */
.stats-row {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.stat-card {
  flex: 1;
  min-width: 0;
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--ws-border);
  border-radius: 9px;
  background: var(--ws-panel);
}

.stat-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 8px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat-content span {
  color: var(--ws-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.stat-content strong {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.empty-glass-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 24px;
  border-radius: 14px;
  background: var(--ws-panel);
  border: 1px solid var(--ws-border);
  gap: 12px;
}

.empty-hero-icon {
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.25);
  margin-bottom: 4px;
}

.hero-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #f8fafc;
}

.hero-subtitle {
  max-width: 520px;
  margin: 0;
  color: var(--ws-muted);
  font-size: 13px;
  line-height: 1.5;
}

.supported-formats-box {
  margin-top: 14px;
  width: 100%;
  max-width: 820px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.formats-header-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--ws-muted);
  letter-spacing: 0.6px;
}

.formats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.format-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--ws-border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.format-card:hover {
  background: rgba(56, 189, 248, 0.08);
  border-color: #38bdf8;
  transform: translateY(-2px);
}

.format-icon {
  width: 28px;
  height: 28px;
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
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.format-ext {
  font-size: 9.5px;
  color: var(--ws-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ВКЛАДКИ ДОКУМЕНТОВ */
.tabs-toolbar {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--ws-border);
  background: rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
}

.tabs-scroll-container {
  display: flex;
  gap: 2px;
  padding: 4px 6px 0 6px;
  overflow-x: auto;
  flex: 1;
}

.workspace-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px 6px 0 0;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  border-bottom: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--ws-muted);
  max-width: 220px;
  transition: all 0.12s;
}

.workspace-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f8fafc;
}

.workspace-tab.active {
  background: var(--ws-panel);
  border-color: var(--ws-border);
  color: #38bdf8;
  font-weight: 600;
  box-shadow: inset 0 -2px 0 #38bdf8;
}

.tab-type-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  flex-shrink: 0;
}

.tab-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close-btn {
  background: none;
  border: none;
  color: var(--ws-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tab-close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.tab-rename {
  max-width: 130px;
}

/* ОБЛАСТЬ РЕДАКТОРА */
.editor-viewport-container {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.editor-tab-canvas {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.canvas-state-error,
.canvas-state-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ws-muted);
  font-size: 13px;
}

.canvas-state-error {
  color: #f87171;
}

/* ПАНЕЛЬ ВЕРСИЙ (DRAWER) */
.version-drawer {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid var(--ws-border);
  background: rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  padding: 14px 12px;
  gap: 12px;
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-header > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.drawer-eyebrow {
  color: #728198;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
}

.drawer-header strong {
  font-size: 14px;
}

.drawer-info-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  background: var(--ws-panel);
  border: 1px solid var(--ws-border);
}

.drawer-doc-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.drawer-info-card strong {
  font-size: 13px;
  color: #fff;
  word-break: break-all;
}

.drawer-info-card span {
  font-size: 10.5px;
  color: var(--ws-muted);
  font-family: monospace;
}

.drawer-action-block {
  display: flex;
  flex-direction: column;
}

.drawer-loading,
.drawer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 30px 10px;
  color: var(--ws-muted);
  font-size: 11.5px;
}

.empty-icon-mini {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--ws-panel);
  border: 1px solid var(--ws-border);
  color: #64748b;
}

.versions-scroll-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-entry-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: var(--ws-panel);
  border: 1px solid var(--ws-border);
  transition: all 0.12s;
}

.version-entry-card:hover {
  background: rgba(255, 255, 255, 0.04);
}

.version-entry-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.version-time {
  font-size: 9.5px;
  color: var(--ws-blue);
  font-weight: 600;
}

.version-label {
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.version-bytes {
  font-size: 9.5px;
  color: var(--ws-muted);
  font-family: monospace;
}

/* МОДАЛЬНЫЕ ФОРМЫ */
.modal-form-vertical {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 1px;
}

.modal-hint-text {
  font-size: 11px;
  color: var(--ws-muted);
  line-height: 1.4;
}

.type-preview-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(56, 189, 248, 0.07);
  border: 1px solid rgba(56, 189, 248, 0.2);
}

.type-banner-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
}

.type-banner-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.type-banner-text strong {
  font-size: 13.5px;
  color: #fff;
}

.type-banner-text span {
  font-size: 11px;
  color: #cbd5e1;
  line-height: 1.35;
}

.file-uploader-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label-text {
  font-size: 11.5px;
  color: var(--ws-muted);
  font-weight: 500;
}

.required {
  color: #f87171;
}

.file-drop-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
  border: 1px dashed var(--ws-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.18s ease;
}

.file-drop-trigger:hover {
  background: rgba(56, 189, 248, 0.06);
  border-color: #38bdf8;
}

.file-drop-trigger input[type='file'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-dummy {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #cbd5e1;
  pointer-events: none;
}

@media (max-width: 900px) {
  .workspace-sidebar {
    width: 220px;
  }
  .stats-row {
    flex-wrap: wrap;
  }
}
</style>