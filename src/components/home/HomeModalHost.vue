<script setup>
import { computed } from 'vue'
import { defineAsyncModal } from '@/components/common/feedback/defineAsyncModal'
import { useDevice } from '@/composables/useDevice'

const props = defineProps({
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
const PortraitWallpaperModal = defineAsyncModal(() => import('@/components/wallpaper/PortraitWallpaperModal/index.vue'))
const SocialCoverDesktopModal = defineAsyncModal(() => import('@/components/wallpaper/SocialCoverDesktopModal.vue'))
const VideoPortraitDesktopModal = defineAsyncModal(() => import('@/components/wallpaper/VideoPortraitDesktopModal.vue'))
const VideoWallpaperModal = defineAsyncModal(() => import('@/components/wallpaper/VideoWallpaperModal.vue'))
const WallpaperModal = defineAsyncModal(() => import('@/components/wallpaper/WallpaperModal/index.vue'))

const { isMobile } = useDevice()
const useSocialCoverDesktopModal = computed(() =>
  props.wallpaper?.mediaType === 'video'
  && props.wallpaper?.usage === 'social-cover'
  && !props.showMobileSeriesNotice
  && !isMobile.value,
)
const useVideoPortraitDesktopModal = computed(() =>
  props.wallpaper?.mediaType === 'video'
  && props.wallpaper?.usage === 'mobile'
  && !props.showMobileSeriesNotice
  && !isMobile.value,
)
</script>

<template>
  <SocialCoverDesktopModal
    v-if="useSocialCoverDesktopModal"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="$emit('close')"
    @prev="$emit('prev')"
    @next="$emit('next')"
  />

  <VideoPortraitDesktopModal
    v-else-if="useVideoPortraitDesktopModal"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="$emit('close')"
    @prev="$emit('prev')"
    @next="$emit('next')"
  />

  <VideoWallpaperModal
    v-else-if="wallpaper?.mediaType === 'video' && !showMobileSeriesNotice"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="$emit('close')"
    @prev="$emit('prev')"
    @next="$emit('next')"
  />

  <WallpaperModal
    v-else-if="wallpaper && !usePortraitModal && !showMobileSeriesNotice"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="$emit('close')"
    @prev="$emit('prev')"
    @next="$emit('next')"
  />

  <PortraitWallpaperModal
    v-else-if="wallpaper && !showMobileSeriesNotice"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="$emit('close')"
    @prev="$emit('prev')"
    @next="$emit('next')"
  />
</template>
