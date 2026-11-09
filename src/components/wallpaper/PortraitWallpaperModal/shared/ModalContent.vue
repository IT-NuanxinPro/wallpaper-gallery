<script setup>
import WallpaperImageStage from '@/components/wallpaper/shared/WallpaperImageStage.vue'

defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
  isAvatar: { type: Boolean, default: false },
  resolution: { type: Object, default: null },
})
const emit = defineEmits(['load', 'error'])

function handleLoad(event) {
  emit('load', event.dimensions || { width: event.target.naturalWidth, height: event.target.naturalHeight })
}
</script>

<template>
  <WallpaperImageStage
    class="modal-content"
    :src="src"
    :alt="alt"
    :resolution="resolution"
    :fallback-ratio="isAvatar ? '1 / 1' : '9 / 16'"
    @load="handleLoad"
    @error="emit('error')"
  />
</template>

<style scoped>
.modal-content {
  --media-stage-max-height: 58dvh;
}
</style>
