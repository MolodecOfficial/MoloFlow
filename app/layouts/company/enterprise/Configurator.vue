<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAppStore } from '~~/stores/appStore'

const props = defineProps<{
  enterpriseId?: string
  windowId?: string
}>()
const emit = defineEmits(['close', 'saved'])

const { addNotification } = useNotifications('Управление доступом')
const { addLog } = useLogger('Управление доступом')
const store = useAppStore()

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

const loading = ref(false)
const searchLoading = ref(false)
const addingMember = ref(false)
const removingMember = ref(false)

const members = ref<MemberItem[]>([])
const enterpriseTitle = ref('')

const searchQuery = ref('')
const searchResults = ref<FoundUser[]>([])
const selectedUser = ref<FoundUser | null>(null)

const availableRoles = [
  { label: 'Сотрудник (базовый доступ)', value: 'Сотрудник' },
  { label: 'Бухгалтер (финансы и счета)', value: 'Бухгалтер' },
  { label: 'Администратор (полный доступ)', value: 'Администратор' },
  { label: 'Наблюдатель (только чтение)', value: 'Наблюдатель' },
  { label: 'Программист (работа с модулями)', value: 'Программист' },
  { label: 'Управляющий', value: 'Управляющий' }
]
const selectedRole = ref('Сотрудник')

const removeModalOpen = ref(false)
const memberToRemove = ref<MemberItem | null>(null)

function getEntId(): string {
  if (props.enterpriseId) return String(props.enterpriseId)
  if (store.getEnterpriseId()) return String(store.getEnterpriseId())
  const raw = localStorage.getItem('currentEnterprise')
  if (raw) {
    try {
      const p = JSON.parse(raw)
      return String(p._id || p.id || p.inn || '')
    } catch {}
  }
  return ''
}

async function loadMembers() {
  const entId = getEntId()
  if (!entId) return

  loading.value = true
  try {
    const data: any = await $fetch(`/api/enterprises/${entId}/members`)
    members.value = data.members || []
    enterpriseTitle.value = data.enterpriseName || ''
  } catch (e: any) {
    addNotification('error', e.data?.message || 'Не удалось загрузить список участников')
  } finally {
    loading.value = false
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
    const entId = getEntId()
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

function selectUserToGrant(user: FoundUser) {
  selectedUser.value = user
}

async function grantAccess() {
  if (!selectedUser.value) {
    addNotification('warning', 'Выберите пользователя из списка')
    return
  }
  const entId = getEntId()
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

function requestRemoveAccess(member: MemberItem) {
  memberToRemove.value = member
  removeModalOpen.value = true
}

async function confirmRemoveAccess() {
  if (!memberToRemove.value) return
  const entId = getEntId()
  removingMember.value = true
  try {
    await $fetch(`/api/enterprises/${entId}/members`, {
      method: 'DELETE',
      body: { userId: memberToRemove.value.userId }
    })
    addNotification('success', 'Доступ отозван')
    removeModalOpen.value = false
    memberToRemove.value = null
    await loadMembers()
  } catch (e: any) {
    addNotification('error', e.data?.message || 'Ошибка удаления')
  } finally {
    removingMember.value = false
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

onMounted(() => {
  loadMembers()
})
</script>

<template>
  <div class="manager-workspace">
    <header class="workspace-header">
      <div class="header-info">
        <span class="header-icon">🛡️</span>
        <div class="header-texts">
          <h2>Управление доступом к предприятию</h2>
          <p v-if="enterpriseTitle">{{ enterpriseTitle }}</p>
        </div>
      </div>
      <div class="header-actions">
        <UIMoloButton class="small" @click="loadMembers" :disabled="loading">
          Обновить
        </UIMoloButton>
      </div>
    </header>

    <main class="workspace-body">
      <!-- Поиск и назначение -->
      <section class="grant-pane">
        <UIMoloSection>
          <template #header>
            <span class="pane-title">Найти пользователя и выдать доступ</span>
          </template>
          <template #main>
            <div class="grant-form">
              <UIMoloInput
                  v-model="searchQuery"
                  compact
                  tLabel="Поиск зарегистрированного пользователя"
                  placeholder="Введите имя или номер телефона..."
              />

              <div v-if="searchLoading" class="search-loader">
                <UIMoloLoaders btnLoader />
                <span>Поиск в базе...</span>
              </div>

              <div v-else-if="searchQuery.trim().length >= 2 && searchResults.length === 0" class="search-empty">
                <span>Пользователь не найден. Проверьте правильность написания.</span>
              </div>

              <div v-else-if="searchResults.length > 0" class="search-results-list">
                <div
                    v-for="user in searchResults"
                    :key="user._id"
                    class="search-user-card"
                    :class="{ selected: selectedUser?._id === user._id }"
                    @click="selectUserToGrant(user)"
                >
                  <div class="user-avatar-badge">
                    {{ user.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="user-meta">
                    <strong class="user-name">{{ user.name }}</strong>
                    <span class="user-phone">📞 {{ user.phone || 'Нет телефона' }}</span>
                  </div>
                  <span class="user-role-badge">{{ user.role }}</span>
                </div>
              </div>

              <div v-if="selectedUser" class="assign-block">
                <div class="selected-user-banner">
                  <span>Выбран: <b>{{ selectedUser.name }}</b></span>
                </div>

                <UIMoloSelect
                    v-model="selectedRole"
                    compact
                    :parent="availableRoles"
                    children="label"
                    tLabel="Назначаемая роль в предприятии"
                    valueKey="value"
                />

                <UIMoloButton
                    class="confirm full"
                    :disabled="addingMember"
                    @click="grantAccess"
                >
                  <UIMoloLoaders v-if="addingMember" btnLoader />
                  <span v-else>Предоставить доступ</span>
                </UIMoloButton>
              </div>
            </div>
          </template>
        </UIMoloSection>
      </section>

      <!-- Список участников -->
      <section class="members-pane">
        <UIMoloSection>
          <template #header>
            <div class="members-header-between">
              <span class="pane-title">Участники с доступом</span>
              <span class="members-count">{{ members.length }} чел.</span>
            </div>
          </template>
          <template #main>
            <UIMoloLoaders v-if="loading" wndLoader />

            <div v-else-if="members.length === 0" class="no-members">
              <span>Доступ пока никому не предоставлен</span>
            </div>

            <div v-else class="members-list">
              <div
                  v-for="member in members"
                  :key="member.userId"
                  class="member-row"
              >
                <div class="member-avatar">
                  {{ member.name.charAt(0).toUpperCase() }}
                </div>

                <div class="member-info">
                  <div class="member-name-line">
                    <strong>{{ member.name }}</strong>
                    <span class="member-role-tag" :class="member.role.toLowerCase()">
                      {{ member.role }}
                    </span>
                  </div>
                  <div class="member-sub">
                    <span>📞 {{ member.phone }}</span>
                    <span>•</span>
                    <span>Добавлен: {{ formatDate(member.joinedAt) }}</span>
                  </div>
                </div>

                <div class="member-actions">
                  <UIMoloButton
                      class="small close"
                      title="Отозвать доступ"
                      @click="requestRemoveAccess(member)"
                  >
                    Отозвать
                  </UIMoloButton>
                </div>
              </div>
            </div>
          </template>
        </UIMoloSection>
      </section>
    </main>

    <UIMoloModal
        v-model="removeModalOpen"
        title="Отозвать доступ?"
        :modal-text="`Вы уверены, что хотите закрыть доступ для пользователя «${memberToRemove?.name}»?`"
        confirm-text="Отозвать доступ"
        cancel-text="Отмена"
        @confirm="confirmRemoveAccess"
        @cancel="memberToRemove = null"
    />
  </div>
</template>

<style scoped>
.manager-workspace {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--half_opacity_bg);
  color: #e0e0e0;
  box-sizing: border-box;
  overflow: hidden;
  padding: 16px;
  gap: 14px;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  border-radius: 12px;
  flex-shrink: 0;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 26px;
}

.header-texts h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.header-texts p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #8c8c9e;
}

.workspace-body {
  flex: 1 1 0%;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 14px;
  min-height: 0;
  overflow: hidden;
}

.grant-pane,
.members-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.grant-pane :deep(.form-section),
.members-pane :deep(.form-section) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.grant-pane :deep(.form-main),
.members-pane :deep(.form-main) {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
}

.pane-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #fff;
}

.grant-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-loader {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  font-size: 12px;
  color: #8c8c9e;
}

.search-empty {
  padding: 12px;
  font-size: 12px;
  color: #8c8c9e;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
}

.search-results-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.2);
}

.search-user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.search-user-card:hover {
  background: rgba(255, 255, 255, 0.05);
}

.search-user-card.selected {
  background: rgba(100, 150, 255, 0.15);
  border-color: #6496ff;
}

.user-avatar-badge {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #3872ef;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-phone {
  font-size: 11px;
  color: #8c8c9e;
}

.user-role-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: #aaa;
}

.assign-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: rgba(100, 150, 255, 0.05);
  border: 1px solid rgba(100, 150, 255, 0.2);
  border-radius: 8px;
}

.selected-user-banner {
  font-size: 12px;
  color: #6496ff;
}

.members-header-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.members-count {
  font-size: 12px;
  color: #6496ff;
  background: rgba(100, 150, 255, 0.12);
  padding: 2px 8px;
  border-radius: 10px;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
}

.member-avatar {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3872ef, #7c3aed);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.member-name-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-name-line strong {
  font-size: 14px;
  color: #fff;
}

.member-role-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #aaa;
}

.member-role-tag.управляющий,
.member-role-tag.администратор {
  background: rgba(56, 114, 239, 0.2);
  color: #6496ff;
}

.member-role-tag.бухгалтер {
  background: rgba(30, 239, 111, 0.15);
  color: #1eef6f;
}

.member-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #8c8c9e;
}

.no-members {
  padding: 40px;
  text-align: center;
  color: #8c8c9e;
  font-size: 13px;
}

@media (max-width: 860px) {
  .workspace-body {
    grid-template-columns: 1fr;
  }
}
</style>