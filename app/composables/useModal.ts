import { ref } from 'vue'

export function useModal() {
    const isOpen = ref(false)
    const resolvePromise = ref<((value: boolean) => void) | null>(null)

    const open = (): Promise<boolean> => {
        isOpen.value = true
        return new Promise((resolve) => {
            resolvePromise.value = resolve
        })
    }

    const confirm = () => {
        if (resolvePromise.value) resolvePromise.value(true)
        isOpen.value = false
    }
    const cancel = () => {
        if (resolvePromise.value) resolvePromise.value(false)
        isOpen.value = false
    }

    return {
        isOpen,
        open,
        confirm,
        cancel,
    }
}