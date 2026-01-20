export class LayoutRegistry {
    private static instance: LayoutRegistry;
    private layouts: Map<string, () => Promise<any>> = new Map();

    static getInstance(): LayoutRegistry {
        if (!LayoutRegistry.instance) {
            LayoutRegistry.instance = new LayoutRegistry();
            LayoutRegistry.instance.scanLayouts();
        }
        return LayoutRegistry.instance;
    }

    private scanLayouts() {
        // Используем glob для сканирования всех Vue файлов в layouts
        const modules = import.meta.glob('@/layouts/*.vue', { eager: false });

        Object.keys(modules).forEach(path => {
            const fileName = path
                .replace(/^.*\//, '') // Убираем путь
                .replace('.vue', ''); // Убираем расширение

            this.layouts.set(fileName.toLowerCase(), modules[path]);

            // Также добавляем варианты без префиксов
            const normalizedName = fileName
                .replace(/([A-Z])/g, '_$1') // CamelCase to snake_case
                .toLowerCase()
                .replace(/^_/, '');

            if (normalizedName !== fileName.toLowerCase()) {
                this.layouts.set(normalizedName, modules[path]);
            }
        });
    }

    getComponent(windowId: string, groupId?: string): () => Promise<any> {
        // Пробуем разные варианты
        const searchPatterns = [
            windowId.toLowerCase(),
            ...(groupId ? [
                `${groupId}_${windowId}`.toLowerCase(),
                `${groupId}${windowId.charAt(0).toUpperCase() + windowId.slice(1)}`
            ] : [])
        ];

        for (const pattern of searchPatterns) {
            const component = this.layouts.get(pattern.toLowerCase());
            if (component) return component;
        }

        // Не нашли - возвращаем NotFound
        return () => import('@/layouts/NotFound.vue');
    }
}