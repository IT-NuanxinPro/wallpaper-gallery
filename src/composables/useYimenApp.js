// ========================================
// 一门云 App 环境检测 Composable
// ========================================

import { computed, onMounted, ref } from 'vue'
import { isYimenApp, waitForBridge } from '@/utils/yimenBridge'

export function useYimenApp() {
  const isAppEnvironment = ref(false)
  const isBridgeReady = ref(false)
  const isLoading = ref(true)

  // 检测是否在 App 环境中
  const inApp = computed(() => isAppEnvironment.value && isBridgeReady.value)

  // 初始化检测
  async function initializeAppDetection() {
    isLoading.value = true

    try {
      // 检测是否在一门云 App 中
      isAppEnvironment.value = isYimenApp()

      if (isAppEnvironment.value) {
        // 等待 Bridge 准备就绪
        isBridgeReady.value = await waitForBridge()
      }
    }
    catch (error) {
      console.error('App 环境检测失败:', error)
      isAppEnvironment.value = false
      isBridgeReady.value = false
    }
    finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    initializeAppDetection()
  })

  return {
    // 状态
    isAppEnvironment: computed(() => isAppEnvironment.value),
    isBridgeReady: computed(() => isBridgeReady.value),
    inApp,
    isLoading: computed(() => isLoading.value),

    // 方法
    initializeAppDetection,
  }
}
