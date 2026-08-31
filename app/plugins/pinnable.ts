import { vPinnable } from '~~/app/directives/pinnable'

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.directive('pinnable', vPinnable)
    console.log('Директива установлена')
})