import { computed, onScopeDispose, ref } from 'vue'

export function useCopyFeedback(copy) {
  const status = ref('idle')
  const pending = computed(() => status.value === 'pending')
  const label = computed(() => ({ idle: '复制分享链接', pending: '正在复制', success: '已复制', failed: '重试复制' })[status.value])
  const feedback = computed(() => status.value === 'failed' ? '复制失败，请重试或复制浏览器地址。' : status.value === 'success' ? '分享链接已复制' : '')
  let version = 0
  let timer

  function reset() {
    version++
    clearTimeout(timer)
    status.value = 'idle'
  }

  async function run() {
    if (pending.value)
      return
    reset()
    const current = version
    status.value = 'pending'
    try {
      const copied = await copy()
      if (current !== version)
        return
      if (!copied)
        throw new Error('Copy failed')
      status.value = 'success'
      timer = setTimeout(reset, 1500)
    }
    catch {
      if (current === version)
        status.value = 'failed'
    }
  }

  onScopeDispose(reset)
  return { pending, label, feedback, run, reset }
}
