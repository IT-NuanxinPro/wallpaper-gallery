<script setup>
/**
 * 3D 热门壁纸轮播组件
 * 效果：中间超大图，两侧层叠堆叠，星空流星背景，科技感特效
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  series: { type: String, default: 'desktop' },
  wallpapers: { type: Array, default: () => [] },
  popularityData: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

// DOM 引用
const containerRef = ref(null)
const canvasRef = ref(null)

// 状态
const currentIndex = ref(0)
const isAnimating = ref(false)
const isHovering = ref(false)
const imageLoaded = ref({})
const isEntranceReady = ref(false) // 入场动画就绪状态

// 鼠标位置追踪（科技感光效）
const mousePos = ref({ x: 0, y: 0 })

// 定时器
let autoPlayTimer = null
let particleAnimationId = null
const pendingTimers = new Set() // 追踪所有待清理的定时器

// 星空粒子
let stars = []
let shootingStars = []
let starfieldResizeHandler = null

// 配置
const CONFIG = {
  visibleCount: 7,
  minRequiredCount: 5, // 最少需要 5 张才渲染，避免数据不完整时的重复问题
  centerWidth: 900, // 增大中间图片宽度: 800 -> 900
  spacingFactor: 0.50, // 调整间距因子
  scaleDecay: 0.06, // 减小缩放衰减,让中间图更突出: 0.08 -> 0.06
  zDecay: 90,
  rotateY: 35,
  opacityDecay: 0.15,
}

// 数据就绪状态（防止数据不完整时渲染）
const isDataReady = ref(false)

// 轮播数据
const carouselList = computed(() => {
  if (props.popularityData?.length && props.wallpapers?.length) {
    return props.popularityData.slice(0, 7)
      .map((stat) => {
        const wallpaper = props.wallpapers.find(w => w.filename === stat.filename)
        return wallpaper ? { ...wallpaper, ...stat } : null
      })
      .filter(Boolean)
  }
  return []
})

// 直接使用 carouselList，不再复制数据避免重复
const extendedList = computed(() => {
  const list = carouselList.value
  // 数据不足时返回空数组，避免显示重复图片
  if (list.length < CONFIG.minRequiredCount) {
    return []
  }
  return list
})

// 计算卡片样式
function getCardStyle(index) {
  const total = extendedList.value.length
  if (total === 0)
    return {}

  // 入场动画未就绪时，所有卡片在中心位置
  if (!isEntranceReady.value) {
    return {
      transform: 'translateX(0) translateZ(0) rotateY(0deg) scale(0.3)',
      opacity: 0,
      zIndex: 50,
    }
  }

  let relativePos = index - currentIndex.value
  if (relativePos > total / 2)
    relativePos -= total
  if (relativePos < -total / 2)
    relativePos += total

  const absPos = Math.abs(relativePos)
  const halfVisible = Math.floor(CONFIG.visibleCount / 2)

  if (absPos > halfVisible + 0.5) {
    return { opacity: 0, visibility: 'hidden', zIndex: 0 }
  }

  // X轴位置 - 层叠效果
  const spacing = CONFIG.centerWidth * CONFIG.spacingFactor
  const x = relativePos * spacing

  // 缩放
  const scale = Math.max(0.5, 1 - absPos * CONFIG.scaleDecay)

  // Z轴 - 中心最前
  const z = -absPos * CONFIG.zDecay

  // Y轴旋转 - 向中心倾斜（左边向右转，右边向左转）
  let rotateY = 0
  if (relativePos !== 0) {
    rotateY = relativePos < 0
      ? CONFIG.rotateY * Math.min(absPos, 1)
      : -CONFIG.rotateY * Math.min(absPos, 1)
  }

  const opacity = Math.max(0.4, 1 - absPos * CONFIG.opacityDecay)
  const zIndex = 100 - Math.round(absPos * 10)

  return {
    transform: `translateX(${x}px) translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`,
    opacity,
    zIndex,
  }
}

function isActiveCard(index) {
  const total = extendedList.value.length
  if (total === 0)
    return false
  let relativePos = index - currentIndex.value
  if (relativePos > total / 2)
    relativePos -= total
  if (relativePos < -total / 2)
    relativePos += total
  return Math.abs(relativePos) < 0.5
}

function goToSlide(index) {
  if (isAnimating.value)
    return
  const total = extendedList.value.length
  if (total === 0)
    return

  isAnimating.value = true
  const timer = setTimeout(() => {
    isAnimating.value = false
    pendingTimers.delete(timer)
  }, 400)
  pendingTimers.add(timer)
  currentIndex.value = ((index % total) + total) % total
}

function prevSlide() {
  goToSlide(currentIndex.value - 1)
}

function nextSlide() {
  goToSlide(currentIndex.value + 1)
}

// 点击卡片 - 中心打开弹窗，其他切换
function handleCardClick(index, wallpaper) {
  if (isActiveCard(index)) {
    emit('select', wallpaper)
  }
  else {
    goToSlide(index)
  }
}

// 滚轮切换
function handleWheel(e) {
  if (isAnimating.value)
    return
  e.preventDefault()
  if (Math.abs(e.deltaX) > 30 || Math.abs(e.deltaY) > 30) {
    if (e.deltaX > 0 || e.deltaY > 0) {
      nextSlide()
    }
    else {
      prevSlide()
    }
  }
}

// 鼠标进入/离开
function handleMouseEnter() {
  isHovering.value = true
  stopAutoPlay()
}

function handleMouseLeave() {
  isHovering.value = false
  startAutoPlay()
}

// 鼠标移动追踪（科技感光效）
function handleMouseMove(e) {
  if (!containerRef.value)
    return
  const rect = containerRef.value.getBoundingClientRect()
  mousePos.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

// 光效样式
const mouseLightStyle = computed(() => ({
  left: `${mousePos.value.x}px`,
  top: `${mousePos.value.y}px`,
}))

function startAutoPlay() {
  stopAutoPlay()
  autoPlayTimer = setInterval(() => {
    if (!isAnimating.value && !isHovering.value)
      nextSlide()
  }, 2500) // 加快轮播速度: 4000ms -> 2500ms
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
}

function handleImageLoad(id) {
  imageLoaded.value[id] = true
}

function isImageLoaded(id) {
  return !!imageLoaded.value[id]
}

// ============ 星空 + 流星动画 ============
function initStarfield() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const ctx = canvas.getContext('2d')
  const container = containerRef.value

  function resize() {
    canvas.width = container.offsetWidth
    canvas.height = container.offsetHeight
  }
  resize()
  starfieldResizeHandler = resize
  window.addEventListener('resize', starfieldResizeHandler)

  // 创建星星
  stars = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 1.5 + 0.5,
    twinkleSpeed: Math.random() * 0.02 + 0.01,
    twinklePhase: Math.random() * Math.PI * 2,
  }))

  // 流星
  shootingStars = []
  function createShootingStar() {
    if (shootingStars.length < 3 && Math.random() < 0.02) {
      shootingStars.push({
        x: Math.random() * canvas.width,
        y: 0,
        length: Math.random() * 80 + 50,
        speed: Math.random() * 8 + 6,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
        opacity: 1,
      })
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制星星
    const time = Date.now() * 0.001
    stars.forEach((star) => {
      const twinkle = Math.sin(time * star.twinkleSpeed * 10 + star.twinklePhase) * 0.5 + 0.5
      const opacity = 0.3 + twinkle * 0.7

      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
      ctx.fill()

      // 星星光晕
      if (star.size > 1) {
        const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 3)
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.3})`)
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }
    })

    // 创建和绘制流星
    createShootingStar()
    shootingStars = shootingStars.filter((meteor) => {
      meteor.x += Math.cos(meteor.angle) * meteor.speed
      meteor.y += Math.sin(meteor.angle) * meteor.speed
      meteor.opacity -= 0.008

      if (meteor.opacity <= 0 || meteor.y > canvas.height)
        return false

      // 绘制流星
      const tailX = meteor.x - Math.cos(meteor.angle) * meteor.length
      const tailY = meteor.y - Math.sin(meteor.angle) * meteor.length

      const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
      gradient.addColorStop(0.7, `rgba(255, 255, 255, ${meteor.opacity * 0.5})`)
      gradient.addColorStop(1, `rgba(255, 255, 255, ${meteor.opacity})`)

      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(meteor.x, meteor.y)
      ctx.strokeStyle = gradient
      ctx.lineWidth = 2
      ctx.stroke()

      // 流星头部光点
      ctx.beginPath()
      ctx.arc(meteor.x, meteor.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${meteor.opacity})`
      ctx.fill()

      return true
    })

    particleAnimationId = requestAnimationFrame(animate)
  }

  animate()
}

function destroyStarfield() {
  if (particleAnimationId) {
    cancelAnimationFrame(particleAnimationId)
    particleAnimationId = null
  }
  if (starfieldResizeHandler) {
    window.removeEventListener('resize', starfieldResizeHandler)
    starfieldResizeHandler = null
  }
}

// 监听 series 变化，立即清空状态（避免显示旧图片）
watch(() => props.series, (newSeries, oldSeries) => {
  if (newSeries !== oldSeries && oldSeries) {
    // 系列切换时，立即清空所有状态
    imageLoaded.value = {}
    currentIndex.value = 0
    isEntranceReady.value = false
    isDataReady.value = false
    stopAutoPlay()
    destroyStarfield()
  }
})

watch(carouselList, (newList) => {
  // 数据不足时，重置状态并等待
  if (newList.length < CONFIG.minRequiredCount) {
    isDataReady.value = false
    isEntranceReady.value = false
    stopAutoPlay()
    return
  }

  // 数据充足，初始化组件
  imageLoaded.value = {}
  currentIndex.value = 0
  isEntranceReady.value = false
  isDataReady.value = true

  // 初始化星空和自动播放
  nextTick(() => {
    initStarfield()
    // 延迟触发入场动画，让卡片从中心展开
    const entranceTimer = setTimeout(() => {
      isEntranceReady.value = true
      pendingTimers.delete(entranceTimer)
      // 入场动画完成后再启动自动播放
      const autoPlayDelayTimer = setTimeout(() => {
        startAutoPlay()
        pendingTimers.delete(autoPlayDelayTimer)
      }, 600)
      pendingTimers.add(autoPlayDelayTimer)
    }, 100)
    pendingTimers.add(entranceTimer)
  })
}, { immediate: true })

// 键盘导航处理函数
function handleKeydown(e) {
  if (e.key === 'ArrowLeft')
    prevSlide()
  else if (e.key === 'ArrowRight')
    nextSlide()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopAutoPlay()
  destroyStarfield()
  // 清理所有待处理的定时器
  pendingTimers.forEach(timer => clearTimeout(timer))
  pendingTimers.clear()
})
</script>

<template>
  <!-- 骨架屏：数据加载中或数据不足 -->
  <div v-if="loading || !isDataReady" class="carousel-3d carousel-3d--loading">
    <div class="carousel-3d__header">
      <div class="skeleton-badge">
        <span class="skeleton-badge__text">🔥 热门壁纸</span>
      </div>
    </div>

    <!-- 简洁的加载提示 -->
    <div class="loading-hint">
      <div class="loading-spinner" />
      <p class="loading-hint__text">
        正在加载热门壁纸...
      </p>
    </div>
  </div>

  <!-- 3D轮播 -->
  <div
    v-else
    ref="containerRef"
    class="carousel-3d"
    :class="{ 'is-hovering': isHovering }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
    @wheel.prevent="handleWheel"
  >
    <!-- 星空画布 -->
    <canvas ref="canvasRef" class="starfield-canvas" />

    <!-- 科技感：鼠标追踪光效 -->
    <div class="mouse-light" :style="mouseLightStyle" />

    <!-- 背景 -->
    <div class="carousel-3d__bg">
      <div class="bg-glow bg-glow--left" />
      <div class="bg-glow bg-glow--right" />
    </div>

    <!-- 标题 -->
    <div class="carousel-3d__header">
      <div class="carousel-badge">
        <span class="badge-icon">🔥</span>
        <span class="badge-text">热门壁纸</span>
      </div>
    </div>

    <!-- 舞台 -->
    <div class="carousel-3d__stage">
      <!-- 镜面地板 -->
      <div class="mirror-floor">
        <div class="floor-line" />
      </div>

      <div class="carousel-3d__track">
        <div
          v-for="(wallpaper, index) in extendedList"
          :key="wallpaper.id"
          class="carousel-3d__card"
          :class="{ 'is-active': isActiveCard(index), 'is-animating': isAnimating }"
          :style="getCardStyle(index)"
          @click="handleCardClick(index, wallpaper)"
        >
          <!-- 卡片 -->
          <div class="card-inner">
            <div v-if="!isImageLoaded(wallpaper.id)" class="card-skeleton">
              <div class="skeleton-shimmer" />
            </div>
            <img
              :src="wallpaper.previewUrl || wallpaper.thumbnailUrl"
              :alt="wallpaper.filename"
              class="card-image"
              :class="{ 'is-loaded': isImageLoaded(wallpaper.id) }"
              draggable="false"
              @load="handleImageLoad(wallpaper.id)"
            >
            <!-- 科技感：全息边框脉冲 -->
            <div class="card-border" />
            <div class="card-border-pulse" />
            <div class="card-glow" />
          </div>
        </div>
      </div>
    </div>

    <!-- 导航（悬停显示） -->
    <div class="carousel-3d__nav">
      <button class="nav-btn" @click="prevSlide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button class="nav-btn" @click="nextSlide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.carousel-3d {
  position: relative;
  padding: $spacing-lg 0 0;
  margin-bottom: $spacing-xl;
  overflow: hidden;
  border-radius: $radius-2xl;
  background: linear-gradient(180deg, #05050a 0%, #0a0a12 50%, #050508 100%);
  min-height: 560px; // 增加高度以适应更大的中间图片

  // 悬停时显示导航
  &.is-hovering {
    .carousel-3d__nav {
      opacity: 1;
      visibility: visible;
    }
  }
}

// 星空画布
.starfield-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

// ============ 科技感效果 ============

// 鼠标追踪光效
.mouse-light {
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 2;
  transition: opacity 0.3s ease;
  opacity: 0;

  .carousel-3d.is-hovering & {
    opacity: 1;
  }
}

// 背景光晕
.carousel-3d__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-glow {
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.12;

  &--left {
    left: -200px;
    top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
  }

  &--right {
    right: -200px;
    top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(135deg, #f97316, #ef4444);
  }
}

// 标题
.carousel-3d__header {
  position: absolute;
  top: $spacing-lg;
  left: $spacing-lg;
  z-index: 10;
}

.carousel-badge {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-md;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: white;
  border-radius: $radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  box-shadow: 0 4px 20px rgba(249, 115, 22, 0.5);
}

// 舞台
.carousel-3d__stage {
  position: relative;
  height: 460px; // 增加舞台高度: 420px -> 460px
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1500px;
  perspective-origin: 50% 45%;
  z-index: 2;
}

// 镜面地板
.mirror-floor {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 140px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(255, 255, 255, 0.015) 50%,
    rgba(255, 255, 255, 0.03) 100%
  );
  pointer-events: none;

  .floor-line {
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.15) 30%,
      rgba(255, 255, 255, 0.25) 50%,
      rgba(255, 255, 255, 0.15) 70%,
      transparent 100%
    );
  }
}

.carousel-3d__track {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
}

// 卡片
.carousel-3d__card {
  position: absolute;
  width: 520px;
  transform-style: preserve-3d;
  transition:
    transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.5s ease;
  will-change: transform, opacity;
  cursor: pointer;

  // 入场动画：依次延迟展开
  @for $i from 0 through 6 {
    &:nth-child(#{$i + 1}) {
      transition-delay: #{$i * 0.06}s;
    }
  }

  &.is-animating {
    transition-duration: 0.4s;
    transition-delay: 0s !important;
    transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  &.is-active {
    width: 780px; // 增大中间图片: 680px -> 780px

    .card-inner {
      box-shadow:
        0 30px 100px rgba(0, 0, 0, 0.7),
        0 0 100px rgba(249, 115, 22, 0.15);
    }

    .card-border {
      opacity: 1;
    }
    .card-border-pulse {
      opacity: 1;
    }
    .card-glow {
      opacity: 1;
    }
  }

  &:not(.is-active) {
    .card-inner:hover {
      transform: scale(1.02);
    }
  }
}

.card-inner {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: $radius-lg;
  overflow: hidden;
  background: #111;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.4s ease;
  user-select: none;

  &.is-loaded {
    opacity: 1;
  }
}

.card-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #252540 100%);

  .skeleton-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%);
    animation: shimmer 2s infinite;
  }
}

// 渐变边框
.card-border {
  position: absolute;
  inset: 0;
  border-radius: $radius-lg;
  padding: 2px;
  background: linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6, #f97316, #ef4444);
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  animation: border-hue 4s linear infinite;
}

@keyframes border-hue {
  from {
    filter: hue-rotate(0deg);
  }
  to {
    filter: hue-rotate(360deg);
  }
}

// 全息边框脉冲
.card-border-pulse {
  position: absolute;
  inset: -4px;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6, #f97316, #ef4444);
  opacity: 0;
  pointer-events: none;
  animation:
    border-hue 4s linear infinite,
    border-pulse 2s ease-in-out infinite;
  filter: blur(8px);
  z-index: -1;
}

@keyframes border-pulse {
  0%,
  100% {
    opacity: 0;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.02);
  }
}

// 光晕
.card-glow {
  position: absolute;
  inset: -6px;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(249, 115, 22, 0.4), rgba(239, 68, 68, 0.4));
  filter: blur(30px);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: -1;
}

// 导航（默认隐藏，悬停显示）
.carousel-3d__nav {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-80%);
  display: flex;
  justify-content: space-between;
  padding: 0 $spacing-lg;
  pointer-events: none;
  z-index: 20;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.3s ease,
    visibility 0.3s ease;
}

.nav-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 22px;
    height: 22px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
    box-shadow: 0 0 30px rgba(249, 115, 22, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}

// 骨架屏 - 简洁加载样式
.carousel-3d--loading {
  position: relative;
  min-height: 560px;
  border-radius: $radius-2xl;
  background: linear-gradient(180deg, #0a0a15 0%, #12121f 100%);
  display: flex;
  flex-direction: column;

  .carousel-3d__header {
    position: absolute;
    top: $spacing-lg;
    left: $spacing-lg;
  }

  .skeleton-badge {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    padding: $spacing-xs $spacing-md;
    background: rgba(255, 255, 255, 0.15);
    border-radius: $radius-full;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .skeleton-badge__text {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: rgba(255, 255, 255, 0.7);
  }

  .loading-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-md;
  }

  .loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: rgba(99, 102, 241, 0.8);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-hint__text {
    font-size: $font-size-sm;
    color: rgba(255, 255, 255, 0.6);
  }
}

// 浅色主题下的骨架屏
</style>

<style lang="scss">
// 浅色主题下的骨架屏（非 scoped，用于匹配 html[data-theme='light']）
[data-theme='light'] {
  .carousel-3d--loading {
    background: linear-gradient(180deg, #e8ecf1 0%, #dde3ea 100%) !important;

    .skeleton-badge {
      background: rgba(0, 0, 0, 0.08) !important;
      border-color: rgba(0, 0, 0, 0.06) !important;
    }

    .skeleton-badge__text {
      color: rgba(0, 0, 0, 0.6) !important;
    }

    .loading-spinner {
      border-color: rgba(0, 0, 0, 0.1) !important;
      border-top-color: rgba(99, 102, 241, 0.8) !important;
    }

    .loading-hint__text {
      color: rgba(0, 0, 0, 0.5) !important;
    }
  }
}
</style>

<style lang="scss" scoped>
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

// 响应式
@media (max-width: 1200px) {
  .carousel-3d {
    min-height: 480px;
  }
  .carousel-3d__stage {
    height: 380px;
  }
  .carousel-3d__card {
    width: 420px;
    &.is-active {
      width: 600px; // 中等屏幕也增大中间图片
    }
  }
}

@media (max-width: 768px) {
  .carousel-3d {
    min-height: 400px;
  }
  .carousel-3d__stage {
    height: 320px;
  }
  .carousel-3d__card {
    width: 300px;
    &.is-active {
      width: 420px; // 小屏幕也增大中间图片
    }
  }
  .nav-btn {
    width: 40px;
    height: 40px;
  }
}
</style>
