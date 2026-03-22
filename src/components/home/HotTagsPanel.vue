<script setup>
import { gsap } from 'gsap'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { buildImageUrl } from '@/utils/common/format'

const props = defineProps({
  categoryTags: {
    type: Array,
    default: () => [],
  },
  keywordTags: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  activeTag: {
    type: String,
    default: '',
  },
  currentSeries: {
    type: String,
    default: '',
  },
})

defineEmits(['select'])

const containerRef = ref(null)
const animationPlayed = ref(false)
const hoveredTag = ref(null)
const hoveredPreviewPlacement = ref({
  horizontal: 'center',
  vertical: 'top',
})
const isCategoryExpanded = ref(false)
const isKeywordExpanded = ref(false)

const MOBILE_VISIBLE_COUNT = 6

const visibleCategoryTags = computed(() =>
  isCategoryExpanded.value ? props.categoryTags : props.categoryTags.slice(0, MOBILE_VISIBLE_COUNT),
)

const visibleKeywordTags = computed(() =>
  isKeywordExpanded.value ? props.keywordTags : props.keywordTags.slice(0, MOBILE_VISIBLE_COUNT),
)

const showCategoryToggle = computed(() => props.categoryTags.length > MOBILE_VISIBLE_COUNT)
const showKeywordToggle = computed(() => props.keywordTags.length > MOBILE_VISIBLE_COUNT)

const showPreview = computed(() => props.currentSeries !== 'bing')

const previewClass = computed(() => {
  if (props.currentSeries === 'mobile')
    return 'hot-tag-preview--portrait'
  if (props.currentSeries === 'avatar')
    return 'hot-tag-preview--square'
  return ''
})

function getThumbnailUrl(wp) {
  if (!wp || typeof wp === 'string')
    return ''
  return buildImageUrl(wp.thumbnail, wp.cdnTag || undefined)
}

function getPreviewStyle(tag) {
  const previewCount = Math.max(1, Math.min(tag?.topWallpapers?.length || 0, 3))
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
  const safeWidth = Math.max(240, viewportWidth - 32)

  let cardWidth = 280
  if (props.currentSeries === 'mobile') {
    cardWidth = 120
  }
  else if (props.currentSeries === 'avatar') {
    cardWidth = 160
  }

  const gap = 8
  const horizontalPadding = 16
  const idealWidth = previewCount * cardWidth + (previewCount - 1) * gap + horizontalPadding

  return {
    '--preview-max-width': `${Math.min(idealWidth, safeWidth)}px`,
  }
}

function getPreviewMetrics() {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
  const availableWidth = Math.max(240, viewportWidth - 32)

  switch (props.currentSeries) {
    case 'mobile':
      return { width: Math.min(392, availableWidth), height: Math.min(230, availableWidth * (16 / 9) * 0.56) }
    case 'avatar':
      return { width: Math.min(512, availableWidth), height: Math.min(176, availableWidth * 0.38) }
    default:
      return { width: Math.min(872, availableWidth), height: Math.min(174, availableWidth * 0.22) }
  }
}

function computePreviewPlacement(targetEl) {
  const fallback = {
    horizontal: 'center',
    vertical: 'top',
  }

  if (!targetEl || typeof window === 'undefined') {
    return fallback
  }

  const rect = targetEl.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const headerBottom = document.querySelector('.app-header')?.getBoundingClientRect().bottom || 0
  const gap = 10
  const gutter = 16
  const { width, height } = getPreviewMetrics()

  const centeredLeft = rect.left + rect.width / 2 - width / 2
  const centeredRight = centeredLeft + width
  const horizontal = centeredLeft < gutter
    ? 'left'
    : centeredRight > viewportWidth - gutter
      ? 'right'
      : 'center'

  const previewTop = rect.top - height - gap
  const vertical = previewTop <= headerBottom + gutter ? 'bottom' : 'top'

  return { horizontal, vertical }
}

function handleTagHover(tag, event) {
  if (!tag?.topWallpapers?.length) {
    return
  }

  hoveredPreviewPlacement.value = computePreviewPlacement(event?.currentTarget)
  hoveredTag.value = tag.tag
}

function handleTagLeave() {
  hoveredTag.value = null
  hoveredPreviewPlacement.value = {
    horizontal: 'center',
    vertical: 'top',
  }
}

function setChipInitialState(el) {
  if (el && !animationPlayed.value) {
    gsap.set(el, { opacity: 0, y: 12 })
  }
}

watch(
  () => [
    props.loading,
    props.categoryTags.length,
    props.keywordTags.length,
  ],
  ([loading, categoryCount, keywordCount]) => {
    if (loading || (!categoryCount && !keywordCount)) {
      animationPlayed.value = false
      return
    }

    const chips = containerRef.value
      ? [...containerRef.value.querySelectorAll('.hot-tag-chip')]
      : []
    if (!chips.length) {
      return
    }

    gsap.killTweensOf(chips)
    gsap.to(chips, {
      duration: 0.58,
      ease: 'power2.out',
      opacity: 1,
      y: 0,
      stagger: 0.06,
      clearProps: 'opacity,transform',
      onComplete: () => {
        animationPlayed.value = true
      },
    })
  },
  { flush: 'post' },
)

watch(() => props.currentSeries, () => {
  isCategoryExpanded.value = false
  isKeywordExpanded.value = false
})

onBeforeUnmount(() => {
  if (!containerRef.value) {
    return
  }

  const chips = [...containerRef.value.querySelectorAll('.hot-tag-chip')]
  gsap.killTweensOf(chips)
})
</script>

<template>
  <section v-if="loading || categoryTags.length > 0 || keywordTags.length > 0" class="hot-tags-panel">
    <div class="hot-tags-header">
      <div>
        <p class="hot-tags-eyebrow">
          热门标签
        </p>
        <h2 class="hot-tags-title">
          大家最近更爱搜这些内容
        </h2>
      </div>
      <span class="hot-tags-hint">分类会直接切换筛选，关键词会进入搜索</span>
    </div>

    <div v-if="loading" class="hot-tags-groups">
      <div class="hot-tags-group">
        <div class="hot-tags-group__title">
          热门分类
        </div>
        <div class="hot-tags-skeleton">
          <span v-for="index in 4" :key="`category-${index}`" class="skeleton-chip" />
        </div>
      </div>

      <div class="hot-tags-group">
        <div class="hot-tags-group__title">
          热门关键词
        </div>
        <div class="hot-tags-skeleton">
          <span v-for="index in 6" :key="`keyword-${index}`" class="skeleton-chip" />
        </div>
      </div>
    </div>

    <div v-else ref="containerRef" class="hot-tags-groups">
      <div v-if="categoryTags.length > 0" class="hot-tags-group">
        <div class="hot-tags-group__header">
          <div class="hot-tags-group__title">
            热门分类
          </div>
          <div class="hot-tags-group__desc">
            点击后直接切换筛选回显
          </div>
        </div>

        <div class="hot-tags-list">
          <div
            v-for="tag in visibleCategoryTags"
            :key="`category-${tag.tag}`"
            class="hot-tag-chip-wrapper"
            @mouseenter="handleTagHover(tag, $event)"
            @mouseleave="handleTagLeave"
          >
            <button
              :ref="setChipInitialState"
              class="hot-tag-chip hot-tag-chip--category"
              :class="{ 'hot-tag-chip--active': activeTag === tag.tag }"
              @click="$emit('select', tag)"
            >
              <span class="hot-tag-chip__name">{{ tag.tag }}</span>
              <span class="hot-tag-chip__meta">{{ tag.wallpaperCount }} 张</span>
            </button>
            <Transition name="preview-fade">
              <div
                v-if="showPreview && hoveredTag === tag.tag && tag.topWallpapers?.length"
                class="hot-tag-preview"
                :class="[
                  previewClass,
                  `hot-tag-preview--align-${hoveredPreviewPlacement.horizontal}`,
                  { 'hot-tag-preview--below': hoveredPreviewPlacement.vertical === 'bottom' },
                ]"
                :style="getPreviewStyle(tag)"
              >
                <img
                  v-for="(wp, i) in tag.topWallpapers.slice(0, 3)"
                  :key="i"
                  :src="getThumbnailUrl(wp)"
                  :alt="tag.tag"
                  class="hot-tag-preview__img"
                  loading="lazy"
                >
              </div>
            </Transition>
          </div>
        </div>

        <button
          v-if="showCategoryToggle"
          class="hot-tags-toggle"
          type="button"
          @click="isCategoryExpanded = !isCategoryExpanded"
        >
          {{ isCategoryExpanded ? '收起热门分类' : '展开更多分类' }}
        </button>
      </div>

      <div v-if="keywordTags.length > 0" class="hot-tags-group">
        <div class="hot-tags-group__header">
          <div class="hot-tags-group__title">
            热门关键词
          </div>
          <div class="hot-tags-group__desc">
            点击后在当前系列内搜索
          </div>
        </div>

        <div class="hot-tags-list">
          <div
            v-for="tag in visibleKeywordTags"
            :key="`keyword-${tag.tag}`"
            class="hot-tag-chip-wrapper"
            @mouseenter="handleTagHover(tag, $event)"
            @mouseleave="handleTagLeave"
          >
            <button
              :ref="setChipInitialState"
              class="hot-tag-chip hot-tag-chip--keyword"
              :class="{ 'hot-tag-chip--active': activeTag === tag.tag }"
              @click="$emit('select', tag)"
            >
              <span class="hot-tag-chip__name"># {{ tag.tag }}</span>
              <span class="hot-tag-chip__meta">{{ tag.wallpaperCount }} 张</span>
            </button>
            <Transition name="preview-fade">
              <div
                v-if="showPreview && hoveredTag === tag.tag && tag.topWallpapers?.length"
                class="hot-tag-preview"
                :class="[
                  previewClass,
                  `hot-tag-preview--align-${hoveredPreviewPlacement.horizontal}`,
                  { 'hot-tag-preview--below': hoveredPreviewPlacement.vertical === 'bottom' },
                ]"
                :style="getPreviewStyle(tag)"
              >
                <img
                  v-for="(wp, i) in tag.topWallpapers.slice(0, 3)"
                  :key="i"
                  :src="getThumbnailUrl(wp)"
                  :alt="tag.tag"
                  class="hot-tag-preview__img"
                  loading="lazy"
                >
              </div>
            </Transition>
          </div>
        </div>

        <button
          v-if="showKeywordToggle"
          class="hot-tags-toggle"
          type="button"
          @click="isKeywordExpanded = !isKeywordExpanded"
        >
          {{ isKeywordExpanded ? '收起热门关键词' : '展开更多关键词' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.hot-tags-panel {
  position: relative;
  z-index: 110;
  margin-bottom: $spacing-lg;
  padding: $spacing-lg;
  border-radius: $radius-lg;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background:
    radial-gradient(circle at top left, rgba(102, 126, 234, 0.16), transparent 60%),
    radial-gradient(circle at bottom right, rgba(118, 75, 162, 0.1), transparent 60%), rgba(255, 255, 255, 0.56);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);

  [data-theme='dark'] & {
    background: radial-gradient(circle at top left, rgba(102, 126, 234, 0.2), transparent 40%), rgba(15, 23, 42, 0.72);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

.hot-tags-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $spacing-md;
  margin-bottom: $spacing-md;
}

.hot-tags-eyebrow {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #667eea;
}

.hot-tags-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
}

.hot-tags-hint {
  font-size: $font-size-xs;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.hot-tags-groups {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.hot-tags-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hot-tags-group__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-md;
}

.hot-tags-group__title {
  font-size: 13px;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
}

.hot-tags-group__desc {
  font-size: 12px;
  color: var(--color-text-muted);
}

.hot-tags-list,
.hot-tags-skeleton {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hot-tag-chip-wrapper {
  position: relative;
  min-width: 0;

  &:hover {
    z-index: 2;
  }
}

.hot-tag-chip,
.skeleton-chip {
  border-radius: $radius-full;
}

.hot-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  max-width: 100%;
  padding: 0 14px;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(102, 126, 234, 0.22);
  box-shadow: 0 1px 4px rgba(102, 126, 234, 0.08);
  transition:
    color 220ms ease,
    background 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease;

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(102, 126, 234, 0.16);
    box-shadow: none;
  }

  &:hover {
    transform: translateY(-1px);
    color: #fff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    box-shadow: 0 10px 24px rgba(102, 126, 234, 0.28);
  }

  &--active {
    color: #fff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.24);
  }
}

.hot-tag-chip__name {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  min-width: 0;
}

.hot-tag-chip__meta {
  font-size: 12px;
  color: var(--color-text-muted);
  flex-shrink: 0;

  .hot-tag-chip:hover &,
  .hot-tag-chip--active & {
    color: rgba(255, 255, 255, 0.8);
  }
}

.hot-tags-toggle {
  display: none;
}

.hot-tag-preview {
  --preview-max-width: 872px;
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  width: min(var(--preview-max-width), calc(100vw - 32px));
  gap: 8px;
  padding: 8px;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(102, 126, 234, 0.16);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  pointer-events: none;

  [data-theme='dark'] & {
    background: rgba(30, 41, 59, 0.96);
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.hot-tag-preview--below {
  top: calc(100% + 10px);
  bottom: auto;
}

.hot-tag-preview--align-left {
  left: 0;
  transform: none;
}

.hot-tag-preview--align-right {
  right: 0;
  left: auto;
  transform: none;
}

// PC 壁纸 16:9 横屏
.hot-tag-preview__img {
  display: block;
  flex: 1 1 0;
  width: 0;
  min-width: 0;
  max-width: 280px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 6px;
  background: rgba(102, 126, 234, 0.08);
}

// 手机壁纸 9:16 竖屏
.hot-tag-preview--portrait {
  --preview-max-width: 392px;
}

.hot-tag-preview--portrait .hot-tag-preview__img {
  max-width: 120px;
  aspect-ratio: 9 / 16;
}

// 头像 1:1
.hot-tag-preview--square {
  --preview-max-width: 512px;
}

.hot-tag-preview--square .hot-tag-preview__img {
  max-width: 160px;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
}

.preview-fade-enter-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.preview-fade-leave-active {
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.preview-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

.preview-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

.hot-tag-preview--align-left.preview-fade-enter-from,
.hot-tag-preview--align-left.preview-fade-leave-to,
.hot-tag-preview--align-right.preview-fade-enter-from,
.hot-tag-preview--align-right.preview-fade-leave-to {
  transform: translateY(4px);
}

.skeleton-chip {
  width: 96px;
  height: 40px;
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.08), rgba(102, 126, 234, 0.18), rgba(102, 126, 234, 0.08));
  background-size: 200% 100%;
  animation: hot-tags-shimmer 1.4s linear infinite;
}

@keyframes hot-tags-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

@include mobile-only {
  .hot-tags-panel {
    padding: $spacing-md;
    margin-bottom: $spacing-md;
  }

  .hot-tags-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .hot-tags-group__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .hot-tags-title {
    font-size: $font-size-md;
  }

  .hot-tags-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding-bottom: 0;
  }

  .hot-tag-chip-wrapper {
    width: 100%;
    max-width: 100%;
  }

  .hot-tag-chip {
    width: 100%;
    min-height: 42px;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    gap: 8px;
  }

  .hot-tag-preview {
    display: none;
  }

  .hot-tag-chip__name {
    display: block;
    overflow: hidden;
    line-height: 42px;
    white-space: nowrap;
    text-overflow: ellipsis;
    word-break: normal;
    text-align: left;
  }

  .hot-tag-chip__meta {
    white-space: nowrap;
  }

  .hot-tags-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    padding: 0;
    border: none;
    background: transparent;
    color: #667eea;
    font-size: 12px;
    font-weight: $font-weight-semibold;
  }
}

@media (max-width: 420px) {
  .hot-tag-chip__name {
    max-width: 76px;
  }
}

@media (min-width: 421px) and (max-width: 767px) {
  .hot-tags-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .hot-tag-chip__name {
    max-width: 72px;
  }
}
</style>
