<script setup lang="ts">
import { useRouter } from 'vue-router';

const name = ref('')
const password = ref('')
const role = ref('Пользователь')
const loading = ref(false);
const statusMessage = ref('');

const router = useRouter();

async function registerUser() {
  const userData = {
    name: name.value,
    password: password.value,
    role: role.value,
  }
  try {
    loading.value = true;
    statusMessage.value = 'Создаю пользователя...';

    const response = await fetch('/api/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    if (response.ok) {
      const data = await response.json();
      statusMessage.value = data.message || 'Пользователь успешно зарегистрирован';
      console.log(`ID пользователя - ${data.user._id}`)
      console.log(`Роль пользователя - ${data.user.role}`)
      setTimeout(() => router.push('/'), 2000);
    } else {
      const errorData = await response.json();
      statusMessage.value = errorData.message || 'Произошла ошибка при регистрации';
    }
  } catch (error) {
    console.error('Ошибка:', error);
    statusMessage.value = 'Произошла ошибка при регистрации';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth-container">
    <section class="blob">
      <div id="bg-wrap">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="Gradient1" cx="50%" cy="50%" fx="0.441602%" fy="50%" r=".5">
              <animate attributeName="fx" dur="34s" values="0%;3%;0%" repeatCount="indefinite"></animate>
              <stop offset="0%" stop-color="rgba(255, 0, 255, 1)"></stop>
              <stop offset="100%" stop-color="rgba(255, 0, 255, 0)"></stop>
            </radialGradient>
            <radialGradient id="Gradient2" cx="50%" cy="50%" fx="2.68147%" fy="50%" r=".5">
              <animate attributeName="fx" dur="23.5s" values="0%;3%;0%" repeatCount="indefinite"></animate>
              <stop offset="0%" stop-color="rgba(255, 255, 0, 1)"></stop>
              <stop offset="100%" stop-color="rgba(255, 255, 0, 0)"></stop>
            </radialGradient>
            <radialGradient id="Gradient3" cx="50%" cy="50%" fx="0.836536%" fy="50%" r=".5">
              <animate attributeName="fx" dur="21.5s" values="0%;3%;0%" repeatCount="indefinite"></animate>
              <stop offset="0%" stop-color="rgba(0, 255, 255, 1)"></stop>
              <stop offset="100%" stop-color="rgba(0, 255, 255, 0)"></stop>
            </radialGradient>
            <radialGradient id="Gradient4" cx="50%" cy="50%" fx="4.56417%" fy="50%" r=".5">
              <animate attributeName="fx" dur="23s" values="0%;5%;0%" repeatCount="indefinite"></animate>
              <stop offset="0%" stop-color="rgba(0, 255, 0, 1)"></stop>
              <stop offset="100%" stop-color="rgba(0, 255, 0, 0)"></stop>
            </radialGradient>
            <radialGradient id="Gradient5" cx="50%" cy="50%" fx="2.65405%" fy="50%" r=".5">
              <animate attributeName="fx" dur="24.5s" values="0%;5%;0%" repeatCount="indefinite"></animate>
              <stop offset="0%" stop-color="rgba(0,0,255, 1)"></stop>
              <stop offset="100%" stop-color="rgba(0,0,255, 0)"></stop>
            </radialGradient>
            <radialGradient id="Gradient6" cx="50%" cy="50%" fx="0.981338%" fy="50%" r=".5">
              <animate attributeName="fx" dur="25.5s" values="0%;5%;0%" repeatCount="indefinite"></animate>
              <stop offset="0%" stop-color="rgba(255,0,0, 1)"></stop>
              <stop offset="100%" stop-color="rgba(255,0,0, 0)"></stop>
            </radialGradient>
          </defs>
          <rect x="13.744%" y="1.18473%" width="100%" height="100%" fill="url(#Gradient1)"
                transform="rotate(334.41 50 50)">
            <animate attributeName="x" dur="20s" values="25%;0%;25%" repeatCount="indefinite"></animate>
            <animate attributeName="y" dur="21s" values="0%;25%;0%" repeatCount="indefinite"></animate>
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="7s"
                              repeatCount="indefinite"></animateTransform>
          </rect>
          <rect x="-2.17916%" y="35.4267%" width="100%" height="100%" fill="url(#Gradient2)"
                transform="rotate(255.072 50 50)">
            <animate attributeName="x" dur="23s" values="-25%;0%;-25%" repeatCount="indefinite"></animate>
            <animate attributeName="y" dur="24s" values="0%;50%;0%" repeatCount="indefinite"></animate>
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="12s"
                              repeatCount="indefinite"></animateTransform>
          </rect>
          <rect x="9.00483%" y="14.5733%" width="100%" height="100%" fill="url(#Gradient3)"
                transform="rotate(139.903 50 50)">
            <animate attributeName="x" dur="25s" values="0%;25%;0%" repeatCount="indefinite"></animate>
            <animate attributeName="y" dur="12s" values="0%;25%;0%" repeatCount="indefinite"></animate>
            <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="9s"
                              repeatCount="indefinite"></animateTransform>
          </rect>
        </svg>
      </div>
    </section>

    <section class="auth-main-container">
      <section class="auth-header">
        <section class="auth-nav">
          <span>MoloFlow</span>
        </section>
      </section>

      <section class="auth-form">
        <span>Создайте нового пользователя</span>
        <section class="auth-login">
          <div class="form__group field">
            <input v-model="name" class="form__field" placeholder="Имя пользователя" type="text" name="username" id="username" required/>
            <label for="username" class="form__label">Имя пользователя</label>
          </div>
          <div class="form__group field">
            <input v-model="password" class="form__field" placeholder="Пароль" type="password" name="password" id="password" required/>
            <label for="password" class="form__label">Пароль</label>
          </div>
        </section>
      </section>

      <section class="auth-footer">
        <section class="login_status">
          <button class="login" @click="registerUser" :disabled="loading">
            <div v-if="loading" class="modern-loader"></div>
            <span v-else>Регистрация</span>
          </button>
          <span class="status">{{ statusMessage }}</span>
        </section>
        <NuxtLink to="/" class="back">Вернуться обратно</NuxtLink>
      </section>
    </section>
  </section>
</template>

<style scoped>
/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.modern-loader {
  width: 14px;
  height: 14px;
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
  overflow: hidden;
}

.auth-header {
  font-size: 24px;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}

.blob {
  position: fixed; /* Фиксируем блоб */
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
  display: flex;
  text-align: center;
  flex-direction: column;
  align-items: start;
  gap: 20px;
  flex: 1;
  overflow: hidden;
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
  flex-direction: row;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
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

.login {
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

.login:hover:not(:disabled) {
  border-color: var(--half_opacity_border_hover);
}



.login:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.back {
  color: white;
  text-underline-offset: 3px;
  text-decoration: none;
  transition: color 0.3s ease;
  text-align: center;
  flex-shrink: 0;
}

.back:hover {
  color: var(--half_opacity_border_hover);
}

body {
  overflow: hidden;
}
</style>