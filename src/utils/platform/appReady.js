import { nextTick } from 'vue'

export async function signalAppReady(router) {
  await router.isReady()
  await nextTick()
  await new Promise(resolve => window.requestAnimationFrame(resolve))
  await new Promise(resolve => window.requestAnimationFrame(resolve))
  document.documentElement.setAttribute('data-wallpaper-app-ready', 'true')
  window.dispatchEvent(new CustomEvent('wallpaper:app-ready'))
}
