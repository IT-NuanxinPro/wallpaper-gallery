import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'

import router from './router'

// 自定义 flexible 适配方案（PC 端保持设计稿尺寸，移动端等比缩放）
import '@/utils/flexible'

// ========================================
// Electron 环境检测
// ========================================
if (window.electronAPI?.isElectron) {
  console.log('[Electron] Running in Electron environment')
  console.log('[Electron] Platform:', window.electronAPI.platform)
}

// ========================================
// 旧版 Hash 路由兼容处理
// ========================================
// 如果用户访问的是旧的 hash URL（如 /#/desktop），
// 自动重定向到新的 history URL（如 /desktop）
function handleLegacyHashUrl() {
  const hash = window.location.hash
  // 检查是否是旧的 hash 路由格式：#/xxx
  if (hash && hash.startsWith('#/')) {
    const path = hash.slice(1) // 移除 # 号，保留 /desktop
    // 使用 replaceState 避免产生历史记录
    window.history.replaceState(null, '', path)
  }
}

// 在路由初始化前处理旧 hash URL
handleLegacyHashUrl()

// 动态加载 Umami Analytics
function loadUmamiAnalytics() {
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID
  if (websiteId) {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://cloud.umami.is/script.js'
    script.setAttribute('data-website-id', websiteId)
    // 插入到 head 的第一个位置，确保尽早加载
    const firstScript = document.head.getElementsByTagName('script')[0]
    if (firstScript) {
      document.head.insertBefore(script, firstScript)
    }
    else {
      document.head.appendChild(script)
    }
  }
}

// 加载 Umami Analytics（尽早加载）
loadUmamiAnalytics()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
