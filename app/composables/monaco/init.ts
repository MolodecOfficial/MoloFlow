import { ApiService } from './services'
import { FileSystem } from './filesystem'

export function initMonacoSystem() {

    // 3. глобальные сервисы (ВАЖНО)
    const api = new ApiService('')
    const fs = new FileSystem()

    return {
        api,
        fs
    }
}