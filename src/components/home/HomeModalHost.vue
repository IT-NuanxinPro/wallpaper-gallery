<script setup>
import PortraitWallpaperModal from '@/components/wallpaper/PortraitWallpaperModal/index.vue'
import WallpaperModal from '@/components/wallpaper/WallpaperModal/index.vue'

defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  showMobileSeriesNotice: {
    type: Boolean,
    default: false,
  },
  usePortraitModal: {
    type: Boolean,
    default: false,
  },
  wallpaper: {
    type: Object,
    default: null,
  },
})

defineEmits(['close', 'next', 'prev'])
</script>

<template>
  <WallpaperModal
    v-if="!usePortraitModal && !showMobileSeriesNotice"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="$emit('close')"
    @prev="$emit('prev')"
    @next="$emit('next')"
  />

  <PortraitWallpaperModal
    v-else-if="!showMobileSeriesNotice"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="$emit('close')"
    @prev="$emit('prev')"
    @next="$emit('next')"
  />
</template>
