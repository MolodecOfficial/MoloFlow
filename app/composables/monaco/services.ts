export type ApiRequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: any
    headers?: Record<string, string>
}

export class ApiService {
    baseUrl: string

    constructor(baseUrl = '') {
        this.baseUrl = baseUrl
    }

    async request<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
        const res = await fetch(this.baseUrl + url, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        })

        if (!res.ok) {
            throw new Error(`API Error: ${res.status}`)
        }

        return await res.json()
    }
}