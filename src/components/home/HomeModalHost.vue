<script setup>
import { computed } from 'vue'
import PortraitWallpaperModal from '@/components/wallpaper/PortraitWallpaperModal/index.vue'
import SocialCoverDesktopModal from '@/components/wallpaper/SocialCoverDesktopModal.vue'
import VideoPortraitDesktopModal from '@/components/wallpaper/VideoPortraitDesktopModal.vue'
import VideoWallpaperModal from '@/components/wallpaper/VideoWallpaperModal.vue'
import WallpaperModal from '@/components/wallpaper/WallpaperModal/index.vue'
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
    v-else-if="!usePortraitModal && !showMobileSeriesNotice"
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
