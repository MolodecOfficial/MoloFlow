<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useHead } from '#imports'
import { useAppStore } from '~~/stores/appStore'
import type { PermissionKey } from '~/types/permissions'
import logo from '~~/public/logo.ico'
import error from '~~/public/error.svg'

interface Props {
  allowedRoles?: string[]
  requiredPermission?: PermissionKey
}

const props = withDefaults(defineProps<Props>(), {
  allowedRoles: () => [],
  requiredPermission: undefined
})

const router = useRouter()
const appStore = useAppStore()

// Не даём странице мигать белым, пока идёт проверка
useHead({ bodyAttrs: { style: 'background:#070b14' } })

const MIN_CHECK_MS = 900

const loading = ref(true)
const step = ref(0)
const revoked = ref(false)
/** Не удалось сверить права с базой — в таком случае НЕ пускаем по устаревшим данным */
const verifyError = ref<string | null>(null)
const attempt = ref(1)

const MAX_ATTEMPTS = 3

const steps = [
  'Проверяем сессию…',
  'Сверяем права с базой данных…',
  'Готовим рабочее пространство…'
]
const stepText = computed(() => {
  const base = steps[Math.min(step.value, steps.length - 1)]
  return attempt.value > 1 ? `${base} (попытка ${attempt.value} из ${MAX_ATTEMPTS})` : base
})
const progress = computed(() => `${Math.round(((step.value + 1) / steps.length) * 100)}%`)

const activeRole = computed(() => {
  return appStore.currentMemberRole || appStore.currentUser?.role || 'Гость'
})

const hasAccess = computed(() => {
  if (loading.value) return false
  if (revoked.value) return false
  if (verifyError.value) return false

  const roleOk =
      props.allowedRoles.length === 0 ||
      activeRole.value === 'Администратор' ||
      props.allowedRoles.includes(activeRole.value)

  const permissionOk = !props.requiredPermission || appStore.hasPermission(props.requiredPermission)

  return roleOk && permissionOk
})

const deniedText = computed(() =>
    revoked.value
        ? 'Доступ к этому предприятию у вас отозван'
        : `У вашей роли (${activeRole.value}) недостаточно прав для входа`
)

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const loadAccess = async () => {
  loading.value = true
  step.value = 0
  attempt.value = 1
  revoked.value = false
  verifyError.value = null
  const startedAt = Date.now()

  try {
    appStore.loadEnterpriseFromStorage()
    await wait(250)
    step.value = 1

    // Роль берём из базы (через сервер), а не из устаревшей копии в localStorage.
    // Пока проверка не удалась — внутрь не пускаем.
    let result = await appStore.refreshAccess()
    while ((result === 'offline' || result === 'unauthorized') && attempt.value < MAX_ATTEMPTS) {
      await wait(700 * attempt.value)
      attempt.value++
      result = await appStore.refreshAccess()
    }

    if (result === 'revoked') {
      revoked.value = true
    } else if (result === 'offline' || result === 'unauthorized') {
      verifyError.value = appStore.accessError || 'сервер не ответил'
    }
    step.value = 2
  } catch (err: any) {
    console.error('[MoloGuard] Ошибка проверки прав:', err)
    verifyError.value = err?.message || 'неизвестная ошибка'
  } finally {
    // Показываем экран проверки не меньше MIN_CHECK_MS, чтобы он не мелькал
    const left = MIN_CHECK_MS - (Date.now() - startedAt)
    if (left > 0) await wait(left)
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}

const goToLogin = () => {
  appStore.clearSession()
  router.push('/')
}

onMounted(() => {
  loadAccess()
})
</script>

<template>
  <div class="molo-guard">
    <div v-if="loading" class="guard-overlay" role="status" aria-live="polite">
      <div class="guard-glow"></div>

      <div class="guard-center">
        <div class="logo-wrap">
          <img :src="logo" class="guard-logo" alt="MoloLab" />
        </div>

        <h2 class="guard-title">Проверка доступа</h2>
        <p class="guard-step">{{ stepText }}</p>

        <div class="guard-bar">
          <div class="guard-bar-fill" :style="{ width: progress }"></div>
        </div>
      </div>
    </div>

    <div v-else-if="hasAccess">
      <slot />
    </div>

    <div v-else-if="verifyError" class="access-denied-page">
      <div class="denied-container">
        <img :src="error" alt="Проверка не пройдена">
        <h1 class="warn">Не удалось проверить права</h1>
        <p>Сервер не подтвердил ваши права доступа, поэтому вход приостановлен.</p>
        <p class="detail">{{ verifyError }}</p>
        <div class="actions">
          <UIMoloButton @click="goToLogin" class="close">На главную</UIMoloButton>
          <UIMoloButton @click="loadAccess" class="confirm">Повторить</UIMoloButton>
        </div>
      </div>
    </div>

    <div v-else class="access-denied-page">
      <div class="denied-container">
        <img :src="error" alt="Доступ запрещен">
        <h1>Доступ запрещен</h1>
        <p>{{ deniedText }}</p>
        <div class="actions">
          <UIMoloButton @click="goBack" class="close">Назад</UIMoloButton>
          <UIMoloButton @click="goToLogin" class="confirm">На главную</UIMoloButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Цвета заданы напрямую: CSS-переменные темы могут быть ещё не загружены */
.guard-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #070b14 0%, #0d1424 55%, #0b1220 100%);
  color: #ffffff;
  overflow: hidden;
}

.guard-glow {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.16), rgba(74, 222, 128, 0.08) 45%, transparent 70%);
  filter: blur(30px);
  animation: glow 3.2s ease-in-out infinite;
}

.guard-center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
}

.logo-wrap {
  width: 112px;
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: breathe 2.4s ease-in-out infinite;
}

.guard-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.guard-title {
  margin: 22px 0 4px;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.guard-step {
  margin: 0;
  min-height: 1.4em;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.55);
}

.guard-bar {
  margin-top: 22px;
  width: 220px;
  height: 3px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.guard-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #22d3ee, #4ade80);
  transition: width 0.45s ease;
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.92; }
  50% { transform: scale(1.06); opacity: 1; }
}

@keyframes glow {
  0%, 100% { opacity: 0.6; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1.05); }
}

@media (prefers-reduced-motion: reduce) {
  .logo-wrap, .guard-glow { animation: none; }
  .guard-bar-fill { transition: none; }
}

.access-denied-page {
  background-color: #020b18;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.denied-container {
  text-align: center;
  color: white;
  max-width: 420px;
  padding: 24px;
  border-radius: 12px;
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
}

.denied-container h1 {
  font-size: 1.8rem;
  margin: 12px 0 6px;
  color: #ff4444;
}

.denied-container h1.warn {
  color: #f5a524;
  font-size: 1.4rem;
}

.denied-container p.detail {
  font-size: 0.8rem;
  opacity: 0.5;
  word-break: break-word;
  margin-top: -6px;
}

.denied-container p {
  font-size: 1rem;
  opacity: 0.8;
  margin: 10px 0 20px;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>