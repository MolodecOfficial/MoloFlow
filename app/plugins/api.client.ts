import { defineNuxtPlugin } from '#app'
import { ofetch } from 'ofetch'

export default defineNuxtPlugin(() => {
    function resolveClientEnterpriseId(): string {
        if (typeof window === 'undefined') return ''
        try {
            const raw = localStorage.getItem('currentEnterprise')
            if (raw) {
                const parsed = JSON.parse(raw)
                const id = parsed?._id || parsed?.id
                if (id) return String(id).trim()
            }
        } catch {}

        try {
            const token = localStorage.getItem('enterprise_token') || localStorage.getItem('token')
            if (token && token.includes('.')) {
                const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
                if (payload?.enterpriseId) return String(payload.enterpriseId).trim()
            }
        } catch {}

        return ''
    }

    function resolveClientUser(): { token: string; userId: string } {
        if (typeof window === 'undefined') return { token: '', userId: '' }
        let token = localStorage.getItem('enterprise_token') || localStorage.getItem('token') || ''
        let userId = ''
        try {
            const rawUser = localStorage.getItem('user')
            if (rawUser) {
                const parsed = JSON.parse(rawUser)
                userId = String(parsed._id || parsed.id || '')
                if (!token && parsed.token) token = parsed.token
            }
        } catch {}
        return { token, userId }
    }

    const customFetch = ofetch.create({
        onRequest({ options }) {
            const headers: Record<string, string> = {}

            if (options.headers instanceof Headers) {
                options.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })
            } else if (Array.isArray(options.headers)) {
                options.headers.forEach(([k, v]) => { headers[k.toLowerCase()] = String(v) })
            } else if (options.headers) {
                Object.entries(options.headers).forEach(([k, v]) => { headers[k.toLowerCase()] = String(v) })
            }

            const entId = resolveClientEnterpriseId()
            if (entId && !headers['x-enterprise-id']) {
                headers['x-enterprise-id'] = entId
            }

            const { token, userId } = resolveClientUser()
            if (token) {
                if (!headers['authorization']) headers['authorization'] = `Bearer ${token}`
                if (!headers['x-enterprise-token']) headers['x-enterprise-token'] = token
            }
            if (userId && !headers['x-user-id']) {
                headers['x-user-id'] = userId
            }

            options.headers = headers
        }
    })

    globalThis.$fetch = customFetch
})
