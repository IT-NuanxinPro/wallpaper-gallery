// ========================================
// 回到顶部功能 Composable
// ========================================

import { onMounted, onUnmounted, ref } from 'vue'

export function useScrollTop() {
  const showButton = ref(false)

  // 根据设备类型设置不同的阈值
  // 移动端屏幕小，滚动 200px 就显示；PC 端滚动 400px
  const getThreshold = () => {
    return window.innerWidth < 768 ? 200 : 400
  }

  const handleScroll = () => {
    showButton.value = window.scrollY > getThreshold()
  }

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  onMounted(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })

  return {
    showButton,
    scrollToTop,
  }
}
