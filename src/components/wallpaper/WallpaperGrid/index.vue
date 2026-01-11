<script setup>
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { useDevice } from '@/composables/useDevice'
import { useViewMode } from '@/composables/useViewMode'
import { useWallpaperType } from '@/composables/useWallpaperType'
import WallpaperCard from '../WallpaperCard.vue'

const props = defineProps({
  wallpapers: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  // 原始壁纸总数（未筛选前）
  totalCount: {
    type: Number,
    default: 0,
  },
  // 是否有筛选条件激活
  hasFilters: {
    type: Boolean,
    default: false,
  },
  // 热门数据（从父组件传入，避免重复请求）
  popularityData: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['select', 'resetFilters'])

// 注册 GSAP Flip 插件
gsap.registerPlugin(Flip)

const router = useRouter()
const { currentSeries, currentSeriesConfig, availableSeriesOptions } = useWallpaperType()
const { viewMode, setViewMode } = useViewMode()
const { isMobile, isMobileOrTablet } = useDevice()

// 从 props.popularityData 获取热门排名、下载次数和访问量
function getPopularRank(filename) {
  if (!props.popularityData || props.popularityData.length === 0) {
    return 0
  }
  const index = props.popularityData.findIndex(item => item.filename === filename)
  return index !== -1 ? index + 1 : 0
}

function getDownloadCount(filename) {
  if (!props.popularityData || props.popularityData.length === 0) {
    return 0
  }
  const item = props.popularityData.find(item => item.filename === filename)
  return item?.download_count || 0
}

function getViewCount(filename) {
  if (!props.popularityData || props.popularityData.length === 0) {
    return 0
  }
  const item = props.popularityData.find(item => item.filename === filename)
  return item?.view_count || 0
}

const gridRef = ref(null)
const wrapperRef = ref(null)
const isAnimating = ref(false)
// 用于控制动画切换的视图模式（PC端和移动端统一使用）
const displayViewMode = ref(viewMode.value)
// 实际渲染使用的视图模式
const effectiveViewMode = computed(() => {
  if (isMobileOrTablet.value) {
    // 移动端：只支持 grid 和 list，瀑布流自动转为 grid
    const mode = displayViewMode.value
    return mode === 'masonry' ? 'grid' : mode
  }
  return displayViewMode.value
})

// ========================================
// 滚动加载相关（移动端和桌面端统一使用）
// ========================================
const PAGE_SIZE = 20
const displayCount = ref(PAGE_SIZE)
const isLoadingMore = ref(false)
const scrollPaused = ref(false) // 滚动加载暂停标记

// 定时器引用集合（用于组件卸载时清理）
const timers = new Set()

// 显示的项目
const displayedItems = computed(() => {
  return props.wallpapers.slice(0, displayCount.value)
})

// 是否还有更多数据可加载
const hasMoreData = computed(() => {
  return displayCount.value < props.wallpapers.length
})

// 滚动加载处理（移动端和桌面端统一使用）
function handleScroll() {
  if (scrollPaused.value || isLoadingMore.value || !hasMoreData.value)
    return

  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const windowHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight

  // 距离底部 200px 时触发加载
  if (scrollTop + windowHeight >= documentHeight - 200) {
    loadMore()
  }
}

// 加载更多
function loadMore() {
  if (isLoadingMore.value || !hasMoreData.value)
    return

  isLoadingMore.value = true

  const timer = setTimeout(() => {
    timers.delete(timer)
    const newCount = Math.min(
      displayCount.value + PAGE_SIZE,
      props.wallpapers.length,
    )
    displayCount.value = newCount
    isLoadingMore.value = false
  }, 150)
  timers.add(timer)
}

// 暂停滚动加载
function pauseScrollLoad() {
  scrollPaused.value = true
}

// 恢复滚动加载
function resumeScrollLoad() {
  scrollPaused.value = false
}

// 空状态类型判断
const emptyStateType = computed(() => {
  if (props.loading)
    return 'loading'
  if (props.wallpapers.length === 0) {
    // 如果有筛选条件或搜索词，说明是筛选后无结果
    if (props.hasFilters || props.searchQuery) {
      return 'no-filter-results'
    }
    // 否则是系列本身没有数据
    return 'no-series-data'
  }
  return null
})

// 当前系列的名称
const currentSeriesName = computed(() => {
  return currentSeriesConfig.value?.name || '壁纸'
})

// 计算比例类型（用于优化瀑布流列数）
const aspectType = computed(() => {
  const ratio = currentSeriesConfig.value?.aspectRatio || '16/10'
  const [w, h] = ratio.split('/').map(Number)
  if (w < h)
    return 'portrait' // 竖屏
  if (w === h)
    return 'square' // 正方形
  return 'landscape'
})

// 获取其他可用系列（用于快捷跳转）
const alternativeSeries = computed(() => {
  return availableSeriesOptions.value.filter(opt => opt.id !== currentSeries.value)
})

// 跳转到其他系列
function navigateToSeries(seriesId) {
  router.push(`/${seriesId}`)
}

// 重置筛选条件
function handleResetFilters() {
  emit('resetFilters')
}

// ========================================
// 分页（已弃用，改用滚动加载）
// ========================================
// const DEFAULT_PAGE_SIZE = 30
// const PAGE_SIZES = [10, 20, 30, 50]
// const wallpapersRef = computed(() => props.wallpapers)
// const {
//   currentPage,
//   pageSize,
//   displayedItems: paginatedItems,
//   goToPage,
//   setPageSize,
//   pausePagination,
//   resumePagination,
// } = usePagination(wallpapersRef, DEFAULT_PAGE_SIZE)

// 用于控制列表显示的状态，避免闪烁
const showGrid = ref(true)

// ========================================
// 移动端手势滑动支持（网格和列表两种模式）
// ========================================
const MOBILE_VIEW_MODE_ORDER = ['grid', 'list']
const PC_VIEW_MODE_ORDER = ['grid', 'masonry', 'list']

function getModeIndex(mode) {
  const order = isMobileOrTablet.value ? MOBILE_VIEW_MODE_ORDER : PC_VIEW_MODE_ORDER
  return order.indexOf(mode)
}

const touchStartX = ref(0)
const touchStartY = ref(0)
const isSwiping = ref(false)

function handleTouchStart(e) {
  if (!isMobileOrTablet.value)
    return
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
  isSwiping.value = false
}

function handleTouchMove(e) {
  if (!isMobileOrTablet.value)
    return

  const deltaX = e.touches[0].clientX - touchStartX.value
  const deltaY = e.touches[0].clientY - touchStartY.value

  // 判断是否是水平滑动（水平位移 > 垂直位移 * 1.5）
  if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 30) {
    isSwiping.value = true
  }
}

function handleTouchEnd(e) {
  if (!isMobileOrTablet.value || !isSwiping.value)
    return

  const deltaX = e.changedTouches[0].clientX - touchStartX.value
  const viewModeOrder = isMobileOrTablet.value ? MOBILE_VIEW_MODE_ORDER : PC_VIEW_MODE_ORDER

  // 滑动距离超过 80px 才触发切换
  if (Math.abs(deltaX) > 80) {
    const currentIndex = getModeIndex(viewMode.value)
    let newIndex

    if (deltaX < 0) {
      // 向左滑 → 下一个模式
      newIndex = (currentIndex + 1) % viewModeOrder.length
    }
    else {
      // 向右滑 → 上一个模式
      newIndex = (currentIndex - 1 + viewModeOrder.length) % viewModeOrder.length
    }

    // 直接切换视图模式（无动画）
    setViewMode(viewModeOrder[newIndex])
  }

  isSwiping.value = false
}

// Flip 插件预热标记
const isFlipWarmedUp = ref(false)

// ========================================
// 视图切换动画 - 使用 GSAP Flip 实现丝滑形态变换
// 移动端和 PC 端统一支持（移动端只有 grid/list 两种模式）
// ========================================
watch(viewMode, async (newMode, oldMode) => {
  if (!gridRef.value || newMode === oldMode)
    return

  // 如果正在动画中，先终止之前的动画
  if (isAnimating.value) {
    gsap.killTweensOf('.wallpaper-card')
  }

  isAnimating.value = true
  // 暂停滚动加载，防止动画期间数据变化
  pauseScrollLoad()

  try {
    const cards = gridRef.value.querySelectorAll('.wallpaper-card')

    if (cards.length === 0) {
      displayViewMode.value = newMode
      isAnimating.value = false
      resumeScrollLoad()
      return
    }

    // 在 wrapper 上设置 minHeight，避免影响 grid 内部布局
    if (wrapperRef.value) {
      const currentHeight = wrapperRef.value.offsetHeight
      wrapperRef.value.style.minHeight = `${currentHeight}px`
    }

    // 记录当前卡片的位置和尺寸状态
    const state = Flip.getState(cards, {
      simple: true,
    })

    // 切换布局类
    displayViewMode.value = newMode
    await nextTick()

    // 移动端使用更快的动画，减少等待感
    const animationConfig = isMobileOrTablet.value
      ? {
          duration: 0.35,
          ease: 'power2.out',
          stagger: {
            amount: 0.08,
            from: 'start',
            grid: [2, 'auto'], // 移动端 2 列布局
          },
        }
      : {
          duration: 0.45,
          ease: 'power2.inOut',
          stagger: {
            amount: 0.12,
            from: 'start',
          },
        }

    // 执行 Flip 动画
    Flip.from(state, {
      ...animationConfig,
      absolute: true,
      scale: true,
      onComplete: () => {
        isAnimating.value = false
        isFlipWarmedUp.value = true
        resumeScrollLoad()
        // 动画完成后清除固定高度
        if (wrapperRef.value) {
          wrapperRef.value.style.minHeight = ''
        }
      },
    })
  }
  catch (error) {
    console.warn('View mode animation error:', error)
    displayViewMode.value = newMode
    isAnimating.value = false
    resumeScrollLoad()
    // 错误时也要清除固定高度
    if (wrapperRef.value) {
      wrapperRef.value.style.minHeight = ''
    }
  }
})

// 预热 Flip 插件
function warmupFlip() {
  if (isFlipWarmedUp.value || !gridRef.value)
    return

  const cards = gridRef.value.querySelectorAll('.wallpaper-card')
  if (cards.length > 0) {
    Flip.getState(cards, { simple: true })
    isFlipWarmedUp.value = true
  }
}

// 页面切换时的入场动画
function animateCardsIn() {
  if (!gridRef.value)
    return

  nextTick(() => {
    const cards = gridRef.value?.querySelectorAll('.wallpaper-card')
    if (cards && cards.length > 0) {
      // 移动端使用更有活力的弹出动画
      if (isMobileOrTablet.value) {
        gsap.set(cards, {
          opacity: 0,
          scale: 0.85,
          y: 20,
        })

        gsap.to(cards, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.4,
          stagger: {
            amount: 0.35,
            from: 'start',
            grid: [2, 'auto'], // 2列网格的动画顺序
          },
          ease: 'back.out(1.2)',
          onComplete: () => {
            cards.forEach((card) => {
              card.style.transform = ''
              card.style.opacity = ''
            })
          },
        })
      }
      else {
        // PC端保持原有的简洁动画
        gsap.set(cards, {
          opacity: 0,
          y: 15,
        })

        gsap.to(cards, {
          opacity: 1,
          y: 0,
          duration: 0.3,
          stagger: {
            amount: 0.2,
            from: 'start',
          },
          ease: 'power2.out',
          onComplete: () => {
            cards.forEach((card) => {
              card.style.transform = ''
              card.style.opacity = ''
            })
            warmupFlip()
          },
        })
      }
    }
  })
}

// 初始加载动画
onMounted(() => {
  // 添加滚动监听
  window.addEventListener('scroll', handleScroll)

  if (gridRef.value && displayedItems.value.length > 0) {
    animateCardsIn()
  }
  else {
    const timer = setTimeout(() => {
      timers.delete(timer)
      warmupFlip()
    }, 500)
    timers.add(timer)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  // 清除所有未完成的定时器
  timers.forEach(timer => clearTimeout(timer))
  timers.clear()
  
  // 清理所有 GSAP 动画，防止内存泄漏
  gsap.killTweensOf('.wallpaper-card')
  if (gridRef.value) {
    const cards = gridRef.value.querySelectorAll('.wallpaper-card')
    if (cards.length > 0) {
      gsap.killTweensOf(cards)
    }
  }
})

// 监听 wallpapers 变化（筛选/搜索/分类切换时）
// 使用标记防止重复动画
let animationPending = false

watch(() => props.wallpapers, async (newVal, oldVal) => {
  // 防止重复触发
  if (animationPending) {
    return
  }

  // 如果是后台数据追加（长度增加但前面的元素不变），不触发重置
  const isBackgroundAppend = oldVal
    && oldVal.length > 0
    && newVal
    && newVal.length > oldVal.length
    && oldVal.length >= PAGE_SIZE
    && newVal[0]?.id === oldVal[0]?.id

  // 后台追加数据时，不需要重置显示数量
  if (isBackgroundAppend) {
    return
  }

  animationPending = true

  // 重置显示数量（仅在非后台追加时）
  displayCount.value = PAGE_SIZE

  // 首次加载（从无到有）
  if (!oldVal || oldVal.length === 0) {
    showGrid.value = true
    await nextTick()
    // 首次加载也执行入场动画
    if (newVal && newVal.length > 0) {
      animateCardsIn()
    }
    else {
      warmupFlip()
    }
    animationPending = false
    return
  }

  // 数据相同，不触发动画
  if (newVal === oldVal || (newVal?.length === oldVal?.length && newVal?.[0]?.id === oldVal?.[0]?.id)) {
    animationPending = false
    return
  }

  // 分类切换/筛选（从有到有）：先隐藏，再显示并执行动画
  showGrid.value = false

  const timer = setTimeout(() => {
    timers.delete(timer)
    showGrid.value = true
    nextTick(() => {
      animateCardsIn()
      animationPending = false
    })
  }, 100)
  timers.add(timer)
}, { deep: false })

// ========================================
// 分页处理（已弃用，改用滚动加载）
// ========================================
// // 处理分页切换（桌面端）
// function handlePageChange(page) {
//   // 滚动到顶部
//   window.scrollTo({ top: 0, behavior: 'smooth' })
//
//   // 短暂隐藏后切换页面并播放动画
//   showGrid.value = false
//
//   const timer = setTimeout(() => {
//     timers.delete(timer)
//     goToPage(page)
//     showGrid.value = true
//     nextTick(() => {
//       animateCardsIn()
//     })
//   }, 100)
//   timers.add(timer)
// }
//
// // 处理每页条数变化（桌面端）
// function handlePageSizeChange(size) {
//   // 滚动到顶部
//   window.scrollTo({ top: 0, behavior: 'smooth' })
//
//   showGrid.value = false
//
//   const timer = setTimeout(() => {
//     timers.delete(timer)
//     setPageSize(size)
//     showGrid.value = true
//     nextTick(() => {
//       animateCardsIn()
//     })
//   }, 100)
//   timers.add(timer)
// }

function handleSelect(wallpaper) {
  emit('select', wallpaper)
}

// 骨架屏数量
const skeletonCount = computed(() => isMobile.value ? 6 : 12)
</script>

<template>
  <div ref="wrapperRef" class="wallpaper-grid-wrapper">
    <!-- Loading State: 骨架屏 -->
    <div v-if="loading" class="loading-state">
      <!-- 移动端加载提示 -->
      <div v-if="isMobileOrTablet" class="mobile-loading-hint">
        <LoadingSpinner size="md" />
        <p class="loading-text">
          正在加载{{ currentSeriesName }}...
        </p>
      </div>

      <!-- 骨架屏 -->
      <div class="wallpaper-grid skeleton-grid" :class="[`view-${effectiveViewMode}`, `aspect-${aspectType}`]">
        <div v-for="n in skeletonCount" :key="n" class="skeleton-card">
          <div class="skeleton-image">
            <div class="skeleton-shimmer" />
          </div>
          <!-- 桌面端显示骨架信息 -->
          <div v-if="!isMobileOrTablet" class="skeleton-info">
            <div class="skeleton-title" />
            <div class="skeleton-meta" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State: 系列数据为空 -->
    <div v-else-if="emptyStateType === 'no-series-data'" class="grid-empty series-empty">
      <div class="empty-icon">
        <!-- 根据系列显示不同图标 -->
        <svg v-if="currentSeries === 'desktop'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <svg v-else-if="currentSeries === 'mobile'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
        <svg v-else-if="currentSeries === 'avatar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
      <h3>暂无{{ currentSeriesName }}</h3>
      <p>该分类暂时没有内容，敬请期待~</p>
      <!-- 快捷跳转按钮 -->
      <div v-if="alternativeSeries.length > 0" class="empty-actions">
        <button
          v-for="series in alternativeSeries"
          :key="series.id"
          class="action-btn"
          @click="navigateToSeries(series.id)"
        >
          查看{{ series.name }}
        </button>
      </div>
    </div>

    <!-- Empty State: 筛选后无结果 -->
    <div v-else-if="emptyStateType === 'no-filter-results'" class="grid-empty filter-empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
          <path d="M8 8l6 6M14 8l-6 6" />
        </svg>
      </div>
      <h3>没有找到匹配的壁纸</h3>
      <p>尝试调整搜索条件或筛选器</p>
      <div class="empty-actions">
        <button class="action-btn primary" @click="handleResetFilters">
          清除筛选条件
        </button>
      </div>
    </div>

    <!-- Grid -->
    <template v-else>
      <!-- 壁纸网格（网格、列表、PC瀑布流） -->
      <div
        ref="gridRef"
        class="wallpaper-grid"
        :class="[`view-${effectiveViewMode}`, `aspect-${aspectType}`, { 'is-hidden': !showGrid, 'is-animating': isAnimating }]"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <WallpaperCard
          v-for="(wallpaper, index) in displayedItems"
          :key="wallpaper.id"
          :wallpaper="wallpaper"
          :index="index"
          :search-query="searchQuery"
          :view-mode="effectiveViewMode"
          :aspect-ratio="currentSeriesConfig?.aspectRatio || '16/10'"
          :popular-rank="getPopularRank(wallpaper.filename)"
          :download-count="getDownloadCount(wallpaper.filename)"
          :view-count="getViewCount(wallpaper.filename)"
          @click="handleSelect"
        />
      </div>

      <!-- 加载中提示（滚动加载） -->
      <div v-if="isLoadingMore" class="mobile-load-more">
        <div class="loading-more">
          <LoadingSpinner size="sm" />
          <span>加载中...</span>
        </div>
      </div>

      <!-- 桌面端：分页（已弃用，改用滚动加载） -->
      <!-- <Pagination
        v-if="!isMobile && !isAnimating"
        :current="currentPage"
        :total="wallpapers.length"
        :page-size="pageSize"
        :page-sizes="PAGE_SIZES"
        @change="handlePageChange"
        @size-change="handlePageSizeChange"
      /> -->
    </template>
  </div>
</template>

<style lang="scss" scoped>
.wallpaper-grid-wrapper {
  min-height: 400px;
  overflow-x: hidden; // 防止动画时出现横向滚动条
}

// ========================================
// 骨架屏样式
// ========================================
.skeleton-grid {
  animation: fadeIn 0.3s ease;
}

.skeleton-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  @include mobile-only {
    border-radius: var(--radius-sm);
  }
}

.skeleton-image {
  position: relative;
  width: 100%;
  aspect-ratio: 9 / 16; // 默认竖屏比例
  background: var(--color-bg-hover);
  overflow: hidden;

  .aspect-landscape & {
    aspect-ratio: 16 / 10;
  }

  .aspect-square & {
    aspect-ratio: 1 / 1;
  }
}

.skeleton-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, var(--color-bg-card) 50%, transparent 100%);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.skeleton-info {
  padding: $spacing-md;
}

.skeleton-title {
  height: 16px;
  width: 70%;
  background: var(--color-bg-hover);
  border-radius: $radius-sm;
  margin-bottom: $spacing-sm;
}

.skeleton-meta {
  height: 12px;
  width: 40%;
  background: var(--color-bg-hover);
  border-radius: $radius-sm;
}

// ========================================
// 移动端首次加载提示
// ========================================
.loading-state {
  position: relative;
}

.mobile-loading-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-xl 0;
  margin-bottom: $spacing-md;

  .loading-text {
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

// ========================================
// 移动端加载更多
// ========================================
.mobile-load-more {
  padding: $spacing-lg 0;
  text-align: center;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  color: var(--color-text-muted);
  font-size: $font-size-sm;
}

.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: var(--grid-gap);
  transition: opacity 0.15s ease;
  // 防止动画后的布局重排影响
  contain: layout style;

  // 移动端更紧凑的间距
  @include mobile-only {
    gap: $spacing-sm;
  }

  &.is-hidden {
    opacity: 0;
  }

  // 动画进行中禁用 hover 效果，避免干扰
  &.is-animating {
    pointer-events: none;
  }

  // 网格视图（默认）
  &.view-grid {
    // 移动端两列
    grid-template-columns: repeat(2, 1fr);

    @include respond-to('md') {
      grid-template-columns: repeat(3, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(4, 1fr);
    }

    @include respond-to('xl') {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  // 列表视图
  &.view-list {
    grid-template-columns: 1fr;
    gap: $spacing-md;
  }

  // 瀑布流视图
  &.view-masonry {
    display: block;
    column-count: 2;
    column-gap: calc(var(--grid-gap) * 1.2);

    @include respond-to('md') {
      column-count: 3;
    }

    @include respond-to('lg') {
      column-count: 4;
    }

    @include respond-to('xl') {
      column-count: 5;
    }

    // 移动端更紧凑的间距
    @include mobile-only {
      column-gap: $spacing-sm;
    }

    > * {
      break-inside: avoid;
      margin-bottom: calc(var(--grid-gap) * 1.2);
      // 确保动画后位置稳定
      backface-visibility: hidden;

      // 移动端更紧凑的间距
      @include mobile-only {
        margin-bottom: $spacing-sm;
      }
    }
  }

  // 竖屏壁纸瀑布流需要更多列
  &.view-masonry.aspect-portrait {
    // 移动端仍然保持2列
    @include mobile-only {
      column-count: 2;
    }

    @include respond-to('md') {
      column-count: 4;
    }

    @include respond-to('lg') {
      column-count: 5;
    }

    @include respond-to('xl') {
      column-count: 6;
    }
  }

  // 正方形壁纸（头像）网格优化
  &.view-grid.aspect-square {
    // 移动端保持2列
    grid-template-columns: repeat(2, 1fr);

    @include respond-to('md') {
      grid-template-columns: repeat(4, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(5, 1fr);
    }

    @include respond-to('xl') {
      grid-template-columns: repeat(6, 1fr);
    }
  }
}

.grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-2xl;
  text-align: center;
  animation: fadeIn 0.5s ease;

  .empty-icon {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-hover);
    border-radius: 50%;
    margin-bottom: $spacing-lg;

    svg {
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
      opacity: 0.7;
    }
  }

  h3 {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: var(--color-text-primary);
    margin-bottom: $spacing-sm;
  }

  p {
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    margin-bottom: $spacing-lg;
  }

  &.series-empty {
    .empty-icon {
      background: linear-gradient(135deg, var(--color-accent-light) 0%, rgba(99, 102, 241, 0.1) 100%);

      svg {
        color: var(--color-accent);
        opacity: 0.8;
      }
    }
  }

  &.filter-empty {
    .empty-icon {
      background: var(--color-bg-secondary);

      svg {
        color: var(--color-text-muted);
      }
    }
  }
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  justify-content: center;
  margin-top: $spacing-sm;
}

.action-btn {
  padding: 10px 20px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  &:active {
    transform: scale(0.95);
  }

  &.primary {
    color: white;
    background: var(--color-accent);
    border-color: var(--color-accent);

    &:hover {
      background: var(--color-accent-hover);
      border-color: var(--color-accent-hover);
      color: white;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
