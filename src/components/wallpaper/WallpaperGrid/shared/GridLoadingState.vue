<script setup>
import LoadingSurface from '@/components/common/feedback/LoadingSurface.vue'
import GridSkeleton from '../GridSkeleton.vue'

defineProps({
  aspectType: { type: String, default: 'landscape' },
  aspectRatio: { type: String, default: '16/10' },
  isBing: { type: Boolean, default: false },
  currentSeriesName: { type: String, default: '壁纸' },
  isMobile: { type: Boolean, default: false },
  skeletonCount: { type: Number, default: 6 },
})
</script>

<template>
  <LoadingSurface class="loading-state" busy :label="`正在加载${currentSeriesName}`" :size="48">
    <GridSkeleton
      :count="skeletonCount"
      :aspect-type="aspectType"
      :aspect-ratio="aspectRatio"
      :is-bing="isBing"
      :is-mobile="isMobile"
      aria-hidden="true"
    />
  </LoadingSurface>
</template>

<style lang="scss" scoped>
.loading-state :deep(.loading-surface__veil) {
  align-items: start;
  padding-top: clamp(64px, 16vh, 160px);
}
</style>
