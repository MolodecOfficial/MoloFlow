// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from './package.json'
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/main.scss'],
  ssr: false,

  runtimeConfig: {
    // Дефолтная строка подключения подставится, если в среде пусто
    mongodb: process.env.MONGODB_URI || 'mongodb+srv://molomongodb:molodecfordb@cluster0.cjtt1.mongodb.net/MoloFlowDB',

    public: {
      appVersion: pkg.version || '1.0.0'
    }
  },

  nitro: {
    preset: 'node-server',
    plugins: ['~/server/plugins/mongoose.ts'],
    inlineDynamicImports: true,
    experimental: {
      websocket: true
    },
    storage: {
      'ws:clients': { driver: 'memory' }
    }
  },

  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag === 'webview'
    }
  },

  vite: {
    optimizeDeps: {
      exclude: [
        '@tiptap/extension-text-style',
        '@tiptap/extension-text-align',
        '@tiptap/extension-image',
        '@tiptap/extension-table',
        '@tiptap/extension-font-family',
        '@tiptap/extension-color',
        '@tiptap/extension-highlight',
      ]
    },
    json: {
      stringify: true
    }
  },

  modules: [
    '@pinia/nuxt'
  ]
})