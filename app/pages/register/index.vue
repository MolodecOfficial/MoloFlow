<script setup lang="ts">
import {useRouter} from 'vue-router';

const name = ref('')
const password = ref('')
const role = ref('Пользователь')
const phone = ref('')
const loading = ref(false);
const statusMessage = ref('');

const router = useRouter();

// Функция для форматирования телефона
function formatPhone(value: string) {
  if (!value) return '+7';

  // Удаляем все нецифровые символы
  let numbers = value.replace(/\D/g, '');

  // Если номер начинается с 7 или 8, заменяем на +7
  if (numbers.startsWith('8')) {
    numbers = '7' + numbers.substring(1);
  }
  if (!numbers.startsWith('7')) {
    numbers = '7' + numbers;
  }

  // Ограничиваем длину до 11 цифр (включая 7)
  numbers = numbers.substring(0, 11);

  // Форматируем по маске +7 (XXX) XXX-XX-XX
  let formatted = '+7';
  if (numbers.length > 1) {
    formatted += ' (' + numbers.substring(1, 4);
  }
  if (numbers.length >= 5) {
    formatted += ') ' + numbers.substring(4, 7);
  }
  if (numbers.length >= 8) {
    formatted += '-' + numbers.substring(7, 9);
  }
  if (numbers.length >= 10) {
    formatted += '-' + numbers.substring(9, 11);
  }

  return formatted;
}

// Обработчик ввода телефона
function onPhoneInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const cursorPosition = input.selectionStart || 0;
  const oldValue = phone.value;

  // Форматируем новое значение
  const newValue = formatPhone(input.value);

  // Вычисляем новую позицию курсора
  let newCursorPosition = cursorPosition;

  // Если добавились автоматические символы, сдвигаем курсор
  if (newValue.length > oldValue.length) {
    newCursorPosition += newValue.length - oldValue.length;
  }

  // Обновляем значение
  phone.value = newValue;

  // Восстанавливаем позицию курсора после обновления DOM
  nextTick(() => {
    input.setSelectionRange(newCursorPosition, newCursorPosition);
  });
}

// Очистка телефона при фокусе (опционально)
function onPhoneFocus(event: Event) {
  const input = event.target as HTMLInputElement;
  if (phone.value === '+7') {
    input.setSelectionRange(2, 2);
  }
}

async function registerUser() {
  // Очищаем телефон от форматирования перед отправкой
  const cleanPhone = phone.value.replace(/\D/g, '');

  const userData = {
    name: name.value,
    password: password.value,
    role: role.value,
    phone: cleanPhone, // Отправляем только цифры
  }

  try {
    loading.value = true;
    statusMessage.value = 'Создаю пользователя...';

    const response = await fetch('/api/users/users', {
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
    <MoloGround/>

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
            <input v-model="name" class="form__field" placeholder="Имя пользователя" type="text" name="username"
                   id="username" required/>
            <label for="username" class="form__label">Имя пользователя</label>
          </div>
          <div class="form__group field">
            <input
                v-model="phone"
                @input="onPhoneInput"
                @focus="onPhoneFocus"
                class="form__field"
                placeholder="Номер телефона"
                type="tel"
                name="phone"
                id="phone"
                maxLength="18"
                required
            />
            <label for="phone" class="form__label">Номер телефона</label>
          </div>
          <div class="form__group field">
            <input v-model="password" class="form__field" placeholder="Пароль" type="password" name="password"
                   id="password" required/>
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
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
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
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