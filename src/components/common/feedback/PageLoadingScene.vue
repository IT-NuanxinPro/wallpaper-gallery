<script setup>
import LoadingSpinner from './LoadingSpinner.vue'

defineProps({
  text: {
    type: String,
    default: '请稍候...',
  },
  title: {
    type: String,
    default: '页面加载中',
  },
})
</script>

<template>
  <div class="page-loading-scene" role="status" aria-live="polite" aria-busy="true">
    <div class="page-loading-scene__shell">
      <div class="page-loading-scene__visual">
        <LoadingSpinner size="lg" />
      </div>
      <p class="page-loading-scene__title">
        {{ title }}
      </p>
      <p class="page-loading-scene__text">
        {{ text }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-loading-scene {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: clamp(180px, 30vh, 280px);
  padding: clamp(20px, 5vw, 40px) 0;
}

.page-loading-scene__shell {
  width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.page-loading-scene__visual {
  padding: 12px;
}

.page-loading-scene__title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.page-loading-scene__text {
  margin: 0;
  max-width: 28ch;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}
</style>
