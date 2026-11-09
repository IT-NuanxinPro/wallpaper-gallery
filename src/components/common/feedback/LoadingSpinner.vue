<script setup>
import SoftLoading from './SoftLoading.vue'

defineProps({
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md', 'lg'].includes(v),
  },
})
</script>

<template>
  <div class="loading-spinner" :class="[`size-${size}`]" aria-hidden="true">
    <SoftLoading :size="{ sm: 20, md: 32, lg: 36 }[size]" decorative />
  </div>
</template>

<style lang="scss" scoped>
.loading-spinner {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}
</style>
