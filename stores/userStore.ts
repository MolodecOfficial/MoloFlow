import {defineStore} from "pinia";
import {ref} from "vue";

export const useUserStore = defineStore('user', () => {
    const users = ref([])
    const currentUser = ref()
    const userId = ref('')
    const userName = ref('')
    const userRole = ref('')

    function setUserName(name: string): void {
        userName.value = name
        // Сохраняем в localStorage при установке имени
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const existingUser = localStorage.getItem('user');
                const userData = existingUser ? JSON.parse(existingUser) : {};
                userData.name = name;
                localStorage.setItem('user', JSON.stringify(userData));
            } catch (error) {
                console.error('Ошибка при сохранении данных пользователя:', error);
            }
        }
    }

    function setUserRole(role: string): void {
        userRole.value = role
        // Сохраняем в localStorage при установке роли
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const existingUser = localStorage.getItem('user');
                const userData = existingUser ? JSON.parse(existingUser) : {};
                userData.role = role;
                localStorage.setItem('user', JSON.stringify(userData));
            } catch (error) {
                console.error('Ошибка при сохранении данных пользователя:', error);
            }
        }
    }

    function setUser(user: { name: string, role: string }): void {
        userName.value = user.name;
        userRole.value = user.role;
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                localStorage.setItem('user', JSON.stringify(user));
            } catch (error) {
                console.error('Ошибка при сохранении данных пользователя:', error);
            }
        } else {
            console.warn('localStorage недоступен на стороне сервера');
        }
    }

    return {
        users,
        currentUser,
        userId,
        userName,
        userRole,
        setUserName,
        setUserRole,
        setUser,

    }
})