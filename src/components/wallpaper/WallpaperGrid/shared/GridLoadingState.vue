<script setup>
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import GridSkeleton from '../GridSkeleton.vue'

defineProps({
  aspectType: { type: String, default: 'landscape' },
  currentSeriesName: { type: String, default: '壁纸' },
  isMobile: { type: Boolean, default: false },
  skeletonCount: { type: Number, default: 6 },
})
</script>

<template>
  <div class="loading-state" aria-busy="true">
    <div class="loading-status" role="status" aria-live="polite">
      <LoadingSpinner size="sm" />
      <span>正在加载{{ currentSeriesName }}</span>
    </div>
    <GridSkeleton
      :count="skeletonCount"
      :aspect-type="aspectType"
      :is-mobile="isMobile"
      aria-hidden="true"
    />
  </div>
</template>

<style lang="scss" scoped>
.loading-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  margin-bottom: 16px;
  color: var(--color-text-secondary);
  font-size: 14px;
}
</style>
