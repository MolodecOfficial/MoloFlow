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
    json: {
      stringify: true
    }
  },
  modules: ['@pinia/nuxt'],
})