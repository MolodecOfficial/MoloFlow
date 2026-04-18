<script setup lang="ts">
import {useUserStore} from "~~/stores/userStore";
import QRCode from 'qrcode';

const selected = ref('')
const statusMessage = ref('')
const loading = ref(false)
const name = ref('')
const storageName = ref('')
const password = ref('')
const router = useRouter()
const dropdownOpen = ref(false)
const checkingAuth = ref(true)

// Состояния для 2FA
const step = ref<'login' | 'setup-2fa' | 'verify-2fa'>('login')
const userId = ref('')
const verificationCode = ref('')
const twoFactorSecret = ref('')
const twoFactorQR = ref('')
const isFirstTime = ref(false)

const userStore = useUserStore()

const pageTitle = computed(() =>
    selected.value ? `Вход в ${selected.value}` : 'Вход в систему'
)

useHead({
  title: pageTitle
})

const loginOptions = [
  {value: '', label: 'Выберите вход', disabled: true},
  {value: 'Предприятие', label: 'Предприятие'},
  {value: 'Склад', label: 'Склад'},
  {value: 'Бухгалтерия', label: 'Бухгалтерия'}
]

function selectOption(option: {value: string, label: string, disabled?: boolean}) {
  if (option.disabled) return;
  selected.value = option.value;
  dropdownOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.custom-dropdown')) {
    dropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Возврат к форме входа
function backToLogin() {
  step.value = 'login'
  verificationCode.value = ''
  statusMessage.value = ''
}

async function loginUser() {
  const userData = {
    name: name.value,
    password: password.value,
    loginType: selected.value
  };

  if (!userData.name || !userData.password || !userData.loginType) {
    statusMessage.value = 'Заполните все поля';
    return;
  }

  try {
    loading.value = true;
    statusMessage.value = 'Произвожу вход...';

    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (response.ok) {
      userId.value = data.userId;
      isFirstTime.value = data.isFirstTime || false;

      if (data.isFirstTime) {
        // Первый вход - показываем QR код для настройки
        twoFactorSecret.value = data.secret;
        const otpauth = `otpauth://totp/MoloFlow:${name.value}?secret=${data.secret}&issuer=MoloFlow`;
        twoFactorQR.value = await QRCode.toDataURL(otpauth);
        step.value = 'setup-2fa';
        statusMessage.value = 'Отсканируйте QR-код в Google Authenticator';
      } else {
        // Обычный вход - просим код
        step.value = 'verify-2fa';
        statusMessage.value = '';
      }
    } else {
      statusMessage.value = data.message || 'Ошибка при входе';
    }
  } catch (error) {
    console.error('Ошибка:', error);
    statusMessage.value = 'Произошла ошибка при входе';
  } finally {
    loading.value = false;
  }
}

async function verify2FA() {
  if (!verificationCode.value || verificationCode.value.length !== 6) {
    statusMessage.value = 'Введите 6-значный код';
    return;
  }

  if (!/^\d+$/.test(verificationCode.value)) {
    statusMessage.value = 'Код должен содержать только цифры';
    return;
  }

  try {
    loading.value = true;
    statusMessage.value = 'Проверяю код...';

    const response = await fetch('/api/users/2fa-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId.value,
        token: verificationCode.value,
        loginType: selected.value,
        isFirstTime: isFirstTime.value
      })
    });

    const data = await response.json();

    if (response.ok) {
      userStore.setUser({
        name: data.user.name,
        role: data.user.role
      })

      localStorage.setItem('lastLoginType', selected.value);

      statusMessage.value = `Успешно, ${name.value}`;
      setTimeout(() => router.push(
          selected.value === 'Бухгалтерия' ? '/accountancy' :
              selected.value === 'Склад' ? '/storage' :
                  selected.value === 'Предприятие' ? '/enterprise' : '/'
      ), 1500);
    } else {
      statusMessage.value = data.message || 'Неверный код';
    }
  } catch (error) {
    console.error('Ошибка:', error);
    statusMessage.value = 'Произошла ошибка при проверке кода';
  } finally {
    loading.value = false;
  }
}

async function getUser() {
  checkingAuth.value = true;
  const storageUser = localStorage.getItem('user')
  const lastLoginType = localStorage.getItem('lastLoginType')

  if (storageUser) {
    try {
      const user = JSON.parse(storageUser)
      storageName.value = user.name
      console.log("Текущий пользователь в хранилище: " + user.name)

      if (lastLoginType) {
        console.log("Последний тип входа: " + lastLoginType)
        setTimeout(() => {
          router.push(
              lastLoginType === 'Бухгалтерия' ? '/accountancy' :
                  lastLoginType === 'Склад' ? '/storage' :
                      lastLoginType === 'Предприятие' ? '/enterprise' : '/'
          )
        }, 2500)
      }
    } catch (error) {
      console.error(error)
    } finally {
      checkingAuth.value = false;
    }
  } else {
    checkingAuth.value = false;
  }
}

onMounted(() => {
  getUser()
})
</script>

<template>
  <section class="auth-container">
    <MoloGround/>
    <section class="auth-main-container">
      <section class="auth-header">
        <section class="auth-nav">
          <span class="logo">MoloFlow</span>
          <span v-if="selected" class="selected-module"> - {{ selected }}</span>
        </section>

        <div v-if="checkingAuth" class="auth-check-loader">
          <div class="modern-loader"></div>
        </div>

        <template v-else>
          <section v-if="storageName" class="user-info-section">
            <span class="storage">Вы уже вошли как {{ storageName }}</span>
            <span>Перенаправляю...</span>
          </section>

          <div v-else-if="step === 'login'" class="custom-dropdown">
            <div
                class="dropdown-trigger"
                :class="{ 'dropdown-open': dropdownOpen }"
                @click="dropdownOpen = !dropdownOpen"
            >
              <span class="dropdown-selected">
                {{ selected ? loginOptions.find(opt => opt.value === selected)?.label : 'Выберите вход' }}
              </span>
              <div class="dropdown-arrow" :class="{ 'rotated': dropdownOpen }">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>

            <transition name="dropdown">
              <div v-if="dropdownOpen" class="dropdown-menu">
                <div
                    v-for="option in loginOptions"
                    :key="option.value"
                    class="dropdown-item"
                    :class="{
                    'disabled': option.disabled,
                    'selected': option.value === selected
                  }"
                    @click="selectOption(option)"
                >
                  {{ option.label }}
                </div>
              </div>
            </transition>
          </div>
        </template>
      </section>

      <!-- ШАГ 1: Форма входа - показываем ТОЛЬКО когда выбран модуль -->
      <section v-if="step === 'login' && selected && !checkingAuth && !storageName" class="auth-form">
        <span class="welcome-text">Добро пожаловать. Выполните вход в систему</span>
        <section class="auth-login">
          <div class="form__group field">
            <input v-model="name" class="form__field" placeholder="Имя пользователя" name="username" id='username' required/>
            <label for="username" class="form__label">Имя пользователя</label>
          </div>
          <div class="form__group field">
            <input v-model="password" class="form__field" placeholder="Пароль" type="password" name="password" id='password' required/>
            <label for="password" class="form__label">Пароль</label>
          </div>
        </section>
      </section>

      <!-- ШАГ 2: Настройка 2FA (первый вход) -->
      <section v-else-if="step === 'setup-2fa'" class="auth-form">
        <span class="welcome-text">Настройка двухфакторной защиты</span>
        <section class="auth-login">
          <div class="qr-container">
            <img :src="twoFactorQR" alt="QR Code" class="qr-code" />
          </div>

          <div class="secret-box">
            <code>{{ twoFactorSecret }}</code>
            <button class="copy-btn" @click="navigator.clipboard.writeText(twoFactorSecret)">
              Копировать
            </button>
          </div>

          <p class="setup-instruction">
            1. Установите Google Authenticator<br>
            2. Отсканируйте QR-код или введите ключ вручную<br>
            3. Введите 6-значный код для подтверждения
          </p>

          <div class="form__group field">
            <input
                v-model="verificationCode"
                class="form__field"
                placeholder="6-значный код"
                type="text"
                name="code"
                id="code"
                maxlength="6"
                required
                autofocus
                :disabled="loading"
            />
            <label for="code" class="form__label">Код из приложения</label>
          </div>
        </section>
      </section>

      <!-- ШАГ 3: Обычная проверка 2FA -->
      <section v-else-if="step === 'verify-2fa'" class="auth-form">
        <span class="welcome-text">Двухфакторная аутентификация</span>
        <section class="auth-login">
          <div class="form__group field">
            <input
                v-model="verificationCode"
                class="form__field"
                placeholder="6-значный код"
                type="text"
                name="code"
                id="code"
                maxlength="6"
                required
                autofocus
                :disabled="loading"
            />
            <label for="code" class="form__label">Код из Google Authenticator</label>
          </div>

          <button class="back-to-login" @click="backToLogin" :disabled="loading">
            Вернуться к входу
          </button>
        </section>
      </section>

      <!-- Футер - показываем ТОЛЬКО когда выбран модуль или мы на шагах 2FA -->
      <section class="auth-footer" v-if="!checkingAuth && !storageName && (selected || step !== 'login')">
        <section class="login_status">
          <!-- Кнопка для шага входа - только если выбран модуль -->
          <button
              v-if="step === 'login' && selected"
              class="login-btn"
              @click="loginUser"
              :disabled="!name || !password || loading"
          >
            <div v-if="loading" class="modern-loader"></div>
            <span v-else>Выполнить вход</span>
          </button>

          <!-- Кнопка для шагов 2FA -->
          <button
              v-if="step === 'setup-2fa' || step === 'verify-2fa'"
              class="login-btn"
              @click="verify2FA"
              :disabled="verificationCode.length !== 6 || loading"
          >
            <div v-if="loading" class="modern-loader"></div>
            <span v-else>Подтвердить</span>
          </button>

          <!-- Статус сообщение - показываем только если есть сообщение и мы на нужном шаге -->
          <span v-if="((step === 'login') || step !== 'login')"
                class="status">{{ statusMessage }}</span>
        </section>

        <!-- Ссылка на регистрацию - только на шаге входа и когда выбран модуль -->
        <NuxtLink v-if="step === 'login' && selected" to="/register" class="new_user">
          Новый аккаунт
        </NuxtLink>
      </section>
    </section>
  </section>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.modern-loader {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid #ffffff;
  border-right: 2px solid #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.auth-container {
  display: flex;
  width: 100%;
  height: 100vh;
  justify-content: center;
  align-items: center;
  background: #020b18;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.auth-main-container {
  display: flex;
  flex-direction: column;
  color: whitesmoke;
  background-color: var(--half_opacity_bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--half_opacity_border);
  width: 420px;
  border-radius: 16px;
  padding: 24px;
  gap: 24px;
  max-height: 90vh;
}

.auth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  gap: 20px;
}

.logo {
  font-size: 24px;
  font-weight: 600;
  color: white;
}

.user-info-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.storage {
  font-size: 14px;
}

.selected-module {
  font-size: 18px;
  color: var(--half_opacity_border_hover);
  font-weight: 500;
}

.custom-dropdown {
  position: relative;
  min-width: 160px;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--half_opacity_border);
  color: white;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.dropdown-trigger:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: var(--half_opacity_border_hover);
}

.dropdown-trigger.dropdown-open {
  border-color: var(--half_opacity_border_hover);
  box-shadow: 0 0 0 2px rgba(56, 114, 239, 0.2);
}

.dropdown-selected {
  flex: 1;
}

.dropdown-arrow {
  transition: transform 0.3s ease;
  margin-left: 8px;
  color: rgba(255, 255, 255, 0.7);
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #494c4f;
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  margin-top: 4px;
  overflow: hidden;
  z-index: 2;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.dropdown-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover:not(.disabled) {
  background-color: rgba(56, 120, 239, 0.1);
  color: var(--half_opacity_border_hover);
}

.dropdown-item.selected {
  background-color: rgba(56, 129, 239, 0.15);
  color: var(--half_opacity_border_hover);
}

.dropdown-item.disabled {
  color: rgba(255, 255, 255, 0.4);
  cursor: not-allowed;
  background-color: transparent;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.3s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

option {
  background: #020b18;
  color: whitesmoke;
  padding: 8px;
}

.blob {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: -1;
  --size: 750px;
  --speed: 50s;
  --easing: cubic-bezier(0.8, 0.2, 0.2, 0.8);
  width: var(--size);
  height: var(--size);
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  overflow: hidden;
  filter: blur(calc(var(--size) / 5));
  animation: rotate var(--speed) var(--easing) alternate infinite;
  opacity: 0.3;
}

@keyframes rotate {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.auth-form {
  transition: all 0.3s ease-in-out;
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 20px;
  flex: 1;
  overflow: hidden;
}

.welcome-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  width: 100%;
}

.auth-login {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: whitesmoke;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--half_opacity_border);
  border-radius: 12px;
  padding: 20px;
  width: 100%;
  flex-shrink: 0;
}

.form__group {
  position: relative;
  padding: 8px 0;
  width: 100%;
}

.form__field {
  width: 100%;
  border: 0;
  border-bottom: 2px solid rgba(255, 255, 255, 0.3);
  outline: 0;
  font-size: 16px;
  color: white;
  padding: 8px 0;
  background: transparent;
  transition: border-color 0.3s ease;
}

.form__field::placeholder {
  color: transparent;
}

.form__field:placeholder-shown ~ .form__label {
  font-size: 16px;
  cursor: text;
  top: 12px;
}

.form__label {
  position: absolute;
  top: 0;
  display: block;
  transition: 0.3s ease;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  pointer-events: none;
}

.form__field:focus {
  padding-bottom: 8px;
  border-width: 2px;
  border-image-slice: 1;
}

.form__field:focus ~ .form__label {
  position: absolute;
  top: -8px;
  display: block;
  transition: 0.3s ease;
  font-size: 12px;
  color: var(--half_opacity_border_hover);
}

.form__field:required, .form__field:invalid {
  box-shadow: none;
}

.back-to-login {
  background: transparent;
  border: 1px solid var(--half_opacity_border);
  color: rgba(255, 255, 255, 0.7);
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  margin-top: 5px;
}

.back-to-login:hover:not(:disabled) {
  border-color: var(--half_opacity_border_hover);
  color: white;
}

.back-to-login:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-footer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
}

.login_status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.status {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-size: 14px;
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  flex: 1;
  background-color: rgba(255, 255, 255, 0.08);
  padding: 10px;
  min-height: 40px;
  word-break: break-word;
  overflow-wrap: break-word;
}

.login-btn {
  cursor: pointer;
  color: white;
  text-decoration: none;
  padding: 10px 15px;
  border: 1px solid var(--half_opacity_border);
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  min-height: 40px;
  transition: all 0.3s ease;
  font-family: inherit;
  font-size: inherit;
  flex-shrink: 0;
}

.login-btn:hover:not(:disabled) {
  border-color: var(--half_opacity_border_hover);
}

.login-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
  box-shadow: none;
}

.new_user {
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: color 0.3s ease;
  border-radius: 6px;
}

.new_user:hover {
  color: var(--borber-color_main);
}

.qr-container {
  display: flex;
  justify-content: center;
  margin: 10px 0;
  padding: 15px;
  background: transparent;
  border-radius: 8px;
}

.qr-code {
  width: 150px;
  height: 150px;
}

.secret-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.3);
  padding: 10px;
  border-radius: 4px;
  border: 1px solid var(--half_opacity_border);
}

.secret-box code {
  font-size: 14px;
  color: #1eef6f;
  letter-spacing: 1px;
  word-break: break-all;
}

.copy-btn {
  background: transparent;
  border: 1px solid var(--half_opacity_border);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.copy-btn:hover {
  border-color: #1eef6f;
  color: #1eef6f;
}

.setup-instruction {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  text-align: center;
  margin: 10px 0;
}

.back-to-login {
  background: transparent;
  border: 1px solid var(--half_opacity_border);
  color: rgba(255, 255, 255, 0.7);
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  margin-top: 5px;
}

.back-to-login:hover:not(:disabled) {
  border-color: var(--half_opacity_border_hover);
  color: white;
}

@media (max-width: 480px) {
  .auth-main-container {
    width: 90%;
    margin: 20px;
    padding: 20px;
  }

  .auth-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .custom-dropdown {
    min-width: auto;
    width: 100%;
  }

  .dropdown-trigger {
    width: 100%;
  }
}
</style>