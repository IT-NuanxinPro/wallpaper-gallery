<script setup>
defineEmits(['close'])
</script>

<template>
  <div class="crop-header">
    <button class="back-btn" @click="$emit('close')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      <span>返回</span>
    </button>
    <h2 class="crop-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 2v4M6 14v8M18 2v4M18 14v8M2 6h4M14 6h8M2 18h4M14 18h8" />
      </svg>
      智能裁剪
    </h2>
    <div class="header-spacer" />
  </div>
</template>
