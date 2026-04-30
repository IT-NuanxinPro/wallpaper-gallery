<script setup>
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import { useInteraction } from '@/composables/useInteraction'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/common/analytics'
import { buildWallpaperDownloadFilename, downloadFile, formatDate, formatFileSize, getDisplayFilename } from '@/utils/common/format'
import { VIDEO_USAGE_SHORT_LABELS } from '@/utils/config/constants'
import { recordDownload, recordView } from '@/utils/integrations/supabase'
import { resolveWallpaperSeries } from '@/utils/wallpaper/identity'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: null,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'prev', 'next'])

const { currentSeries } = useWallpaperType()
const effectiveSeries = computed(() => resolveWallpaperSeries(props.wallpaper, currentSeries.value))
const { collected, isAuthenticated, liked, toggleCollect, toggleLike } = useInteraction(toRef(props, 'wallpaper'), effectiveSeries)
const popularityStore = usePopularityStore()

const isVisible = ref(false)
const downloading = ref(false)
const videoReady = ref(false)
const videoError = ref(false)
const savedScrollY = ref(0)
const mediaDimensions = ref({ width: 0, height: 0 })
const scrollLocked = ref(false)
const portraitVideoElementRef = ref(null)

const usageLabel = computed(() => VIDEO_USAGE_SHORT_LABELS[props.wallpaper?.usage] || props.wallpaper?.usage || '手机壁纸')
const topicLabel = computed(() => props.wallpaper?.topic || props.wallpaper?.subcategory || '通用')
const displayTitle = computed(() => {
  if (!props.wallpaper)
    return ''

  if (props.wallpaper.displayTitle) {
    return props.wallpaper.displayTitle.replace(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|tif|ico|heic|heif|mp4|webm|mov|m4v)$/i, '')
  }

  return getDisplayFilename(props.wallpaper.filename)
})

const formattedSize = computed(() => formatFileSize(props.wallpaper?.size || 0))
const formattedDate = computed(() => formatDate(props.wallpaper?.createdAt || ''))
const durationText = computed(() => {
  const duration = props.wallpaper?.duration || 0
  if (!duration)
    return ''

  const totalSeconds = Math.max(0, Math.round(duration))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0)
    return `${seconds} 秒`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})
const resolutionText = computed(() => {
  const width = mediaDimensions.value.width || props.wallpaper?.resolution?.width
  const height = mediaDimensions.value.height || props.wallpaper?.resolution?.height
  return width && height ? `${width} × ${height}` : '视频信息加载中'
})
const resolutionTag = computed(() => props.wallpaper?.resolution?.label || '')
const resolutionTagType = computed(() => props.wallpaper?.resolution?.type || 'success')
const downloadCount = computed(() => props.wallpaper ? popularityStore.getDownloadCount(props.wallpaper.filename) : 0)
const viewCount = computed(() => props.wallpaper ? popularityStore.getViewCount(props.wallpaper.filename) : 0)
const likeCount = computed(() => props.wallpaper ? popularityStore.getLikeCount(props.wallpaper.filename) : 0)
const collectCount = computed(() => props.wallpaper ? popularityStore.getCollectCount(props.wallpaper.filename) : 0)

function resetVideoState() {
  videoReady.value = false
  videoError.value = false
  mediaDimensions.value = { width: 0, height: 0 }
}

function releaseVideoResources() {
  if (portraitVideoElementRef.value) {
    portraitVideoElementRef.value.pause()
    portraitVideoElementRef.value.removeAttribute('src')
    portraitVideoElementRef.value.load()
  }
  resetVideoState()
}

function restoreScroll() {
  if (!scrollLocked.value)
    return

  document.body.classList.remove('modal-open')
  document.body.style.top = ''
  window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
  scrollLocked.value = false
}

function handleOpen() {
  trackWallpaperPreview(props.wallpaper)
  recordView(props.wallpaper, effectiveSeries.value)
  savedScrollY.value = window.scrollY || window.pageYOffset
  document.body.style.top = `-${savedScrollY.value}px`
  document.body.classList.add('modal-open')
  scrollLocked.value = true
  resetVideoState()
  isVisible.value = true
}

function handleClose() {
  releaseVideoResources()
  isVisible.value = false
}

function onAfterLeave() {
  restoreScroll()
  emit('close')
}

watch(() => props.isOpen, (open) => {
  if (open && props.wallpaper) {
    handleOpen()
    return
  }

  if (!open && isVisible.value) {
    handleClose()
  }
}, { immediate: true })

watch(() => props.wallpaper?.id, (nextId, prevId) => {
  if (!isVisible.value || !nextId || nextId === prevId)
    return

  releaseVideoResources()
})

async function handlePortraitVideoCanPlay(event) {
  videoReady.value = true
  videoError.value = false

  const videoEl = event?.target
  if (!videoEl)
    return

  try {
    await videoEl.play()
  }
  catch {
    // 自动播放可能被浏览器阻止
  }
}

function handleVideoLoadedMetadata(event) {
  mediaDimensions.value = {
    width: event?.target?.videoWidth || 0,
    height: event?.target?.videoHeight || 0,
  }
}

function handleVideoError() {
  videoError.value = true
}

async function handleDownload() {
  if (!props.wallpaper || downloading.value)
    return

  downloading.value = true
  try {
    await downloadFile(props.wallpaper.downloadUrl || props.wallpaper.url, buildWallpaperDownloadFilename(props.wallpaper))
    trackWallpaperDownload(props.wallpaper, effectiveSeries.value)
    recordDownload(props.wallpaper, effectiveSeries.value)
  }
  finally {
    downloading.value = false
  }
}

function handleKeydown(event) {
  if (!isVisible.value)
    return

  if (event.key === 'ArrowLeft') {
    emit('prev')
  }
  else if (event.key === 'ArrowRight') {
    emit('next')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  releaseVideoResources()
  restoreScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="onAfterLeave">
      <div v-if="isVisible && wallpaper" class="desktop-modal">
        <div class="desktop-modal__content">
          <button class="desktop-modal__close" aria-label="关闭" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div class="desktop-modal__preview">
            <div v-if="videoError" class="desktop-modal__preview-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p>视频加载失败</p>
            </div>
            <div v-else class="desktop-modal__phone-preview">
              <div class="iphone-frame">
                <div class="screen-container">
                  <div
                    v-if="!videoReady"
                    class="desktop-modal__loading"
                  >
                    <LoadingSpinner size="md" />
                  </div>
                  <video
                    ref="portraitVideoElementRef"
                    class="desktop-modal__frame-video"
                    :class="{ 'is-loading': !videoReady }"
                    :src="wallpaper.playbackUrl || wallpaper.url"
                    autoplay
                    muted
                    loop
                    playsinline
                    webkit-playsinline="true"
                    preload="auto"
                    @canplay="handlePortraitVideoCanPlay"
                    @loadedmetadata="handleVideoLoadedMetadata"
                    @error="handleVideoError"
                  />
                </div>

                <div class="dynamic-island" />
                <div class="home-indicator" />
                <div class="mute-btn" />
                <div class="volume-up-btn" />
                <div class="volume-down-btn" />
                <div class="power-btn" />
              </div>
            </div>
          </div>

          <div class="desktop-modal__info">
            <div class="info-header">
              <div class="info-category-tags">
                <span>{{ usageLabel }}</span>
                <span>{{ topicLabel }}</span>
              </div>

              <h2 class="info-title">
                {{ displayTitle }}
              </h2>
            </div>

            <div class="info-tags">
              <span v-if="resolutionTag" class="tag" :class="[`tag--${resolutionTagType}`]">
                {{ resolutionTag }}
              </span>
              <span class="tag tag--secondary">视频壁纸</span>
              <span v-if="viewCount > 0" class="tag tag--view">
                {{ viewCount }}
              </span>
              <span v-if="downloadCount > 0" class="tag tag--download">
                {{ downloadCount }}
              </span>
              <span v-if="collectCount > 0" class="tag tag--collect">
                {{ collectCount }}
              </span>
              <span v-if="likeCount > 0" class="tag tag--like">
                {{ likeCount }}
              </span>
            </div>

            <div class="info-details">
              <div class="detail-row">
                <span class="detail-label">分类</span>
                <span class="detail-value">{{ usageLabel }} / {{ topicLabel }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">分辨率</span>
                <span class="detail-value">{{ resolutionText }}</span>
              </div>
              <div v-if="durationText" class="detail-row">
                <span class="detail-label">时长</span>
                <span class="detail-value">{{ durationText }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">文件大小</span>
                <span class="detail-value">{{ formattedSize }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">上传时间</span>
                <span class="detail-value">{{ formattedDate }}</span>
              </div>
            </div>

            <div class="info-actions">
              <div v-if="isAuthenticated" class="info-actions__toolbar">
                <WallpaperCardActions
                  compact
                  :show-counts="false"
                  :liked="liked"
                  :collected="collected"
                  :like-count="likeCount"
                  :collect-count="collectCount"
                  :is-authenticated="isAuthenticated"
                  @toggle-like="toggleLike"
                  @toggle-collect="toggleCollect"
                />
              </div>

              <button
                class="download-btn"
                :disabled="downloading"
                @click="handleDownload"
              >
                <LoadingSpinner v-if="downloading" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ downloading ? '下载中...' : '下载视频' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.desktop-modal {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.95) 0%,
    rgba(22, 33, 62, 0.95) 50%,
    rgba(15, 52, 96, 0.95) 100%
  );
  backdrop-filter: blur(20px);
  padding: 40px;

  &__content {
    position: relative;
    display: flex;
    gap: 60px;
    max-width: 1080px;
    width: 100%;
    min-height: 580px;
    align-items: flex-start;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 32px;
    padding: 50px;
    box-shadow:
      0 25px 50px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  &__close {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.3s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      transform: rotate(90deg);
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  &__preview {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  &__phone-preview {
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  &__preview-error {
    width: 360px;
    height: 780px;
    border-radius: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #e2e8f0;
    background:
      linear-gradient(180deg, rgba(9, 16, 30, 0.92), rgba(6, 11, 22, 0.9)),
      radial-gradient(circle at top, rgba(59, 130, 246, 0.14), transparent 52%);
    border: 1px solid rgba(96, 165, 250, 0.16);
  }

  &__loading {
    position: absolute;
    inset: 3px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 42px;
    color: #e2e8f0;
    background:
      linear-gradient(180deg, rgba(9, 16, 30, 0.92), rgba(6, 11, 22, 0.9)),
      radial-gradient(circle at top, rgba(59, 130, 246, 0.14), transparent 52%);
    border: 1px solid rgba(96, 165, 250, 0.16);
    backdrop-filter: blur(12px);
  }

  &__frame-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 42px;
    display: block;
    opacity: 1;
    transition: opacity 0.24s ease;

    &.is-loading {
      opacity: 0;
      pointer-events: none;
    }
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 28px;
    align-self: stretch;
  }
}

.info-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-category-tags,
.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: #dbeafe;
    background: rgba(34, 47, 76, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.info-title {
  margin: 0;
  color: #fff;
  font-size: 24px;
  line-height: 1.25;
  word-break: break-word;
}

.tag {
  &--success,
  &--primary,
  &--info,
  &--warning,
  &--danger,
  &--secondary,
  &--view,
  &--download,
  &--collect,
  &--like {
    color: rgba(255, 255, 255, 0.84);
  }

  &--success {
    background: rgba(16, 185, 129, 0.18) !important;
    color: #6ee7b7 !important;
  }

  &--primary {
    background: rgba(59, 130, 246, 0.18) !important;
    color: #93c5fd !important;
  }

  &--info {
    background: rgba(6, 182, 212, 0.18) !important;
    color: #67e8f9 !important;
  }

  &--warning {
    background: rgba(245, 158, 11, 0.18) !important;
    color: #fcd34d !important;
  }

  &--danger {
    background: rgba(239, 68, 68, 0.18) !important;
    color: #fca5a5 !important;
  }
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.detail-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.detail-label {
  color: rgba(255, 255, 255, 0.58);
  font-size: 14px;
}

.detail-value {
  color: #f8fafc;
  font-size: 14px;
  text-align: right;
  word-break: break-word;
}

.info-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }
}

.download-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 58px;
  border-radius: 18px;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: #fff;
  box-shadow: 0 18px 34px rgba(37, 99, 235, 0.28);

  svg {
    width: 20px;
    height: 20px;
  }
}

.iphone-frame {
  position: relative;
  width: 280px;
  height: 580px;
  background-color: #0e0e0e;
  border: 1px solid #959595;
  border-radius: 45px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow:
    0 0 0 2px #1a1a1a,
    0 0 0 4px #2a2a2a,
    0 25px 50px rgba(0, 0, 0, 0.5);
}

.screen-container {
  position: absolute;
  inset: 0;
  border-radius: 44px;
  overflow: hidden;
  z-index: 1;
  padding: 3px;
  box-sizing: border-box;
  background: #000;
}

.dynamic-island {
  position: absolute;
  top: 18px;
  width: 90px;
  height: 28px;
  background: #000;
  border-radius: 20px;
  z-index: 2;
}

.home-indicator {
  position: absolute;
  bottom: 12px;
  width: 40%;
  height: 5px;
  background-color: #fff;
  border-radius: 5px;
  z-index: 2;
  opacity: 0.9;
}

.mute-btn,
.volume-up-btn,
.volume-down-btn,
.power-btn {
  position: absolute;
  background: #2a2a2a;
  border-radius: 2px;
}

.mute-btn {
  left: -3px;
  top: 120px;
  width: 3px;
  height: 28px;
}

.volume-up-btn {
  left: -3px;
  top: 170px;
  width: 3px;
  height: 54px;
}

.volume-down-btn {
  left: -3px;
  top: 238px;
  width: 3px;
  height: 54px;
}

.power-btn {
  right: -3px;
  top: 190px;
  width: 3px;
  height: 84px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.28s ease;

  .desktop-modal__content {
    transition:
      opacity 0.28s ease,
      transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .desktop-modal__content {
    opacity: 0;
    transform: translateY(18px) scale(0.985);
  }
}

@media (max-width: 960px) {
  .desktop-modal {
    padding: 20px;

    &__content {
      gap: 36px;
      padding: 42px 28px 28px;
      min-height: 780px;
    }
  }

  .iphone-frame {
    width: 248px;
    height: 514px;
  }
}
</style>
