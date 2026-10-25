function decodeJwtPayload(token: string): any | null {
    try {
        const part = token.split('.')[1]
        if (!part) return null
        const json = decodeURIComponent(
            atob(part.replace(/-/g, '+').replace(/_/g, '/'))
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        )
        return JSON.parse(json)
    } catch {
        return null
    }
}

export function resolveAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('token') || localStorage.getItem('enterprise_token') || null
}

export function resolveUserId(storeUserId?: string | null): string | null {
    if (storeUserId) return String(storeUserId)
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem('user')
        if (raw) {
            const u = JSON.parse(raw)
            const id = u?._id || u?.id || u?.userId
            if (id) return String(id)
        }
    } catch {}
    const direct = localStorage.getItem('userId')
    if (direct) return String(direct)
    const token = resolveAuthToken()
    if (token) {
        const payload = decodeJwtPayload(token)
        const id = payload?.userId || payload?._id || payload?.id
        if (id) return String(id)
    }
    return null
}

export function resolveUserName(): string | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem('user')
        if (raw) {
            const name = JSON.parse(raw)?.name
            if (name) return String(name)
        }
    } catch {}
    return null
}

export function buildAuthHeaders(storeUserId?: string | null): Record<string, string> {
    const headers: Record<string, string> = {}
    const token = resolveAuthToken() || resolveUserId(storeUserId)
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
        headers['x-enterprise-token'] = token
    }
    const userId = resolveUserId(storeUserId)
    if (userId) headers['x-user-id'] = userId
    return headers
}
