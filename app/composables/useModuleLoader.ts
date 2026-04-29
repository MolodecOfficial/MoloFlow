import { defineAsyncComponent } from 'vue';

interface ModuleCache {
    bundle: any;
    components: Map<string, any>;
    composables: Map<string, any>;
}

const moduleCache = new Map<string, ModuleCache>();

export const useModuleLoader = () => {


    try {
        const notifications = useNotifications('Module Loader');
    } catch {}

    const loadModuleBundle = async (moduleId: string) => {
        if (!moduleId || moduleId === 'undefined') {
            throw new Error('moduleId is undefined or invalid');
        }

        if (moduleCache.has(moduleId)) {
            return moduleCache.get(moduleId)!;
        }

        try {
            const url = `/api/modules/${moduleId}/client-bundle?t=${Date.now()}`;

            // Динамический импорт собранного модуля
            const bundle = await import(/* @vite-ignore */ url);

            const cache: ModuleCache = {
                bundle,
                components: new Map(),
                composables: new Map()
            };

            if (bundle.components) {
                Object.entries(bundle.components).forEach(([name, comp]) => {
                    cache.components.set(
                        name,
                        defineAsyncComponent(() => Promise.resolve(comp))
                    );
                });
            }

            if (bundle.composables) {
                Object.entries(bundle.composables).forEach(([name, composable]) => {
                    cache.composables.set(name, composable);
                });
            }

            moduleCache.set(moduleId, cache);
            return cache;

        } catch (error: any) {
            throw error;
        }
    };

    const loadComponent = async (moduleId: string, componentName: string = 'default') => {
        if (!moduleId) return null;

        const cache = await loadModuleBundle(moduleId);

        if (cache.components.has(componentName)) {
            return cache.components.get(componentName);
        }

        if (cache.bundle.components?.[componentName]) {
            const component = defineAsyncComponent(() =>
                Promise.resolve(cache.bundle.components[componentName])
            );
            cache.components.set(componentName, component);
            return component;
        }

        return null;
    };

    const loadComposable = async (moduleId: string, composableName: string) => {
        if (!moduleId) return null;

        const cache = await loadModuleBundle(moduleId);

        if (cache.composables.has(composableName)) {
            return cache.composables.get(composableName);
        }

        if (cache.bundle.composables?.[composableName]) {
            const composable = cache.bundle.composables[composableName];
            cache.composables.set(composableName, composable);
            return composable;
        }

        return null;
    };

    const callModuleApi = async (moduleId: string, endpoint: string, data?: any) => {
        return await $fetch(`/api/modules/${moduleId}/${endpoint}`, {
            method: data ? 'POST' : 'GET',
            body: data
        });
    };

    const registerModuleHooks = async (moduleId: string, context: any) => {
        const cache = await loadModuleBundle(moduleId);

        if (typeof cache.bundle.onMount === 'function') {
            await cache.bundle.onMount(context);
        }

        if (typeof cache.bundle.init === 'function') {
            await cache.bundle.init(context);
        }
    };

    return {
        loadModuleBundle,
        loadComponent,
        loadComposable,
        callModuleApi,
        registerModuleHooks
    };
};