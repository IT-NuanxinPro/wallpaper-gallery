import { computed, ref, toValue, watch } from 'vue'
import { buildSameSizeImageFallbackUrls } from '@/utils/common/format'

export function useImageFallback(source) {
  const index = ref(0)
  const candidates = computed(() => buildSameSizeImageFallbackUrls(toValue(source)))
  const displayUrl = computed(() => candidates.value[index.value] || '')

  function reset() {
    index.value = 0
  }

  function advance() {
    if (index.value + 1 >= candidates.value.length)
      return false
    index.value += 1
    return true
  }

  // 切换壁纸或预览/原图时同步重置，避免新资源短暂沿用上一个失败来源。
  watch(() => toValue(source), reset, { flush: 'sync' })

  return { displayUrl, advance, reset }
}
