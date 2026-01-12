/**
 * 滚动锁定 composable
 * 用于弹窗等场景，锁定背景滚动并在关闭时恢复原位置
 *
 * 方案：保存滚动位置 + body.style.top 固定 + modal-open class
 */
import { onUnmounted, ref } from 'vue'

export function useScrollLock() {
  const isLocked = ref(false)
  const savedScrollY = ref(0)

  function lock() {
    if (isLocked.value)
      return
    // 保存当前滚动位置
    savedScrollY.value = window.scrollY || window.pageYOffset
    // 固定 body 位置
    document.body.style.top = `-${savedScrollY.value}px`
    document.body.classList.add('modal-open')
    isLocked.value = true
  }

  function unlock() {
    if (!isLocked.value)
      return
    document.body.classList.remove('modal-open')
    document.body.style.top = ''
    // 恢复滚动位置
    window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
    isLocked.value = false
  }

  onUnmounted(() => {
    if (isLocked.value)
      unlock()
  })

  return { lock, unlock, isLocked }
}
