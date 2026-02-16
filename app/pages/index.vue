<script setup lang="ts">
import {useUserStore} from "~~/stores/userStore";

const selected = ref('')
const statusMessage = ref('')
const loading = ref(false)
const name = ref('')
const storageName = ref('')
const password = ref('')
const router = useRouter()
const dropdownOpen = ref(false)
const checkingAuth = ref(true) // Флаг для проверки авторизации

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

    if (response.ok) {
      const data = await response.json();

      userStore.setUser({
        name: data.user.name,
        role: data.user.role
      })

      // Сохраняем последний тип входа для автоматического редиректа
      localStorage.setItem('lastLoginType', selected.value);

      setTimeout(() => router.push(
          selected.value === 'Бухгалтерия' ? '/accountancy' :
              selected.value === 'Склад' ? '/storage' :
                  selected.value === 'Предприятие' ? '/enterprise' : '/'
      ), 1500);
      statusMessage.value = `Успешно, ${data.message}`;
    } else {
      const errorData = await response.json();
      statusMessage.value = errorData.message || 'Ошибка при входе';
    }
  } catch (error) {
    console.error('Ошибка:', error);
    statusMessage.value = 'Произошла ошибка при входе';
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

      // Если есть последний тип входа, делаем автоматический редирект
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

function deleteUser() {
  localStorage.removeItem('user');
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

        <!-- Круговой лоадер при проверке авторизации -->
        <div v-if="checkingAuth" class="auth-check-loader">
          <div class="modern-loader"></div>

        </div>

        <!-- Отображение информации о пользователе или выбор модуля -->
        <template v-else>
          <section v-if="storageName" class="user-info-section">
            <span class="storage">Вы уже вошли как {{ storageName }}</span>
            <span>Перенаправляю...</span>
          </section>

          <!-- Кастомный dropdown -->
          <div v-else class="custom-dropdown">
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

      <section v-show="selected && !checkingAuth && !storageName" class="auth-form">
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

      <section class="auth-footer" v-if="selected && !checkingAuth && !storageName">
        <section class="login_status">
          <button class="login-btn" @click="loginUser" :disabled="loading">
            <div v-if="loading" class="modern-loader"></div>
            <span v-else>Выполнить вход</span>
          </button>
          <span class="status">{{ statusMessage }}</span>
        </section>
        <NuxtLink to="/register" class="new_user">Новый аккаунт</NuxtLink>
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
  box-shadow: 0 0 0 2px rgba(56, 239, 125, 0.2);
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
  background-color: rgba(56, 239, 125, 0.1);
  color: var(--half_opacity_border_hover);
}

.dropdown-item.selected {
  background-color: rgba(56, 239, 125, 0.15);
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

.delete-btn {
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
  width: 100%;
  height: 50px;
  min-width: 120px;
  min-height: 40px;
  transition: all 0.3s ease;
  font-family: inherit;
  font-size: inherit;
  flex-shrink: 0;
}

.delete-btn:hover:not(:disabled) {
  border-color: #38ef7d;
}

.delete-btn:disabled {
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
  color: #38ef7d;
}

/* Адаптивность */
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