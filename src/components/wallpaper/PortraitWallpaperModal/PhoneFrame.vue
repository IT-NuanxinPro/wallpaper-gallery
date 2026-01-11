<script setup>
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDevice } from '@/composables/useDevice'

const props = defineProps({
  isDark: {
    type: Boolean,
    default: false,
  },
  showSizeSelector: {
    type: Boolean,
    default: true,
  },
})

// 设备尺寸类型
const DEVICE_SIZES = {
  SIZE_SMALL: 'size_small', // 小屏 (5.5-5.9")：375 × 812
  SIZE_MEDIUM: 'size_medium', // 中屏 (6.0-6.3")：390 × 844
  SIZE_LARGE: 'size_large', // 大屏 (6.4-6.6")：410 × 885
  SIZE_XLARGE: 'size_xlarge', // 超大屏 (6.7"+)：430 × 932
}

// 设备尺寸配置
const deviceSizeConfig = {
  [DEVICE_SIZES.SIZE_SMALL]: {
    width: 375,
    height: 812,
    label: '小屏 (5.5-5.9")',
  },
  [DEVICE_SIZES.SIZE_MEDIUM]: {
    width: 390,
    height: 844,
    label: '中屏 (6.0-6.3")',
  },
  [DEVICE_SIZES.SIZE_LARGE]: {
    width: 410,
    height: 885,
    label: '大屏 (6.4-6.6")',
  },
  [DEVICE_SIZES.SIZE_XLARGE]: {
    width: 430,
    height: 932,
    label: '超大屏 (6.7"+)',
  },
}

// 从 localStorage 读取保存的设备尺寸，默认使用中屏
const STORAGE_KEY = 'phone-frame-device-size'
const deviceSize = ref(localStorage.getItem(STORAGE_KEY) || DEVICE_SIZES.SIZE_MEDIUM)

// 设备检测
const { isMobile, isDesktop } = useDevice()

// 选择器展开/收缩状态（PC端默认展开，移动端默认收缩）
// 初始值根据设备类型设置，但需要等待 onMounted 时再确认
const isExpanded = ref(false)

// 悬浮球和选项容器引用（悬浮球固定在右上角，不支持拖拽）
const selectorRef = ref(null)
const optionsRef = ref(null)
let expandAnimation = null

// 使用 GSAP 处理展开/收缩动画（仅移动端悬浮球使用）
async function toggleExpand(newExpanded) {
  // PC端下拉框不需要 GSAP 动画，使用 CSS transition
  if (isDesktop.value) {
    return
  }

  if (!optionsRef.value || !selectorRef.value)
    return

  // 取消之前的动画
  if (expandAnimation) {
    expandAnimation.kill()
  }

  await nextTick()

  if (newExpanded) {
    // 展开：先设置获取实际尺寸，然后从悬浮球位置展开
    gsap.set(optionsRef.value, {
      display: 'flex',
      height: 'auto',
      width: 'auto',
      opacity: 0,
      scale: 0.8,
      transformOrigin: 'top right',
    })
    const height = optionsRef.value.offsetHeight
    const width = optionsRef.value.offsetWidth
    gsap.set(optionsRef.value, {
      height: 0,
      width: 0,
      opacity: 0,
      scale: 0.8,
    })

    // 使用 GSAP Timeline 实现更丝滑的动画（无弹性效果）
    const tl = gsap.timeline()
    tl.to(optionsRef.value, {
      height,
      width,
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: 'power2.out',
    })
    expandAnimation = tl

    // 悬浮球缩小但保持显示（不消失）
    const floatingBall = selectorRef.value?.querySelector('.size-selector__floating-ball')
    if (floatingBall) {
      gsap.to(floatingBall, {
        scale: 0.7, // 缩小但不完全消失
        duration: 0.3,
        ease: 'power2.out',
      })
    }
  }
  else {
    // 收缩：先缩小，然后隐藏
    const height = optionsRef.value.offsetHeight
    const width = optionsRef.value.offsetWidth
    gsap.set(optionsRef.value, { height, width, opacity: 1, scale: 1 })

    const tl = gsap.timeline()
    tl.to(optionsRef.value, {
      height: 0,
      width: 0,
      opacity: 0,
      scale: 0.8,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        gsap.set(optionsRef.value, { height: 0, width: 0, display: 'none' })
      },
    })
    expandAnimation = tl

    // 悬浮球恢复正常大小（无延迟，立即恢复）
    const floatingBall = selectorRef.value?.querySelector('.size-selector__floating-ball')
    if (floatingBall) {
      gsap.to(floatingBall, {
        scale: 1,
        duration: 0.3,
        ease: 'power2.out',
      })
    }
  }
}

// 监听 showSizeSelector 变化，重新初始化状态
watch(() => props.showSizeSelector, (newValue) => {
  if (newValue && !isDesktop.value) {
    // 重置为收缩状态
    isExpanded.value = false
    nextTick(() => {
      if (optionsRef.value) {
        gsap.set(optionsRef.value, {
          display: 'none',
          height: 0,
          width: 0,
          opacity: 0,
          scale: 0.8,
        })
      }
      if (selectorRef.value) {
        const floatingBall = selectorRef.value.querySelector('.size-selector__floating-ball')
        if (floatingBall) {
          gsap.set(floatingBall, {
            display: 'flex',
            scale: 1,
            opacity: 1,
          })
        }
      }
    })
  }
})

// 监听设备类型变化，更新展开状态
watch(isDesktop, (newIsDesktop) => {
  isExpanded.value = newIsDesktop
})

// 监听展开状态变化（仅移动端需要动画）
watch(isExpanded, (newExpanded) => {
  if (!isDesktop.value) {
    toggleExpand(newExpanded)
  }
})

// 点击悬浮球展开/收缩
function handleFloatingBallClick(e) {
  // 阻止事件冒泡，避免触发父元素的点击事件（如真机退出提示）
  e.stopPropagation()
  e.preventDefault()
  // 直接切换展开状态
  isExpanded.value = !isExpanded.value
}

// 点击外部区域关闭展开的选项列表
function handleClickOutside(e) {
  // 如果选项列表已展开，且点击的不是选择器内的元素，则关闭
  if (isExpanded.value && selectorRef.value && !selectorRef.value.contains(e.target)) {
    isExpanded.value = false
  }
}

// 计算可用的视口高度（考虑弹窗的顶部和底部预留空间）
const availableViewportHeight = computed(() => {
  if (!isMobile.value) {
    return 0
  }

  // 移动端真机模式下：
  // - 顶部预留：40px（"点击退出真机显示"提示）
  // - 底部预留：100px（信息栏）
  // - 总预留：140px
  const reservedHeight = 140
  const viewportHeight = window.innerHeight

  // 最大可用高度为视口高度的 90%
  return Math.min(viewportHeight - reservedHeight, viewportHeight * 0.9)
})

// 计算真机框架的最大显示高度（基于视口高度）
const maxDisplayHeight = computed(() => {
  if (!isMobile.value) {
    return 0
  }

  // 根据用户选择的真机尺寸，计算合适的显示高度
  const config = deviceSizeConfig[deviceSize.value]
  if (!config) {
    return availableViewportHeight.value
  }

  // 基础高度：可用视口高度的 85%（确保有足够空间）
  const baseHeight = availableViewportHeight.value * 0.85

  // 为不同尺寸设置不同的缩放系数，确保有明显差异
  // 小屏：95%，中屏：100%，大屏：105%，超大屏：110%
  const sizeScales = {
    [DEVICE_SIZES.SIZE_SMALL]: 0.95,
    [DEVICE_SIZES.SIZE_MEDIUM]: 1.0,
    [DEVICE_SIZES.SIZE_LARGE]: 1.05,
    [DEVICE_SIZES.SIZE_XLARGE]: 1.1,
  }

  const scaleFactor = sizeScales[deviceSize.value] || 1.0
  const displayHeight = Math.floor(baseHeight * scaleFactor)

  // 确保不超过可用视口高度的 95%
  return Math.min(displayHeight, availableViewportHeight.value * 0.95)
})

// 当前设备尺寸配置（根据屏幕大小选择 PC 端或移动端尺寸）
const currentSizeConfig = computed(() => {
  const config = deviceSizeConfig[deviceSize.value] || deviceSizeConfig[DEVICE_SIZES.SIZE_MEDIUM]

  // PC端：直接使用配置的尺寸
  if (!isMobile.value) {
    return config
  }

  // 移动端：根据可用视口高度，动态计算显示尺寸
  const displayHeight = maxDisplayHeight.value
  const aspectRatio = config.width / config.height
  const displayWidth = Math.floor(displayHeight * aspectRatio)

  return {
    width: displayWidth,
    height: displayHeight,
    label: config.label,
  }
})

// 处理尺寸切换
function handleSizeChange(size) {
  deviceSize.value = size
  localStorage.setItem(STORAGE_KEY, size)
  // 立即收缩，没有延迟（更丝滑）
  isExpanded.value = false
}

// LocalStorage 兼容性：旧键值迁移到新键值
const KEY_MIGRATION = {
  standard: DEVICE_SIZES.SIZE_MEDIUM,
  pro: DEVICE_SIZES.SIZE_LARGE,
  proMax: DEVICE_SIZES.SIZE_XLARGE,
}

const currentTime = ref('00:14')
let timeInterval = null

function updateTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

// 启动时钟定时器
function startTimeTimer() {
  if (timeInterval) return
  updateTime()
  timeInterval = setInterval(updateTime, 1000)
}

// 停止时钟定时器
function stopTimeTimer() {
  if (timeInterval) {
    clearInterval(timeInterval)
    timeInterval = null
  }
}

// 使用 Intersection Observer 实现懒启动
let observer = null

function setupVisibilityObserver(el) {
  if (!el || observer) return

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          startTimeTimer()
        } else {
          stopTimeTimer()
        }
      })
    },
    { threshold: 0.1 }
  )
  observer.observe(el)
}

// 组件根元素引用
const phoneFrameRef = ref(null)

onMounted(() => {
  // LocalStorage 兼容性：初始化时检查并迁移旧键值
  const storedSize = localStorage.getItem(STORAGE_KEY)
  if (storedSize && KEY_MIGRATION[storedSize]) {
    localStorage.setItem(STORAGE_KEY, KEY_MIGRATION[storedSize])
    deviceSize.value = KEY_MIGRATION[storedSize]
  }

  // 根据设备类型初始化展开状态
  isExpanded.value = isDesktop.value

  // 初始化展开状态（仅移动端）
  nextTick(() => {
    // 设置可见性监听（懒启动时钟）
    if (phoneFrameRef.value) {
      setupVisibilityObserver(phoneFrameRef.value)
    }

    // PC端下拉框不需要初始化动画
    if (isDesktop.value) {
      return
    }

    if (optionsRef.value) {
      if (isExpanded.value) {
        gsap.set(optionsRef.value, {
          display: 'flex',
          height: 'auto',
          width: 'auto',
          opacity: 1,
          scale: 1,
        })
      }
      else {
        gsap.set(optionsRef.value, {
          display: 'none',
          height: 0,
          width: 0,
          opacity: 0,
          scale: 0.8,
        })
      }
    }

    // 确保悬浮球默认显示（如果未展开）
    if (selectorRef.value && !isExpanded.value) {
      const floatingBall = selectorRef.value.querySelector('.size-selector__floating-ball')
      if (floatingBall) {
        gsap.set(floatingBall, {
          display: 'flex',
          scale: 1,
          opacity: 1,
        })
      }
    }
  })

  // 添加全局点击事件监听（用于点击外部关闭）
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  // 停止时钟定时器
  stopTimeTimer()
  // 清理 Intersection Observer
  if (observer) {
    observer.disconnect()
    observer = null
  }
  // 清理 GSAP 动画
  if (expandAnimation) {
    expandAnimation.kill()
  }
  // 移除全局事件监听
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="phoneFrameRef" class="phone-frame" :class="{ 'phone-frame--dark': isDark }">
    <!-- 移动端：悬浮球形式，使用 Teleport 移到 body 避免受祖先元素 transform 影响 -->
    <Teleport v-if="!isDesktop && props.showSizeSelector" to="body">
      <div
        ref="selectorRef"
        class="phone-frame__size-selector phone-frame__size-selector--floating"
        :class="{ 'is-expanded': isExpanded }"
      >
        <!-- 悬浮球（固定在右上角，点击展开选项） -->
        <button
          class="size-selector__floating-ball"
          @click.stop="handleFloatingBallClick"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </button>

        <!-- 展开的选项列表 -->
        <div
          ref="optionsRef"
          class="size-selector__options"
        >
          <!-- 移动端：选项列表头部 -->
          <div class="size-selector__header">
            <span class="header__label">设备尺寸</span>
            <button
              class="header__close"
              @click.stop="isExpanded = false"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            class="size-option"
            :class="{ 'is-active': deviceSize === DEVICE_SIZES.SIZE_SMALL }"
            @click.stop="handleSizeChange(DEVICE_SIZES.SIZE_SMALL)"
          >
            <span class="size-option__label">小屏 (5.5-5.9")</span>
            <span class="size-option__dimensions">375×812</span>
          </button>
          <button
            class="size-option"
            :class="{ 'is-active': deviceSize === DEVICE_SIZES.SIZE_MEDIUM }"
            @click.stop="handleSizeChange(DEVICE_SIZES.SIZE_MEDIUM)"
          >
            <span class="size-option__label">中屏 (6.0-6.3")</span>
            <span class="size-option__dimensions">390×844</span>
          </button>
          <button
            class="size-option"
            :class="{ 'is-active': deviceSize === DEVICE_SIZES.SIZE_LARGE }"
            @click.stop="handleSizeChange(DEVICE_SIZES.SIZE_LARGE)"
          >
            <span class="size-option__label">大屏 (6.4-6.6")</span>
            <span class="size-option__dimensions">410×885</span>
          </button>
          <button
            class="size-option"
            :class="{ 'is-active': deviceSize === DEVICE_SIZES.SIZE_XLARGE }"
            @click.stop="handleSizeChange(DEVICE_SIZES.SIZE_XLARGE)"
          >
            <span class="size-option__label">超大屏 (6.7"+)</span>
            <span class="size-option__dimensions">430×932</span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 手机外框 -->
    <div
      class="phone-frame__device"
      :style="{
        width: `${currentSizeConfig.width}px`,
        height: `${currentSizeConfig.height}px`,
      }"
    >
      <!-- 顶部刘海/听筒 -->
      <div class="phone-frame__notch">
        <div class="phone-frame__speaker" />
      </div>

      <!-- 屏幕区域 -->
      <div class="phone-frame__screen">
        <!-- Dynamic Island (iPhone 16/14 样式) - 单独显示，不包含时间 -->
        <div class="phone-frame__dynamic-island" />

        <!-- 壁纸内容区域 -->
        <div class="phone-frame__content">
          <slot />
          <!-- 时间显示在壁纸中间，大字体加粗 -->
          <div class="phone-frame__wallpaper-time">
            {{ currentTime }}
          </div>
        </div>
      </div>

      <!-- 底部指示器（Home Indicator） -->
      <div class="phone-frame__home-indicator" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.phone-frame {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: $spacing-xl;
  &--dark {
    background: #f5f5f5;
  }
}

// 设备尺寸选择器（仅移动端使用）
.phone-frame__size-selector {
  z-index: 10000; // 确保在真机退出提示（9999）之上
}

// 移动端：悬浮球形式，固定在右上角
.phone-frame__size-selector--floating {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex !important; // 确保显示
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none; // 默认不阻挡，展开后恢复
  z-index: 10000; // 确保在最上层

  &.is-expanded {
    pointer-events: auto;
  }
}

// 悬浮球（固定在右上角）
.size-selector__floating-ball {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  border: none;
  border-radius: $radius-full;
  color: #ffffff;
  cursor: pointer;
  pointer-events: auto;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.25),
    0 2px 10px rgba(0, 0, 0, 0.15),
    0 0 0 2px rgba(255, 255, 255, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    transform: scale(1.1);
    box-shadow:
      0 6px 28px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      0 0 0 3px rgba(255, 255, 255, 0.15);
  }

  &:active {
    transform: scale(0.95);
  }
}

// 展开的选项列表
.size-selector__options {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 移动端悬浮球选项列表样式
.phone-frame__size-selector--floating .size-selector__options {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 160px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: $radius-lg;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.2),
    0 4px 16px rgba(0, 0, 0, 0.15),
    0 2px 8px rgba(0, 0, 0, 0.1);
  pointer-events: auto;
  transform-origin: top right;
  will-change: transform, opacity, height, width;
}

// 选项列表头部
.size-selector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.02);

  .header__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: #000000;
  }

  .header__close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: $radius-sm;
    color: rgba(0, 0, 0, 0.6);
    cursor: pointer;
    transition: all 0.2s ease;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background: rgba(0, 0, 0, 0.08);
      color: #000000;
    }
  }
}

.size-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  &.is-active {
    background: #000000;
    color: #ffffff;

    .size-option__label {
      color: #ffffff;
      font-weight: $font-weight-semibold;
    }

    .size-option__dimensions {
      color: rgba(255, 255, 255, 0.85);
    }
  }

  &:active {
    transform: scale(0.98);
    background: rgba(0, 0, 0, 0.06);
  }
}

.size-option__label {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: #000000;
}

.size-option__dimensions {
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: rgba(0, 0, 0, 0.6);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
}

// GSAP 动画已处理展开/收缩，无需 CSS transition

.phone-frame__device {
  position: relative;
  // 尺寸通过内联样式动态设置
  background: #000;
  border-radius: 50px; // 苹果大R角设计
  padding: 8px;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.1),
    inset 0 0 0 2px rgba(0, 0, 0, 0.2),
    0 10px 40px rgba(0, 0, 0, 0.5);
  transition:
    width 0.3s ease,
    height 0.3s ease;
}

// Dynamic Island (iPhone 16/14 样式) - 单独显示，不包含内容
.phone-frame__dynamic-island {
  position: absolute;
  top: 0; // 和状态栏平齐
  left: 50%;
  transform: translateX(-50%);
  width: 125px; // 增加宽度：110px -> 140px
  height: 30px; // 降低高度：35px -> 28px
  background: #000;
  border-radius: 30px;
  z-index: 10;
  margin-top: 8px; // 稍微下移一点，和状态栏对齐
}

// 壁纸靠上显示的时间（大字体加粗）
.phone-frame__wallpaper-time {
  position: absolute;
  top: 5%; // 向上移动：12% -> 8%
  left: 50%;
  transform: translateX(-50%); // 只水平居中
  font-size: 90px; // 字体大小：105px -> 90px（改小）
  font-weight: 600; // 加粗
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
  letter-spacing: 2px; // 增加数字间隔：-2px -> 8px
  white-space: nowrap;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); // 添加阴影增强可读性
  z-index: 5;
  pointer-events: none; // 不阻挡点击
}

.phone-frame__screen {
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 42px; // 与外壳R角匹配
  overflow: hidden;
  position: relative;
}

.phone-frame__content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.phone-frame__home-indicator {
  position: absolute;
  bottom: 18px; // 距离底部更高
  left: 50%;
  transform: translateX(-50%);
  width: 134px;
  height: 6px; // 更粗一点
  background: #ffffff; // 白色
  border-radius: 3px;
  z-index: 10;
}

// 响应式调整
@media (max-width: 768px) {
  .phone-frame {
    padding: $spacing-md;
    background: rgba(255, 255, 255, 0.98); // 移动端也使用亮色背景
  }

  .phone-frame__device {
    // 移动端尺寸通过内联样式动态设置
    border-radius: 42px; // 移动端也使用大R角
  }

  .phone-frame__size-selector {
    top: $spacing-sm;
    right: $spacing-sm;
    min-width: 120px;
    border-radius: $radius-md;
  }

  .size-option {
    padding: 8px 12px;
  }

  .size-option__label {
    font-size: $font-size-xs;
  }

  .size-option__dimensions {
    font-size: 10px;
  }

  .phone-frame__screen {
    border-radius: 36px; // 与外壳R角匹配
  }

  .phone-frame__dynamic-island {
    top: 0;
    width: 120px; // 增加宽度：110px -> 120px
    height: 26px; // 降低高度：32px -> 26px
    border-radius: 16px;
    margin-top: 6px;
  }

  .phone-frame__wallpaper-time {
    font-size: 65px; // 字体大小：80px -> 65px（改小）
    letter-spacing: 6px; // 增加数字间隔：-1.5px -> 6px
  }

  .phone-frame__home-indicator {
    bottom: 16px; // 移动端也调整
  }

  // 移动端悬浮球优化
  .phone-frame__size-selector {
    .size-selector__floating-ball {
      width: 52px;
      height: 52px;
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.3),
        0 2px 8px rgba(0, 0, 0, 0.2),
        0 0 0 2px rgba(255, 255, 255, 0.15);

      svg {
        width: 22px;
        height: 22px;
      }

      &:active {
        transform: scale(0.92);
      }
    }

    .size-selector__options {
      min-width: 150px;
      border-radius: $radius-md;
    }

    .size-selector__header {
      padding: 10px 12px;
    }

    .size-option {
      padding: 10px 12px;
    }
  }
}
</style>
