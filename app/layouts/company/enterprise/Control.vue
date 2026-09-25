<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAppStore } from '~~/stores/appStore'
import { useWindowManager } from '~~/app/composables/window/useWindowManager'

const { openWindow } = useWindowManager()
const { addNotification } = useNotifications('Управление предприятием')
const { addLog } = useLogger('Управление предприятием')

const store = useAppStore()

const enterpriseInfo = computed(() => store.enterpriseData)
const isAuthenticated = computed(() => store.isEnterpriseLoaded)

/* =========================================================
   СТРУКТУРА ПАПОК ПРОСТРАНСТВА
========================================================= */
interface WorkspaceFolder {
  id: string
  name: string
  parentId: string | null
  createdAt?: number
  updatedAt?: number
}

interface FolderTemplate {
  id: string
  title: string
  description: string
  icon: string
  folders: FolderTemplateNode[]
}

interface FolderTemplateNode {
  name: string
  children?: FolderTemplateNode[]
}

const folderTemplates: FolderTemplate[] = [
  {
    id: 'construction',
    title: 'Строительство',
    description: 'Клиенты, проекты, сметы, материалы, договоры и акты.',
    icon: '🏗️',
    folders: [
      { name: 'Клиенты' },
      {
        name: 'Проекты',
        children: [
          { name: 'Активные' },
          { name: 'Завершённые' },
          { name: 'Архив' },
        ],
      },
      { name: 'Сметы' },
      { name: 'Материалы' },
      { name: 'Сотрудники' },
      { name: 'Договоры' },
      { name: 'Счета' },
      { name: 'Акты' },
      { name: 'Задачи' },
      {
        name: 'Документы',
        children: [
          { name: 'Входящие' },
          { name: 'Исходящие' },
          { name: 'Шаблоны' },
        ],
      },
      { name: 'Финансы' },
    ],
  },
  {
    id: 'store',
    title: 'Магазин',
    description: 'Товары, склад, поставщики, клиенты, заказы и продажи.',
    icon: '🛒',
    folders: [
      { name: 'Товары' },
      { name: 'Категории' },
      { name: 'Поставщики' },
      { name: 'Клиенты' },
      { name: 'Заказы' },
      { name: 'Склад' },
      { name: 'Продажи' },
      { name: 'Закупки' },
      { name: 'Счета' },
      { name: 'Финансы' },
      { name: 'Документы' },
    ],
  },
  {
    id: 'it',
    title: 'IT / Разработка',
    description: 'Клиенты, проекты, задачи, команда, документация и договоры.',
    icon: '💻',
    folders: [
      { name: 'Клиенты' },
      {
        name: 'Проекты',
        children: [
          { name: 'В работе' },
          { name: 'Завершённые' },
          { name: 'Архив' },
        ],
      },
      { name: 'Задачи' },
      { name: 'Команда' },
      { name: 'Документация' },
      { name: 'Договоры' },
      { name: 'Счета' },
      { name: 'Финансы' },
      { name: 'Шаблоны' },
    ],
  },
  {
    id: 'production',
    title: 'Производство',
    description: 'Заказы, производство, материалы, склад, сотрудники и документы.',
    icon: '🏭',
    folders: [
      { name: 'Клиенты' },
      { name: 'Заказы' },
      {
        name: 'Производство',
        children: [
          { name: 'В работе' },
          { name: 'Завершённые' },
          { name: 'Планирование' },
        ],
      },
      { name: 'Материалы' },
      { name: 'Склад' },
      { name: 'Поставщики' },
      { name: 'Сотрудники' },
      { name: 'Договоры' },
      { name: 'Счета' },
      { name: 'Финансы' },
      { name: 'Документы' },
    ],
  },
  {
    id: 'services',
    title: 'Услуги',
    description: 'Клиенты, заказы, услуги, расписание, сотрудники и документы.',
    icon: '🛠️',
    folders: [
      { name: 'Клиенты' },
      { name: 'Заказы' },
      { name: 'Услуги' },
      { name: 'Расписание' },
      { name: 'Сотрудники' },
      { name: 'Договоры' },
      { name: 'Счета' },
      { name: 'Акты' },
      { name: 'Финансы' },
      { name: 'Документы' },
    ],
  },
  {
    id: 'other',
    title: 'Другое',
    description: 'Универсальная базовая структура без отраслевой специфики.',
    icon: '📁',
    folders: [
      { name: 'Клиенты' },
      { name: 'Проекты' },
      { name: 'Задачи' },
      { name: 'Договоры' },
      { name: 'Счета' },
      { name: 'Сотрудники' },
      { name: 'Документы' },
      { name: 'Финансы' },
      { name: 'Архив' },
    ],
  },
]

const folders = ref<WorkspaceFolder[]>([])
const foldersLoading = ref(false)
const folderSetupOpen = ref(false)
const selectedTemplateId = ref<string>('other')
const creatingFolders = ref(false)
const folderSetupError = ref<string | null>(null)

const selectedTemplate = computed(() =>
    folderTemplates.find(t => t.id === selectedTemplateId.value) ?? folderTemplates[folderTemplates.length - 1]!
)
const folderCount = computed(() => folders.value.length)

/* =========================================================
   ДАННЫЕ ИЗ КОНФИГУРАТОРА (ДОСТУП И УЧАСТНИКИ)
========================================================= */
interface MemberItem {
  userId: string
  name: string
  phone: string
  role: string
  joinedAt: string
}

interface FoundUser {
  _id: string
  name: string
  phone: string
  role: string
}

const members = ref<MemberItem[]>([])
const membersLoading = ref(false)
const addingMember = ref(false)

const searchQuery = ref('')
const searchLoading = ref(false)
const searchResults = ref<FoundUser[]>([])
const selectedUser = ref<FoundUser | null>(null)

const availableRoles = [
  { label: 'Сотрудник (базовый доступ)', value: 'Сотрудник' },
  { label: 'Бухгалтер (финансы и счета)', value: 'Бухгалтер' },
  { label: 'Администратор (полный доступ)', value: 'Администратор' },
  { label: 'Наблюдатель (только чтение)', value: 'Наблюдатель' },
  { label: 'Управляющий', value: 'Управляющий' }
]
const selectedRole = ref('Сотрудник')

function notAuth() {
  openWindow('login', null, {
    width: 400,
    height: 450,
    minWidth: 350,
    minHeight: 400
  })
}

function openWorkspace() {
  const enterpriseId = store.getEnterpriseId()
  if (!enterpriseId) {
    addNotification('error', 'Не удалось определить предприятие')
    return
  }
  openWindow('workspace', { enterpriseId }, {
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 480
  })
}

function openDirectory() {
  const enterpriseId = store.getEnterpriseId()
  if (!enterpriseId) {
    addNotification('error', 'Не удалось определить предприятие')
    return
  }
  openWindow('directory', { enterpriseId }, {
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 480
  })
}

function openConfigurator() {
  const enterpriseId = store.getEnterpriseId()
  openWindow('configurator', { enterpriseId }, {
    width: 1100,
    height: 750,
    minWidth: 700,
    minHeight: 500
  })
}

async function loadWorkspaceFolders() {
  const enterpriseId = store.getEnterpriseId()
  if (!enterpriseId) return

  foldersLoading.value = true
  folderSetupError.value = null

  try {
    folders.value = await $fetch<WorkspaceFolder[]>('/api/workspace/folders', {
      query: { enterpriseId }
    })
    if (folders.value.length === 0) {
      folderSetupOpen.value = true
    }
  } catch (e: any) {
    folderSetupError.value =
        e?.data?.message ||
        e?.data?.statusMessage ||
        'Не удалось загрузить структуру пространства'
  } finally {
    foldersLoading.value = false
  }
}

async function loadMembers() {
  const enterpriseId = store.getEnterpriseId()
  if (!enterpriseId) return

  membersLoading.value = true
  try {
    const data: any = await $fetch(`/api/enterprises/${enterpriseId}/members`)
    members.value = data.members || []
  } catch (e: any) {
    console.error('Не удалось загрузить участников', e)
  } finally {
    membersLoading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!val || val.trim().length < 2) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    const entId = store.getEnterpriseId()
    searchLoading.value = true
    try {
      const res: any = await $fetch(`/api/enterprises/${entId}/members`, {
        query: { search: val.trim() }
      })
      const existing = new Set(members.value.map(m => String(m.userId)))
      searchResults.value = (res.users || []).filter((u: FoundUser) => !existing.has(String(u._id)))
    } catch (e: any) {
      console.error(e)
    } finally {
      searchLoading.value = false
    }
  }, 250)
})

async function grantAccess() {
  if (!selectedUser.value) return
  const entId = store.getEnterpriseId()
  addingMember.value = true
  try {
    await $fetch(`/api/enterprises/${entId}/members`, {
      method: 'POST',
      body: {
        userId: selectedUser.value._id,
        role: selectedRole.value
      }
    })
    addNotification('success', `Сотрудник ${selectedUser.value.name} добавлен`)
    addLog('info', `Выдан доступ пользователю ${selectedUser.value.name}`)
    selectedUser.value = null
    searchQuery.value = ''
    searchResults.value = []
    await loadMembers()
  } catch (e: any) {
    addNotification('error', e.data?.message || 'Ошибка добавления сотрудника')
  } finally {
    addingMember.value = false
  }
}

async function createFolderNode(
    node: FolderTemplateNode,
    parentId: string | null,
): Promise<string | null> {
  const enterpriseId = store.getEnterpriseId()
  const existing = folders.value.find(folder =>
      (folder.parentId ?? null) === parentId &&
      folder.name.trim().toLowerCase() === node.name.trim().toLowerCase()
  )

  let folderId: string
  if (existing) {
    folderId = existing.id
  } else {
    const created = await $fetch<WorkspaceFolder>('/api/workspace/folders', {
      method: 'POST',
      query: { enterpriseId },
      body: { name: node.name, parentId },
    })
    folders.value.push(created)
    folderId = created.id
  }

  if (node.children?.length) {
    for (const child of node.children) {
      await createFolderNode(child, folderId)
    }
  }
  return folderId
}

async function createSelectedFolderStructure() {
  const enterpriseId = store.getEnterpriseId()
  if (!enterpriseId || creatingFolders.value) return

  const template = selectedTemplate.value
  if (!template) return

  creatingFolders.value = true
  folderSetupError.value = null

  try {
    for (const node of template.folders) {
      await createFolderNode(node, null)
    }
    folderSetupOpen.value = false
    await loadWorkspaceFolders()
    window.dispatchEvent(
        new CustomEvent('workspace:folders-updated', {
          detail: { enterpriseId }
        })
    )
    addNotification('success', `Структура «${template.title}» создана`)
  } catch (e: any) {
    folderSetupError.value = e?.data?.message || 'Не удалось создать структуру'
    addNotification('error', folderSetupError.value)
  } finally {
    creatingFolders.value = false
  }
}

function openFolderSetup() {
  folderSetupError.value = null
  folderSetupOpen.value = true
}

function selectTemplate(id: string) {
  if (creatingFolders.value) return
  selectedTemplateId.value = id
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

onMounted(async () => {
  await store.loadEnterpriseFromStorage()
  if (store.getEnterpriseId()) {
    await Promise.all([
      loadWorkspaceFolders(),
      loadMembers()
    ])
  } else {
    addLog('warning', 'Не авторизован в предприятии')
  }
})
</script>

<template>
  <div class="control-page">
    <div v-if="!isAuthenticated" class="auth-placeholder">
      <div class="auth-icon">🔒</div>
      <h3>Вы не авторизованы</h3>
      <p>Для работы необходимо войти в предприятие</p>
      <UIMoloButton class="confirm" @click="notAuth">Войти</UIMoloButton>
    </div>

    <template v-else-if="enterpriseInfo">
      <!-- Информация о предприятии -->
      <UIMoloSection>
        <template #header>
          <span class="enterprise-title">
            {{ enterpriseInfo.ownershipForm }} {{ enterpriseInfo.enterpriseName }}
          </span>

          <div class="btn-group">
            <UIMoloButton class="confirm" @click="openWorkspace">
              Пространство
            </UIMoloButton>
            <UIMoloButton class="confirm" @click="openDirectory">
              Справочники
            </UIMoloButton>
            <UIMoloButton class="confirm" @click="openConfigurator">
              Доступ
            </UIMoloButton>
          </div>
        </template>

        <template #main>
          <div class="details">
            <section class="main-details">
              <span>ИНН: {{ enterpriseInfo.inn }}</span>
              <span>ОГРН: {{ enterpriseInfo.ogrn }}</span>
              <span>КПП: {{ enterpriseInfo.kpp }}</span>
            </section>

            <section class="director">
              <span>Директор: {{ enterpriseInfo.director }}</span>
            </section>
          </div>
        </template>
      </UIMoloSection>

      <!-- Структура пространства -->
      <UIMoloSection>
        <template #header>
          <section class="workspace-heading">
            <span>Рабочее пространство</span>
            <span v-if="!foldersLoading" class="counter">{{ folderCount }} папок</span>
          </section>

          <UIMoloButton class="small" @click="openFolderSetup">
            {{ folderCount ? 'Изменить структуру' : 'Создать структуру' }}
          </UIMoloButton>
        </template>

        <template #main>
          <UIMoloLoaders v-if="foldersLoading" wndLoader />

          <div v-else-if="folderSetupError && !folderSetupOpen" class="setup-error">
            <span>{{ folderSetupError }}</span>
            <UIMoloButton class="small" @click="loadWorkspaceFolders">
              Повторить
            </UIMoloButton>
          </div>

          <div v-else-if="folderCount === 0" class="workspace-empty">
            <div class="workspace-empty-icon">🗂️</div>
            <h3>Рабочее пространство ещё не настроено</h3>
            <p>Создайте структуру предприятия — папки будут синхронизированы с рабочим пространством.</p>
            <UIMoloButton class="confirm" @click="openFolderSetup">
              Создать структуру
            </UIMoloButton>
          </div>

          <div v-else class="folder-summary">
            <div class="folder-summary-icon">📁</div>
            <div class="folder-summary-content">
              <strong>Структура предприятия готова</strong>
              <span>{{ folderCount }} папок настроены и готовы к работе в Пространстве.</span>
            </div>
          </div>
        </template>
      </UIMoloSection>

      <!-- Блок из конфигуратора: Доступ и команда предприятия -->
      <UIMoloSection>
        <template #header>
          <section class="workspace-heading">
            <span>Команда и права доступа</span>
            <span v-if="!membersLoading" class="counter">{{ members.length }} чел.</span>
          </section>

          <UIMoloButton class="small" @click="openConfigurator">
            Управление ролями
          </UIMoloButton>
        </template>

        <template #main>
          <UIMoloLoaders v-if="membersLoading" wndLoader />

          <div v-else class="members-dashboard">
            <!-- Быстрый поиск / выдача доступа -->
            <div class="quick-add-col">
              <span class="sub-title">Быстрое добавление</span>
              <UIMoloInput
                  v-model="searchQuery"
                  compact
                  placeholder="Поиск по имени или телефону..."
              />

              <div v-if="searchLoading" class="mini-loader">Ищем в базе...</div>

              <div v-else-if="searchResults.length" class="quick-results">
                <div
                    v-for="u in searchResults"
                    :key="u._id"
                    class="quick-user-row"
                    :class="{ active: selectedUser?._id === u._id }"
                    @click="selectedUser = u"
                >
                  <div class="avatar-mini">{{ u.name.charAt(0).toUpperCase() }}</div>
                  <div class="mini-info">
                    <strong>{{ u.name }}</strong>
                    <small>{{ u.phone }}</small>
                  </div>
                </div>
              </div>

              <div v-if="selectedUser" class="quick-assign-box">
                <div class="selected-badge">Выбран: {{ selectedUser.name }}</div>
                <UIMoloSelect
                    v-model="selectedRole"
                    compact
                    :parent="availableRoles"
                    children="label"
                    valueKey="value"
                />
                <UIMoloButton
                    class="small confirm"
                    :disabled="addingMember"
                    @click="grantAccess"
                >
                  {{ addingMember ? 'Выдача...' : 'Выдать доступ' }}
                </UIMoloButton>
              </div>
            </div>

            <!-- Список участников с ролями -->
            <div class="members-list-col">
              <span class="sub-title">Текущие сотрудники</span>
              <div v-if="members.length === 0" class="empty-text">
                В предприятии пока нет добавленных участников
              </div>
              <div v-else class="members-cards-grid">
                <div
                    v-for="m in members"
                    :key="m.userId"
                    class="member-preview-card"
                >
                  <div class="member-avatar">{{ m.name.charAt(0).toUpperCase() }}</div>
                  <div class="member-texts">
                    <div class="name-line">
                      <strong>{{ m.name }}</strong>
                      <span class="role-badge" :class="m.role.toLowerCase()">{{ m.role }}</span>
                    </div>
                    <small>📞 {{ m.phone }} • {{ formatDate(m.joinedAt) }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </UIMoloSection>

      <!-- Модалка выбора структуры -->
      <UIMoloModal
          v-model="folderSetupOpen"
          title="Создадим рабочую структуру"
          width="760px"
          :loading="creatingFolders"
          confirm-text="Создать структуру"
          cancel-text="Отмена"
          :close-on-overlay="!creatingFolders"
          @confirm="createSelectedFolderStructure"
      >
        <template #body>
          <section class="setup-container">
            <div class="setup-intro">
              <p class="setup-description" style="color: white">
                Выберите основу. Папки будут созданы в Пространстве.
              </p>
            </div>

            <div class="template-grid">
              <button
                  v-for="template in folderTemplates"
                  :key="template.id"
                  type="button"
                  class="template-card"
                  :class="{ selected: selectedTemplateId === template.id }"
                  :disabled="creatingFolders"
                  @click="selectTemplate(template.id)"
              >
                <span class="template-icon">{{ template.icon }}</span>
                <span class="template-content">
                  <strong>{{ template.title }}</strong>
                  <small>{{ template.description }}</small>
                </span>
                <span class="template-check">
                  {{ selectedTemplateId === template.id ? '✓' : '' }}
                </span>
              </button>
            </div>
          </section>
        </template>

        <template #footer>
          <UIMoloButton
              class=" close"
              :disabled="creatingFolders"
              @click="folderSetupOpen = false"
          >
            Отмена
          </UIMoloButton>
          <UIMoloButton
              class="confirm "
              :disabled="creatingFolders"
              @click="createSelectedFolderStructure"
          >
            <UIMoloLoaders v-if="creatingFolders" btnLoader />
            <span v-else>Создать структуру</span>
          </UIMoloButton>
        </template>
      </UIMoloModal>
    </template>
  </div>
</template>

<style scoped>
.control-page {
  padding: 20px;
  min-height: 100%;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-sizing: border-box;
}

.enterprise-title {
  font-weight: bold;
  font-size: 20px;
}

.btn-group {
  display: flex;
  align-items: center;
}

.details {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #8e8e9e;
  justify-content: space-between;
}

.main-details {
  display: flex;
  gap: 14px;
}

.workspace-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
}

.counter {
  font-size: 12px;
  color: #6496ff;
  background: rgba(100, 150, 255, 0.12);
  padding: 2px 8px;
  border-radius: 10px;
}

.folder-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
}

.folder-summary-icon {
  font-size: 32px;
}

.folder-summary-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.folder-summary-content strong {
  font-size: 14px;
}

.folder-summary-content span {
  color: #8e8e9e;
  font-size: 13px;
}

/* Команда / Конфигуратор */
.members-dashboard {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
}

.quick-add-col,
.members-list-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sub-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #7b7b8f;
  font-weight: 700;
}

.quick-results {
  max-height: 140px;
  overflow-y: auto;
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
}

.quick-user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
}

.quick-user-row.active {
  background: rgba(100, 150, 255, 0.2);
}

.avatar-mini {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #3872ef;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.mini-info {
  display: flex;
  flex-direction: column;
  font-size: 11px;
}

.mini-loader {
  font-size: 11px;
  color: #8c8c9e;
}

.quick-assign-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(100, 150, 255, 0.05);
  border: 1px solid rgba(100, 150, 255, 0.2);
  border-radius: 6px;
}

.selected-badge {
  font-size: 11.5px;
  color: #6496ff;
  font-weight: 600;
}

.members-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.member-preview-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(135deg, #3872ef, #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.member-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name-line strong {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #aaa;
}

.role-badge.управляющий,
.role-badge.администратор {
  background: rgba(56, 114, 239, 0.2);
  color: #6496ff;
}

.role-badge.бухгалтер {
  background: rgba(30, 239, 111, 0.15);
  color: #1eef6f;
}

.member-texts small {
  font-size: 10.5px;
  color: #8c8c9e;
}

.empty-text {
  font-size: 12px;
  color: #7b7b8f;
  padding: 20px 0;
}

.setup-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.template-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.025);
  color: #e0e0e0;
  cursor: pointer;
}

.template-card.selected {
  background: rgba(100, 150, 255, 0.1);
  border-color: rgba(100, 150, 255, 0.55);
}

.template-icon {
  font-size: 24px;
}

.template-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.template-content strong {
  font-size: 13px;
}

.template-content small {
  color: #8e8e9e;
  font-size: 11px;
}

.template-check {
  margin-left: auto;
  color: #8fb1ff;
  font-weight: 700;
}

.auth-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 20px;
  background: var(--half_opacity_bg);
  border-radius: 14px;
  border: 1px solid var(--half_opacity_border);
}

.auth-icon {
  font-size: 42px;
  margin-bottom: 12px;
}

@media (max-width: 860px) {
  .members-dashboard {
    grid-template-columns: 1fr;
  }
}
</style>