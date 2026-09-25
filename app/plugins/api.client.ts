import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
    // Хук глобального клиента $fetch в Nuxt 3
    nuxtApp.hook('app:created', () => {
        // @ts-ignore
        globalThis.$fetch =$fetch.create({
            onRequest({ options }) {
                let token = localStorage.getItem('enterprise_token') ||
                    localStorage.getItem('token') ||
                    localStorage.getItem('auth_token') || ''

                let userId = ''
                try {
                    const rawUser = localStorage.getItem('user')
                    if (rawUser) {
                        const parsed = JSON.parse(rawUser)
                        userId = parsed._id || parsed.id || ''
                        if (!token && parsed.token) {
                            token = parsed.token
                        }
                    }
                } catch {}

                options.headers = options.headers || {}

                // Передаем токен всеми возможными стандартными путями
                if (token) {
                    // @ts-ignore
                    options.headers.Authorization = `Bearer ${token}`
                    // @ts-ignore
                    options.headers['x-enterprise-token'] = token
                }
                if (userId) {
                    // @ts-ignore
                    options.headers['x-user-id'] = userId
                }
            }
        })
    })
})