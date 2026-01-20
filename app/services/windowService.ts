import type { WindowItem } from '~/types/window'

interface WindowOptions {
    itemId: string
    groupId: string
    groupTitle: string
    itemTitle: string
}

export class WindowService {
    private static instance: WindowService
    private windowCounter = 0

    static getInstance(): WindowService {
        if (!WindowService.instance) {
            WindowService.instance = new WindowService()
        }
        return WindowService.instance
    }

    createWindow(options: WindowOptions & { subGroupId?: string; subGroupTitle?: string }): WindowItem {
        this.windowCounter++

        let fullTitle = options.groupTitle
        if (options.subGroupTitle) {
            fullTitle += ` → ${options.subGroupTitle}`
        }
        fullTitle += ` → ${options.itemTitle}`

        return {
            id: `window_${this.windowCounter}_${options.itemId}`,
            itemId: options.itemId,
            groupId: options.groupId,
            subGroupId: options.subGroupId,  // добавляем
            subGroupTitle: options.subGroupTitle,  // добавляем
            groupTitle: options.groupTitle,
            itemTitle: options.itemTitle,
            fullTitle,
            zIndex: 1000 + this.windowCounter,
            isMinimized: false,
            position: this.calculatePosition(this.windowCounter),
            size: { width: 800, height: 600 }
        }
    }

    private calculatePosition(counter: number): { x: number; y: number } {
        const offset = 30
        const baseX = 100 + (counter - 1) * offset
        const baseY = 100 + (counter - 1) * offset
        return {
            x: baseX % (window.innerWidth - 400),
            y: Math.min(baseY, window.innerHeight - 300)
        }
    }
}