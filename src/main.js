import { createApp } from 'vue'
// 反调试保护（生产环境）
import { initAntiDebug } from '@/utils/anti-debug'
import App from './App.vue'

import router from './router'

// 自定义 flexible 适配方案（PC 端保持设计稿尺寸，移动端等比缩放）
import '@/utils/flexible'

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

app.use(router)
app.mount('#app')

// 初始化反调试
initAntiDebug()
