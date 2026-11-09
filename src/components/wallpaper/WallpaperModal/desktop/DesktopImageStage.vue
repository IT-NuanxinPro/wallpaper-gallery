<script setup>
import WallpaperImageStage from '@/components/wallpaper/shared/WallpaperImageStage.vue'

defineProps({
  imageSrc: { type: String, default: '' },
  resolution: { type: Object, default: null },
})
defineEmits(['load', 'error'])
</script>

<template>
  <WallpaperImageStage
    class="desktop-image-stage"
    :src="imageSrc"
    :resolution="resolution"
    @load="$emit('load', $event)"
    @error="$emit('error')"
  />
</template>

<style scoped>
.desktop-image-stage {
  --media-stage-max-height: min(68dvh, 640px);
  max-width: 860px;
  border-radius: 30px;
  box-shadow: 0 22px 42px rgba(2, 8, 23, 0.28);
}
</style>
