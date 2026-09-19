// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/main.scss'],

  runtimeConfig: {
    mongodb: process.env.MONGODB_URI,
  },

  nitro: {
    plugins: ['~/server/plugins/mongoose.ts'],
    experimental: {
      websocket: true
    },
    storage: {
      'ws:clients': { driver: 'memory' }
    },
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
    },
  },

  modules: [
    '@atmoner/nuxt-electron','@pinia/nuxt'],
})