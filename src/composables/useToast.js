import { createApp, h, ref } from 'vue'
import AppToast from '@/components/common/feedback/AppToast.vue'

// 全局状态
const toastState = ref({
  show: false,
  message: '',
  type: 'info',
  duration: 2500,
})

let toastInstance = null
let container = null

/**
 * 创建 Toast 实例
 */
function createToastInstance() {
  if (toastInstance) return

  container = document.createElement('div')
  container.id = 'app-toast-container'
  document.body.appendChild(container)

  toastInstance = createApp({
    setup() {
      return () => h(AppToast, {
        show: toastState.value.show,
        message: toastState.value.message,
        type: toastState.value.type,
        duration: toastState.value.duration,
        'onUpdate:show': (val) => {
          toastState.value.show = val
        },
      })
    },
  })

  toastInstance.mount(container)
}

/**
 * 显示 Toast
 */
function showToast(message, options = {}) {
  createToastInstance()

  toastState.value = {
    show: true,
    message,
    type: options.type || 'info',
    duration: options.duration ?? 2500,
  }
}

/**
 * useToast composable
 */
export function useToast() {
  return {
    toast: showToast,
    success: (msg, opts) => showToast(msg, { ...opts, type: 'success' }),
    error: (msg, opts) => showToast(msg, { ...opts, type: 'error' }),
    warning: (msg, opts) => showToast(msg, { ...opts, type: 'warning' }),
    info: (msg, opts) => showToast(msg, { ...opts, type: 'info' }),
  }
}

export default useToast
