<script setup>
defineProps({
  preview: { type: Object, default: () => ({ status: 'loading', count: null }) },
})
defineEmits(['confirm'])
</script>

<template>
  <div class="filter-preview-action">
    <p class="filter-preview-action__hint" role="status" aria-live="polite" aria-atomic="true">
      <template v-if="preview.status === 'ready'">
        {{ preview.count === 0 ? '当前条件暂无结果，可以调整条件后再应用' : `当前条件匹配 ${preview.count} 张壁纸` }}
      </template>
      <template v-else-if="preview.status === 'error'">
        结果数量暂不可用，应用后可重试加载
      </template>
      <template v-else>
        壁纸目录加载中，结果数量待确认
      </template>
    </p>
    <button type="button" class="confirm-btn" @click="$emit('confirm')">
      {{ preview.status === 'ready' ? `查看 ${preview.count} 张壁纸` : '应用筛选' }}
    </button>
  </div>
</template>

<style scoped>
.filter-preview-action {
  width: 100%;
}
.filter-preview-action__hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  text-align: center;
}
.confirm-btn {
  width: 100%;
  min-height: 44px;
  border-radius: 12px;
  padding: 10px 16px;
  color: var(--color-button-text, #fff);
  background: var(--color-accent);
  font: inherit;
  font-weight: 600;
}
</style>
