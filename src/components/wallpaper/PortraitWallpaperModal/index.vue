<script setup>
/**
 * 竖屏壁纸弹窗主组件
 * 使用 Vue Transition + CSS 动画，遵循 Vue 最佳实践
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/analytics'
import { downloadFile } from '@/utils/format'
import { recordDownload, recordView } from '@/utils/supabase'

import AvatarDesktopModal from './AvatarDesktopModal.vue'
import AvatarMobileModal from './AvatarMobileModal.vue'
import { useDeviceMode } from './composables/useDeviceMode'
import DesktopModal from './DesktopModal.vue'
import DeviceMode from './DeviceMode.vue'
import MobileModal from './MobileModal.vue'
import ModalContent from './ModalContent.vue'
import ModalInfo from './ModalInfo.vue'

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

const emit = defineEmits(['close'])

// Composables
const { currentSeries } = useWallpaperType()
const { isMobile, isDesktop } = useDevice()
const deviceMode = useDeviceMode()
const popularityStore = usePopularityStore()

// PC端使用独立的桌面弹窗
const useDesktopModal = computed(() => isDesktop.value && currentSeries.value === 'mobile')

// PC端头像使用独立的头像桌面弹窗
const useAvatarDesktopModal = computed(() => isDesktop.value && currentSeries.value === 'avatar')

// 移动端手机壁纸使用独立的移动端弹窗
const useMobileModal = computed(() => isMobile.value && currentSeries.value === 'mobile')

// 移动端头像使用独立的头像弹窗
const useAvatarMobileModal = computed(() => isMobile.value && currentSeries.value === 'avatar')

// 模板引用
const contentRef = ref(null)

// 数据状态
const imageDimensions = ref({ width: 0, height: 0 })
const imageLoaded = ref(false)
const downloading = ref(false)
const savedScrollY = ref(0)

// 统计数据（从 popularityStore 获取，支持乐观更新）
const downloadCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getDownloadCount(props.wallpaper.filename)
})

const viewCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getViewCount(props.wallpaper.filename)
})

// 弹窗显示状态（用于 Transition 控制）
const isVisible = ref(false)

// 派生状态
const canUseDeviceMode = computed(() => currentSeries.value === 'mobile')
const isAvatarSeries = computed(() => currentSeries.value === 'avatar')

// 监听 isOpen 变化
watch(() => props.isOpen, async (isOpen) => {
  // 如果使用独立的弹窗组件，不在这里处理
  if (useDesktopModal.value || useAvatarDesktopModal.value || useMobileModal.value || useAvatarMobileModal.value) {
    return
  }

  if (isOpen && props.wallpaper) {
    handleOpen()
  }
  else if (!isOpen && isVisible.value) {
    handleClose()
  }
})

// 监听壁纸变化
watch(() => props.wallpaper, () => {
  resetState()
  // 统计数据现在是 computed，从 popularityStore 自动获取
})

// 打开弹窗
function handleOpen() {
  // 追踪和统计
  trackWallpaperPreview(props.wallpaper)
  recordView(props.wallpaper, currentSeries.value)
  // 乐观更新本地统计（立即反映到 UI）
  popularityStore.incrementLocalView(props.wallpaper.filename)

  // 锁定背景滚动
  savedScrollY.value = window.scrollY || window.pageYOffset
  document.body.style.top = `-${savedScrollY.value}px`
  document.body.classList.add('modal-open')

  // 显示弹窗（触发 Transition）
  isVisible.value = true
}

// 关闭弹窗
function handleClose() {
  // 如果在真机模式，先退出
  if (deviceMode.isDeviceMode.value) {
    deviceMode.exit()
    // 等待真机模式退出动画完成后再关闭弹窗
    return
  }

  // 隐藏弹窗（触发 Transition）
  isVisible.value = false
}

// 弹窗关闭动画完成后
function onModalAfterLeave() {
  // 恢复背景滚动
  document.body.classList.remove('modal-open')
  document.body.style.top = ''
  window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })

  emit('close')
}

// 真机模式动画完成回调
function onDeviceModeAfterEnter() {
  deviceMode.onAnimationEnd()
}

function onDeviceModeAfterLeave() {
  deviceMode.onAnimationEnd()
  // 如果正在关闭弹窗，继续关闭流程
  if (!props.isOpen) {
    isVisible.value = false
  }
}

// 切换真机模式
function toggleDeviceMode() {
  deviceMode.toggle()
}

// 退出真机模式
function exitDeviceMode() {
  deviceMode.exit()
}

// 下载处理
async function handleDownload() {
  if (!props.wallpaper || downloading.value)
    return

  downloading.value = true
  try {
    await downloadFile(props.wallpaper.url, props.wallpaper.filename)
    trackWallpaperDownload(props.wallpaper, currentSeries.value)
    recordDownload(props.wallpaper, currentSeries.value)
    // 乐观更新本地统计（立即反映到 UI）
    popularityStore.incrementLocalDownload(props.wallpaper.filename)
  }
  finally {
    downloading.value = false
  }
}

// 图片加载完成
function handleImageLoad(dimensions) {
  imageLoaded.value = true
  imageDimensions.value = dimensions
}

// 图片加载失败
function handleImageError() {
  imageLoaded.value = true
}

// 重置状态
function resetState() {
  imageLoaded.value = false
  imageDimensions.value = { width: 0, height: 0 }
  // 统计数据现在是 computed，无需手动重置

  // 如果在真机模式，强制退出
  if (deviceMode.isDeviceMode.value) {
    deviceMode.reset()
  }
}

// 键盘导航
function handleKeydown(e) {
  if (!isVisible.value)
    return

  if (e.key === 'Escape') {
    if (deviceMode.isDeviceMode.value) {
      exitDeviceMode()
    }
    else {
      handleClose()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)

  // 只有当不使用独立弹窗组件时才清理滚动状态
  if (!useDesktopModal.value && !useAvatarDesktopModal.value && !useMobileModal.value && !useAvatarMobileModal.value) {
    document.body.classList.remove('modal-open')
    document.body.style.top = ''

    if (savedScrollY.value > 0) {
      window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
    }
  }
})
</script>

<template>
  <!-- PC端手机壁纸使用独立的桌面弹窗 -->
  <DesktopModal
    v-if="useDesktopModal"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="emit('close')"
  />

  <!-- PC端头像使用独立的头像桌面弹窗 -->
  <AvatarDesktopModal
    v-else-if="useAvatarDesktopModal"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="emit('close')"
  />

  <!-- 移动端手机壁纸使用独立的移动端弹窗 -->
  <MobileModal
    v-else-if="useMobileModal"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="emit('close')"
  />

  <!-- 移动端头像使用独立的头像弹窗 -->
  <AvatarMobileModal
    v-else-if="useAvatarMobileModal"
    :wallpaper="wallpaper"
    :is-open="isOpen"
    @close="emit('close')"
  />

  <!-- 其他系列使用原有弹窗 -->
  <Teleport v-else to="body">
    <Transition name="modal" @after-leave="onModalAfterLeave">
      <div
        v-if="isVisible && wallpaper"
        class="portrait-modal"
        :class="{ 'is-device-mode': deviceMode.isDeviceMode.value && isMobile }"
        @click.self="handleClose"
      >
        <div
          ref="contentRef"
          class="portrait-modal__content"
          :class="{
            'is-device-mode': deviceMode.isDeviceMode.value && isMobile,
            'is-avatar': isAvatarSeries,
          }"
        >
          <!-- 关闭按钮 -->
          <Transition name="fade">
            <button
              v-if="!deviceMode.isDeviceMode.value"
              class="portrait-modal__close"
              aria-label="关闭"
              @click="handleClose"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </Transition>

          <!-- 图片区域（普通模式） -->
          <Transition name="content-fade">
            <ModalContent
              v-show="!deviceMode.isDeviceMode.value"
              ref="contentRef"
              :src="wallpaper.url"
              :alt="wallpaper.filename"
              :is-avatar="isAvatarSeries"
              @load="handleImageLoad"
              @error="handleImageError"
            />
          </Transition>

          <!-- 真机模式视图 -->
          <DeviceMode
            v-if="canUseDeviceMode"
            :visible="deviceMode.isDeviceMode.value"
            :image-src="wallpaper.url"
            :image-alt="wallpaper.filename"
            @exit="exitDeviceMode"
            @after-enter="onDeviceModeAfterEnter"
            @after-leave="onDeviceModeAfterLeave"
          />

          <!-- 底部信息栏 -->
          <ModalInfo
            :wallpaper="wallpaper"
            :dimensions="imageDimensions"
            :view-count="viewCount"
            :download-count="downloadCount"
            :is-loading="!imageLoaded"
            :is-downloading="downloading"
            :can-use-device-mode="canUseDeviceMode"
            :is-device-mode="deviceMode.isDeviceMode.value"
            @download="handleDownload"
            @toggle-device-mode="toggleDeviceMode"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.portrait-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-modal);
  backdrop-filter: blur(12px);
  padding: $spacing-md;

  &.is-device-mode {
    padding: 0;
    align-items: flex-start;
    background: #ffffff;
    backdrop-filter: none;
  }

  // 内容容器
  &__content {
    position: relative;
    display: flex;
    flex-direction: column;
    max-width: 500px;
    width: 90vw;
    min-height: 70vh;
    max-height: 90vh;
    background: var(--color-bg-card);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-xl);

    @include mobile-only {
      width: 95vw;
      max-width: 100%;
      min-height: 75vh;
      max-height: 95vh;
    }

    &.is-device-mode {
      width: 100vw;
      max-width: 100%;
      height: 100vh;
      min-height: 100vh;
      max-height: 100vh;
      border-radius: 0;
      box-shadow: none;
      background: transparent;
    }

    &.is-avatar {
      min-height: auto;
      max-height: 90vh;

      @include mobile-only {
        min-height: auto;
        max-height: 95vh;
      }
    }
  }

  // 关闭按钮
  &__close {
    position: absolute;
    top: $spacing-sm;
    right: $spacing-sm;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: $radius-full;
    color: white;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.7);
      transform: scale(1.1);
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }
}

// 弹窗整体动画
.modal-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);

  .portrait-modal__content {
    transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.modal-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  .portrait-modal__content {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.modal-enter-from {
  opacity: 0;

  .portrait-modal__content {
    opacity: 0;
    transform: scale(0.9) translateY(30px);
  }
}

.modal-leave-to {
  opacity: 0;

  .portrait-modal__content {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
}

// 内容淡入淡出
.content-fade-enter-active,
.content-fade-leave-active {
  transition: opacity 0.3s ease;
}

.content-fade-enter-from,
.content-fade-leave-to {
  opacity: 0;
}

// 通用淡入淡出
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
