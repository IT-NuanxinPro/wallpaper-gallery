<script setup>
/**
 * 竖屏壁纸弹窗组件
 * 专为手机壁纸、头像等竖屏图片设计
 * 布局：图片居中显示，信息面板在底部
 * 电脑端和手机端：统一支持真机显示模式（显示手机框架）
 */
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import PhoneFrame from '@/components/wallpaper/PhoneFrame.vue'
import { useDevice } from '@/composables/useDevice'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/analytics'
import { downloadFile, formatDate, formatFileSize, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/format'
import { getWallpaperDownloadCount, getWallpaperViewCount, isSupabaseConfigured, recordDownload, recordView } from '@/utils/supabase'

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

// 获取当前系列
const { currentSeries } = useWallpaperType()

// 设备检测
const { isMobile } = useDevice()

// 是否支持真机显示（仅手机壁纸系列，头像是正方形不适合真机显示）
const canUseDeviceMode = computed(() => currentSeries.value === 'mobile')

// 是否为头像系列（正方形图片，需要特殊布局）
const isAvatarSeries = computed(() => currentSeries.value === 'avatar')

// 真机显示模式（统一用于电脑端和手机端）
const isDeviceMode = ref(false)
const showControls = ref(false) // 真机模式下是否显示控制按钮

const modalRef = ref(null)
const contentRef = ref(null)
const infoRef = ref(null)
const phoneFrameRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const downloading = ref(false)
const actualDimensions = ref({ width: 0, height: 0 })

// 保存滚动位置
const savedScrollY = ref(0)

// 下载次数
const downloadCount = ref(0)

// 访问量
const viewCount = ref(0)

// 真机模式定时器（用于清理）
let deviceModeTimer = null

// 获取下载次数
async function fetchDownloadCount() {
  if (!props.wallpaper || !isSupabaseConfigured()) {
    downloadCount.value = 0
    return
  }
  try {
    downloadCount.value = await getWallpaperDownloadCount(props.wallpaper.filename, currentSeries.value)
  }
  catch (error) {
    console.error('获取下载次数失败:', error)
    downloadCount.value = 0
  }
}

// 获取访问量
async function fetchViewCount() {
  if (!props.wallpaper || !isSupabaseConfigured()) {
    viewCount.value = 0
    return
  }
  try {
    viewCount.value = await getWallpaperViewCount(props.wallpaper.filename, currentSeries.value)
  }
  catch (error) {
    if (import.meta.env.DEV) {
      console.warn('获取访问量失败:', error)
    }
    viewCount.value = 0
  }
}

// GSAP 入场动画
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // 追踪壁纸预览事件
    if (props.wallpaper) {
      trackWallpaperPreview(props.wallpaper)
      // 记录到 Supabase 统计
      recordView(props.wallpaper, currentSeries.value)
      // 获取下载次数和访问量
      fetchDownloadCount()
      fetchViewCount()
    }

    // 保存当前滚动位置
    savedScrollY.value = window.scrollY || window.pageYOffset

    // 设置 body top 保持视觉位置，禁止背景滚动
    document.body.style.top = `-${savedScrollY.value}px`
    document.body.classList.add('modal-open')

    await nextTick()
    animateIn()
  }
  else {
    // 恢复背景滚动
    document.body.classList.remove('modal-open')
    document.body.style.top = ''

    // 恢复滚动位置
    window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
  }
})

function animateIn() {
  if (!modalRef.value || !contentRef.value)
    return

  // 先设置初始状态，防止闪烁
  // 使用 visibility: hidden 配合 opacity: 0 确保元素在动画前完全不可见
  gsap.set(modalRef.value, { opacity: 0, visibility: 'visible' })
  gsap.set(contentRef.value, { scale: 0.9, y: 30, opacity: 0 })

  const tl = gsap.timeline({
    onComplete: () => {
      // 动画完成后清除 transform，避免留下 translate(0px, 0px)
      if (contentRef.value) {
        gsap.set(contentRef.value, { clearProps: 'transform' })
      }
    },
  })

  tl.to(modalRef.value, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
  })

  tl.to(contentRef.value, {
    scale: 1,
    y: 0,
    opacity: 1,
    duration: 0.4,
    ease: 'back.out(1.2)',
  }, '-=0.1')

  if (infoRef.value) {
    tl.fromTo(infoRef.value.children, {
      y: 20,
      opacity: 0,
    }, {
      y: 0,
      opacity: 1,
      duration: 0.3,
      stagger: 0.05,
      ease: 'power2.out',
    }, '-=0.2')
  }
}

function animateOut(callback) {
  if (!modalRef.value || !contentRef.value) {
    callback?.()
    return
  }

  const tl = gsap.timeline({
    onComplete: callback,
  })

  tl.to(contentRef.value, {
    scale: 0.95,
    y: 20,
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
  })

  tl.to(modalRef.value, {
    opacity: 0,
    duration: 0.2,
  }, '-=0.1')
}

// Reset state when wallpaper changes
watch(() => props.wallpaper, () => {
  // 切换壁纸时退出真机模式
  if (isDeviceMode.value) {
    exitDeviceMode()
  }
  imageLoaded.value = false
  imageError.value = false
  actualDimensions.value = { width: 0, height: 0 }
  downloadCount.value = 0
  viewCount.value = 0
  // 如果弹窗已打开，重新获取下载次数和访问量
  if (props.isOpen && props.wallpaper) {
    fetchDownloadCount()
    fetchViewCount()
  }
})

// 分辨率信息
const resolution = computed(() => {
  // 优先使用 JSON 数据中的分辨率
  if (props.wallpaper?.resolution) {
    return props.wallpaper.resolution
  }
  // 使用图片加载后的真实尺寸
  if (actualDimensions.value.width > 0) {
    return getResolutionLabel(actualDimensions.value.width, actualDimensions.value.height)
  }
  return { label: '加载中', type: 'secondary' }
})

const fileExt = computed(() => props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '')
const formattedSize = computed(() => props.wallpaper ? formatFileSize(props.wallpaper.size) : '')
const formattedDate = computed(() => props.wallpaper ? formatDate(props.wallpaper.createdAt) : '')
const displayFilename = computed(() => props.wallpaper ? getDisplayFilename(props.wallpaper.filename) : '')

// 分类信息显示
const categoryDisplay = computed(() => {
  if (!props.wallpaper)
    return ''
  const { category, subcategory } = props.wallpaper
  if (!category)
    return ''
  if (subcategory)
    return `${category} / ${subcategory}`
  return category
})

// 原图分辨率信息（如果 JSON 数据中有分辨率但标签可能过时，使用 getResolutionLabel 重新计算）
const originalResolution = computed(() => {
  if (!props.wallpaper?.resolution) {
    return null
  }
  const res = props.wallpaper.resolution
  // 如果分辨率对象有 width 和 height，使用 getResolutionLabel 确保标签是最新的（支持16K）
  if (res.width && res.height) {
    const updatedLabel = getResolutionLabel(res.width, res.height)
    return {
      width: res.width,
      height: res.height,
      label: updatedLabel.label,
      type: updatedLabel.type,
    }
  }
  // 如果没有 width/height，直接返回原始数据
  return res
})

// Handlers
function handleImageLoad(e) {
  imageLoaded.value = true

  // 获取图片实际尺寸
  if (e.target) {
    actualDimensions.value = {
      width: e.target.naturalWidth,
      height: e.target.naturalHeight,
    }
  }
}

function handleImageError() {
  imageError.value = true
  imageLoaded.value = true
}

function handleClose() {
  // 如果正在真机模式，先退出
  if (isDeviceMode.value) {
    exitDeviceMode()
  }
  animateOut(() => {
    emit('close')
  })
}

function handlePrev() {
  emit('prev')
}

function handleNext() {
  emit('next')
}

// 切换真机显示模式（电脑端和手机端统一）
async function toggleDeviceMode() {
  if (isDeviceMode.value) {
    // 退出真机模式：直接退出，无动画
    exitDeviceMode()
  }
  else {
    // 进入真机模式：添加进入动画
    isDeviceMode.value = true
    // 只在手机端添加 device-mode 类（会隐藏页面其他元素）
    // 电脑端不添加，因为弹窗本身就是覆盖层
    if (isMobile.value) {
      document.body.classList.add('device-mode')
    }
    showControls.value = true
    document.body.classList.add('show-controls')

    await nextTick()
    animateDeviceModeIn()

    // 清理旧定时器并设置新定时器
    if (deviceModeTimer) {
      clearTimeout(deviceModeTimer)
      deviceModeTimer = null
    }
    // 5秒后自动隐藏控制按钮（延长显示时间，让用户看到退出提示）
    deviceModeTimer = setTimeout(() => {
      if (isDeviceMode.value) {
        showControls.value = false
        document.body.classList.remove('show-controls')
      }
      deviceModeTimer = null
    }, 5000)
  }
}

// 真机模式进入动画（优化性能，使用硬件加速）
function animateDeviceModeIn() {
  if (!phoneFrameRef.value)
    return

  // phoneFrameRef 现在指向 div.phone-frame-overlay
  const phoneFrameOverlay = phoneFrameRef.value
  const phoneFrame = phoneFrameOverlay.querySelector('.phone-frame')
  if (!phoneFrame)
    return

  // 启用硬件加速，优化性能
  gsap.set(phoneFrame, {
    willChange: 'transform, opacity',
    force3D: true,
  })

  // 重置初始状态
  gsap.set(phoneFrame, {
    scale: 0.9,
    opacity: 0,
    y: 30,
  })

  // 执行进入动画（使用更流畅的缓动函数和更短的时长）
  gsap.to(phoneFrame, {
    scale: 1,
    opacity: 1,
    y: 0,
    duration: 0.4, // 缩短动画时长，更快速流畅
    ease: 'power2.out', // 使用更简单的缓动函数，性能更好
    force3D: true, // 强制使用 3D 变换，启用硬件加速
    onComplete: () => {
      // 动画完成后清理 will-change，避免影响后续性能
      gsap.set(phoneFrame, { willChange: 'auto', clearProps: 'force3D' })
    },
  })

  // 不修改弹窗背景，完全通过 CSS 类控制

  // 控制按钮淡入（延迟更多，让手机框架动画先完成）
  if (infoRef.value) {
    gsap.fromTo(infoRef.value, {
      opacity: 0,
      y: 10,
    }, {
      opacity: 1,
      y: 0,
      duration: 0.25,
      delay: 0.2, // 延迟执行，避免同时动画
      ease: 'power2.out',
    })
  }
}

// 退出真机显示模式（只退出真机模式，不影响弹窗状态，无动画）
function exitDeviceMode() {
  // 直接退出真机模式状态，不执行动画，不修改任何样式
  // 背景颜色完全由 CSS 类控制，移除类后自动恢复
  isDeviceMode.value = false
  document.body.classList.remove('device-mode')
  document.body.classList.remove('show-controls')
  showControls.value = false
}

// 真机模式下点击屏幕切换控制按钮显示
function toggleControls() {
  if (isDeviceMode.value) {
    showControls.value = !showControls.value
    if (showControls.value) {
      document.body.classList.add('show-controls')
    }
    else {
      document.body.classList.remove('show-controls')
    }
  }
}

async function handleDownload() {
  if (!props.wallpaper || downloading.value)
    return

  downloading.value = true
  try {
    await downloadFile(props.wallpaper.url, props.wallpaper.filename)
    trackWallpaperDownload(props.wallpaper, currentSeries.value)
    // 记录到 Supabase 统计
    recordDownload(props.wallpaper, currentSeries.value)
  }
  finally {
    downloading.value = false
  }
}

// Keyboard navigation
function handleKeydown(e) {
  if (!props.isOpen)
    return

  switch (e.key) {
    case 'Escape':
      if (isDeviceMode.value) {
        exitDeviceMode()
      }
      else {
        handleClose()
      }
      break
    case 'ArrowLeft':
      if (!isDeviceMode.value) {
        handlePrev()
      }
      break
    case 'ArrowRight':
      if (!isDeviceMode.value) {
        handleNext()
      }
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.classList.remove('modal-open')
  document.body.classList.remove('device-mode')
  document.body.classList.remove('show-controls')
  document.body.style.top = ''

  // 清理真机模式定时器
  if (deviceModeTimer) {
    clearTimeout(deviceModeTimer)
    deviceModeTimer = null
  }

  if (savedScrollY.value > 0) {
    window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && wallpaper"
      ref="modalRef"
      class="portrait-modal-overlay"
      :class="{ 'is-device-mode-overlay': isDeviceMode && isMobile && canUseDeviceMode }"
      style="opacity: 0; visibility: hidden"
      @click.self="handleClose"
    >
      <div ref="contentRef" class="portrait-modal-content" :class="{ 'is-device-mode-content': isDeviceMode && isMobile && canUseDeviceMode, 'is-avatar-content': isAvatarSeries }">
        <!-- Close Button -->
        <button
          class="modal-close"
          :class="{ 'is-hidden': isDeviceMode && !showControls }"
          aria-label="关闭"
          @click="handleClose"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- 真机模式退出提示 -->
        <div
          v-if="isDeviceMode && canUseDeviceMode"
          class="device-mode-exit-hint"
          :class="{ 'is-visible': showControls }"
          @click="exitDeviceMode"
        >
          <div class="hint-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            <span>点击退出真机显示</span>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <button
          v-if="!isDeviceMode"
          class="modal-nav modal-nav--prev"
          aria-label="上一张"
          @click="handlePrev"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          v-if="!isDeviceMode"
          class="modal-nav modal-nav--next"
          aria-label="下一张"
          @click="handleNext"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <!-- Image Container - 竖屏布局 -->
        <div
          class="portrait-image-container"
          :class="{ 'is-device-mode': isDeviceMode, 'is-avatar-container': isAvatarSeries }"
          @click="toggleControls"
        >
          <!-- Loading -->
          <div v-if="!imageLoaded" class="modal-loading">
            <LoadingSpinner size="lg" />
          </div>

          <!-- Error -->
          <div v-if="imageError" class="modal-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p>图片加载失败</p>
          </div>

          <!-- 图片（始终存在，不受模式影响） -->
          <img
            v-show="imageLoaded && !imageError"
            :src="wallpaper.url"
            :alt="wallpaper.filename"
            class="portrait-image"
            :class="{
              'portrait-image--loaded': imageLoaded && !imageError,
              'portrait-image--avatar': isAvatarSeries,
              'portrait-image--in-device-mode': isDeviceMode && canUseDeviceMode,
            }"
            @load="handleImageLoad"
            @error="handleImageError"
          >

          <!-- 真机显示模式：手机框架装饰层（覆盖在图片上） -->
          <div
            v-if="isDeviceMode && canUseDeviceMode && imageLoaded && !imageError"
            ref="phoneFrameRef"
            class="phone-frame-overlay"
            :class="{ 'phone-frame-overlay--mobile': isMobile }"
          >
            <PhoneFrame>
              <!-- 框架内的图片副本 -->
              <img
                :src="wallpaper.url"
                :alt="wallpaper.filename"
                class="portrait-image portrait-image--in-frame"
              >
            </PhoneFrame>
          </div>
        </div>

        <!-- Info Panel - 底部信息栏 -->
        <div
          ref="infoRef"
          class="portrait-info"
          :class="{ 'is-hidden': isDeviceMode && !showControls }"
        >
          <!-- 图片加载中显示骨架屏 -->
          <template v-if="!imageLoaded || imageError">
            <div class="info-skeleton-compact">
              <div class="skeleton-left">
                <div class="skeleton-title" />
                <div class="skeleton-tags">
                  <div class="skeleton-tag" />
                  <div class="skeleton-tag" />
                </div>
              </div>
              <div class="skeleton-btn-small" />
            </div>
          </template>

          <!-- 图片加载完成后显示真实信息 -->
          <template v-else>
            <div class="info-main">
              <h3 class="info-title">
                {{ displayFilename }}
              </h3>
              <!-- 分类信息 -->
              <div v-if="categoryDisplay" class="info-category">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>{{ categoryDisplay }}</span>
              </div>
              <div class="info-meta">
                <div class="info-tags">
                  <span class="tag" :class="[`tag--${resolution.type || 'success'}`]">{{ resolution.label }}</span>
                  <span class="tag tag--secondary">{{ fileExt }}</span>
                  <!-- 访问量标签 -->
                  <span v-if="viewCount > 0" class="tag tag--view">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {{ viewCount }}
                  </span>
                  <!-- 下载次数标签（简化版） -->
                  <span v-if="downloadCount > 0" class="tag tag--download">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    {{ downloadCount }}
                  </span>
                </div>
                <div class="info-details">
                  <span v-if="originalResolution" class="detail-item">
                    {{ originalResolution.width }} × {{ originalResolution.height }}
                  </span>
                  <span class="detail-item">{{ formattedSize }}</span>
                  <!-- 移动端和PC端都显示准确日期 -->
                  <span class="detail-item detail-date">{{ formattedDate }}</span>
                </div>
              </div>
            </div>

            <div class="info-actions">
              <!-- 真机显示按钮（仅限手机壁纸系列） -->
              <button
                v-if="canUseDeviceMode"
                class="action-btn action-btn--secondary"
                :class="{ 'is-active': isDeviceMode }"
                :aria-label="isDeviceMode ? '退出真机显示' : '真机显示'"
                @click="toggleDeviceMode"
              >
                <svg v-if="!isDeviceMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M12 18h.01" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              <!-- 下载按钮 -->
              <button
                class="action-btn action-btn--primary"
                :disabled="downloading"
                aria-label="下载"
                @click="handleDownload"
              >
                <LoadingSpinner v-if="downloading" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.portrait-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  // 初始状态：透明，防止闪烁
  opacity: 0;
  // 普通弹窗：朦胧感的遮罩层
  background: var(--color-bg-modal);
  backdrop-filter: blur(12px);
  padding: $spacing-md;
  // 添加过渡动画，退出真机模式时平滑恢复
  transition:
    background 0.3s ease,
    backdrop-filter 0.3s ease,
    padding 0.3s ease;

  // 真机显示模式下：全屏白色背景，无 padding，靠上对齐
  &.is-device-mode-overlay {
    padding: 0;
    align-items: flex-start; // 靠上对齐
    background: #ffffff; // 真机显示时才用白色背景
    backdrop-filter: none; // 真机显示时不需要模糊
  }
}

.portrait-modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: 500px;
  width: 90vw; // 确保有足够宽度
  min-height: 70vh; // 设置最小高度,避免骨架屏太小
  max-height: 90vh;
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  // 添加过渡动画，退出真机模式时平滑恢复
  transition:
    background 0.3s ease,
    border-radius 0.3s ease,
    box-shadow 0.3s ease;

  @include mobile-only {
    width: 95vw;
    max-width: 100%;
    min-height: 75vh; // 移动端更高一些
    max-height: 95vh;
  }

  // 真机模式下：移除圆角，全屏显示
  &.is-device-mode-content {
    width: 100vw;
    max-width: 100%;
    height: 100vh;
    min-height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  // 头像系列：自适应高度，不设置固定最小高度
  &.is-avatar-content {
    min-height: auto; // 取消最小高度限制
    max-height: 90vh;

    @include mobile-only {
      min-height: auto;
      max-height: 95vh;
    }
  }
}

.modal-close {
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
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: scale(1.1);
  }

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.modal-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: $radius-full;
  color: white;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: translateY(-50%) scale(1.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }

  &--prev {
    left: $spacing-sm;
  }

  &--next {
    right: $spacing-sm;
  }
}

// 真机模式退出提示
.device-mode-exit-hint {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  cursor: pointer;

  &.is-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .hint-content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(12px);
    border-radius: $radius-xl;
    color: white;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    transition: all 0.2s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.95);
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.98);
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }

  @include mobile-only {
    top: 15px;

    .hint-content {
      padding: 8px 16px;
      font-size: 13px;

      svg {
        width: 16px;
        height: 16px;
      }
    }
  }
}

.portrait-image-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 60vh; // 竖屏壁纸需要更大的初始高度,避免加载后弹窗突然变大
  // max-height: 70vh;
  background: var(--color-bg-primary);
  overflow: hidden;

  // 真机显示模式：全屏显示
  &.is-device-mode {
    position: fixed;
    inset: 0;
    z-index: 2000;
    min-height: 100vh;
    max-height: 100vh;
    // 使用更柔和的背景色，避免与图片对比太强烈
    background: #f5f5f5; // 浅灰色背景，比纯白更柔和
    transition: background-color 0.2s ease;
  }

  // 头像系列：自适应高度，正方形图片不需要固定最小高度
  &.is-avatar-container {
    min-height: auto; // 取消最小高度限制，让图片自适应
    flex: 0 0 auto; // 不拉伸，按内容高度显示
    aspect-ratio: 1 / 1; // 保持正方形比例
    max-width: 100%;
    width: 100%; // 宽度撑满
  }

  @include mobile-only {
    min-height: 55vh; // 移动端稍小一些
    // max-height: 65vh;

    // 头像系列移动端也自适应
    &.is-avatar-container {
      min-height: auto;
    }
  }
}

// 手机框架包装器
.phone-frame-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg;

  .phone-frame {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    margin: 0 auto; // 确保居中
  }

  // 真机显示模式下的样式
  &--device-mode {
    padding: 0;
    // align-items: flex-start; // 靠上对齐
    justify-content: center;

    .phone-frame {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      padding: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      margin: 0;
      align-items: flex-start; // 手机框架也靠上
    }
  }
}

.modal-loading,
.modal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  color: var(--color-text-muted);

  svg {
    width: 48px;
    height: 48px;
  }
}

.portrait-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  // 初始状态：透明，避免白色背景闪烁
  opacity: 0;
  // 图片加载完成后通过类名触发动画
  transition: opacity 0.3s ease;

  // 头像图片（非真机模式）：正方形自适应
  &--avatar {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
    object-fit: cover;
  }

  // 在手机框架中的样式
  &--in-frame {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover; // 手机壁纸使用 cover 填充整个屏幕区域
    object-position: center; // 居中显示
    display: block; // 确保是块级元素
    // 真机模式下的图片直接显示，不需要动画
    opacity: 1;
    transition: none;
  }

  // 头像壁纸：使用 contain 保持完整显示，避免上下留白
  &--in-frame.portrait-image--avatar {
    object-fit: contain; // 头像使用 contain 保持完整显示
    background: #000000; // 黑色背景填充空白区域
  }

  // 真机显示模式：全屏显示
  &--device-mode {
    width: 100vw;
    height: 100vh;
    object-fit: cover;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2000;
  }

  // 真机模式下隐藏原始图片（框架内有副本）
  &--in-device-mode {
    visibility: hidden;
    pointer-events: none;
  }
}

// 真机模式手机框架覆盖层
.phone-frame-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;

  &--mobile {
    // 移动端全屏显示
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: #ffffff;
  }
}

// 图片加载完成后的样式
.portrait-image--loaded {
  opacity: 1;
  animation: imageReveal 0.4s ease forwards;
}

@keyframes imageReveal {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.portrait-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-md;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border);
  transition: opacity var(--transition-fast);

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

  @include mobile-only {
    padding: $spacing-sm;
    gap: $spacing-sm;
  }
}

.info-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.info-category {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  // margin-top: $spacing-xs;
  margin-bottom: $spacing-xs;
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
  font-weight: $font-weight-medium;

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
}

.info-title {
  font-size: $font-size-md; // PC端 16px
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @include mobile-only {
    font-size: $font-size-md; // 移动端也使用 16px，从 xs(12px) 增加到 md(16px)
  }
}

.info-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  padding: 2px 6px;
  font-size: 12px;
  font-weight: $font-weight-bold;
  border-radius: 4px;
  letter-spacing: 0.3px;

  &--primary {
    background: rgba(99, 102, 241, 0.15);
    color: var(--color-accent);
  }

  &--success {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }

  &--warning {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
  }

  &--info {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  &--danger {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  &--secondary {
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
  }

  &--download {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);

    svg {
      width: 10px;
      height: 10px;
    }
  }

  &--view {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;

    svg {
      width: 10px;
      height: 10px;
    }
  }
}

.info-details {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  font-size: 13px;
  color: var(--color-text-muted); // 使用 muted 颜色，更柔和
  font-weight: 400; // 降低字重，更低调

  @include mobile-only {
    gap: $spacing-xs;
    font-size: 13px; // 移动端增加到 14px，更易读
  }
}

.detail-item {
  white-space: nowrap;

  &:not(:last-child)::after {
    content: '·';
    margin-left: $spacing-xs;
    color: var(--color-text-muted);
  }
}

.info-actions {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  flex-shrink: 0;
}

// 统一的操作按钮样式
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  flex-shrink: 0;

  svg {
    width: 24px;
    height: 24px;
  }

  &:active {
    transform: scale(0.92);
  }

  // 主按钮（下载）- 填充样式
  &--primary {
    background: var(--color-accent);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);

    &:hover:not(:disabled) {
      background: var(--color-accent-hover);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  // 次按钮（真机显示）- 边框样式
  &--secondary {
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);

    &:hover {
      background: var(--color-bg-active);
      color: var(--color-text-primary);
      border-color: var(--color-text-muted);
    }

    // 激活状态（真机模式开启时）
    &.is-active {
      background: var(--color-accent);
      color: white;
      border-color: var(--color-accent);
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
    }
  }

  @include mobile-only {
    width: 44px;
    height: 44px;

    svg {
      width: 22px;
      height: 22px;
    }
  }
}

// 骨架屏样式
.info-skeleton-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: $spacing-md;
}

.skeleton-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.skeleton-title {
  height: 16px;
  width: 60%;
  background: var(--color-bg-hover);
  border-radius: 4px;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.skeleton-tags {
  display: flex;
  gap: 4px;
}

.skeleton-tag {
  height: 18px;
  width: 36px;
  background: var(--color-bg-hover);
  border-radius: 4px;
  animation: skeletonPulse 1.5s ease-in-out infinite;

  &:nth-child(2) {
    width: 30px;
    animation-delay: 0.1s;
  }
}

.skeleton-btn-small {
  height: 36px;
  width: 36px;
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);
  animation: skeletonPulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes skeletonPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
