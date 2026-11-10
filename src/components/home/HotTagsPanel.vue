<script setup>
import { gsap } from 'gsap'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import LoadingSurface from '@/components/common/feedback/LoadingSurface.vue'
import { buildImageUrl } from '@/utils/common/format'
import { HOT_TAGS_WINDOW_DAYS } from '@/utils/config/hotTags'

const props = defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
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

const emit = defineEmits(['select'])

const containerRef = ref(null)
const panelToggleRef = ref(null)
const panelDetailsId = useId()
const hoveredTag = ref(null)
const hoveredPreviewPlacement = ref({
  horizontal: 'center',
  vertical: 'top',
})
const isCategoryExpanded = ref(false)
const isKeywordExpanded = ref(false)
const isPanelExpanded = ref(false)
const panelPreferences = new Map()

const VISIBLE_COUNT = 6
const STORAGE_KEY = 'hot_tags_panel_expanded_v1'

const summaryTags = computed(() => {
  const categories = props.categoryTags.slice(0, 3).map(tag => ({ tag, kind: 'category' }))
  const keywords = props.keywordTags.slice(0, 3).map(tag => ({ tag, kind: 'keyword' }))
  return [...categories, ...keywords]
})

const visibleCategoryTags = computed(() =>
  isCategoryExpanded.value ? props.categoryTags : props.categoryTags.slice(0, VISIBLE_COUNT),
)

const visibleKeywordTags = computed(() =>
  isKeywordExpanded.value ? props.keywordTags : props.keywordTags.slice(0, VISIBLE_COUNT),
)

const showCategoryToggle = computed(() => props.categoryTags.length > VISIBLE_COUNT)
const showKeywordToggle = computed(() => props.keywordTags.length > VISIBLE_COUNT)

const showPreview = computed(() => props.currentSeries !== 'bing')
const loadingSkeletonGroups = computed(() => {
  if (props.currentSeries === 'bing') {
    return [
      {
        key: 'keyword',
        title: '热门关键词',
        count: 6,
      },
    ]
  }

  return [
    {
      key: 'category',
      title: '热门分类',
      count: 4,
    },
    {
      key: 'keyword',
      title: '热门关键词',
      count: 6,
    },
  ]
})

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

function handlePanelToggle() {
  isPanelExpanded.value = !isPanelExpanded.value
  savePanelPreference()
  handleTagLeave()
}

function savePanelPreference() {
  const preference = {
    expanded: isPanelExpanded.value,
    categoryExpanded: isCategoryExpanded.value,
    keywordExpanded: isKeywordExpanded.value,
  }
  panelPreferences.set(props.currentSeries, preference)
  try {
    localStorage.setItem(`${STORAGE_KEY}:${props.currentSeries}`, JSON.stringify(preference))
  }
  catch {
    // 存储不可用时保留本次会话的展开偏好。
  }
}

function toggleTagGroup(kind) {
  if (kind === 'category') {
    isCategoryExpanded.value = !isCategoryExpanded.value
  }
  else {
    isKeywordExpanded.value = !isKeywordExpanded.value
  }
  savePanelPreference()
}

function onPanelBeforeEnter(el) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  el.style.height = '0'
  el.style.opacity = '0'
  el.style.transform = 'translateY(-6px)'
  el.style.overflow = 'hidden'
}

function onPanelEnter(el) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onPanelAfterEnter(el)
    return
  }
  el.style.transition = 'height 240ms ease, opacity 180ms ease, transform 240ms ease'

  requestAnimationFrame(() => {
    el.style.height = `${el.scrollHeight}px`
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
}

function onPanelAfterEnter(el) {
  el.style.height = 'auto'
  el.style.opacity = ''
  el.style.transform = ''
  el.style.overflow = ''
  el.style.transition = ''
}

function onPanelBeforeLeave(el) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  el.style.height = `${el.scrollHeight}px`
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  el.style.overflow = 'hidden'
}

function onPanelLeave(el) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onPanelAfterLeave(el)
    return
  }
  void el.offsetHeight
  el.style.transition = 'height 240ms ease, opacity 160ms ease, transform 240ms ease'

  requestAnimationFrame(() => {
    el.style.height = '0'
    el.style.opacity = '0'
    el.style.transform = 'translateY(-6px)'
  })
}

function onPanelAfterLeave(el) {
  el.style.height = ''
  el.style.opacity = ''
  el.style.transform = ''
  el.style.overflow = ''
  el.style.transition = ''
}

function handleTagSelect(tag) {
  emit('select', tag)

  if (!props.isMobile) {
    return
  }

  handleTagLeave()
  if (containerRef.value?.contains(document.activeElement)) {
    panelToggleRef.value?.focus({ preventScroll: true })
  }
  isPanelExpanded.value = false
  savePanelPreference()
}

watch(
  () => [
    props.loading,
    props.categoryTags.length,
    props.keywordTags.length,
    isPanelExpanded.value,
  ],
  async ([loading, categoryCount, keywordCount, isExpanded]) => {
    if (loading || (!categoryCount && !keywordCount)) {
      return
    }

    if (!isExpanded) {
      return
    }

    await nextTick()

    const chips = containerRef.value
      ? [...containerRef.value.querySelectorAll('.hot-tag-chip')]
      : []
    if (!chips.length) {
      return
    }

    gsap.killTweensOf(chips)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(chips, { clearProps: 'opacity,transform' })
      return
    }
    gsap.fromTo(chips, { opacity: 0, y: 12 }, {
      duration: 0.32,
      ease: 'power2.out',
      opacity: 1,
      y: 0,
      stagger: { amount: 0.18 },
      clearProps: 'opacity,transform',
    })
  },
  { flush: 'post', immediate: true },
)

watch(() => props.currentSeries, (series) => {
  let preference = panelPreferences.get(series)
  if (!preference) {
    try {
      preference = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${series}`))
    }
    catch {
      // 损坏或不可访问的存储回退到紧凑首屏。
    }
  }
  isPanelExpanded.value = preference?.expanded === true
  isCategoryExpanded.value = preference?.categoryExpanded === true
  isKeywordExpanded.value = preference?.keywordExpanded === true
  handleTagLeave()
}, { immediate: true })

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
      <div class="hot-tags-header__content">
        <h2 class="hot-tags-title">
          热门标签
        </h2>
        <span class="hot-tags-hint">近 {{ HOT_TAGS_WINDOW_DAYS }} 天</span>
      </div>
      <div class="hot-tags-summary" role="group" aria-label="热门标签摘要，可横向浏览">
        <span v-if="loading" class="hot-tags-summary__loading" role="status">正在加载热门标签…</span>
        <button
          v-for="item in summaryTags"
          v-else
          :key="`${item.kind}-${item.tag.tag}`"
          class="hot-tags-summary__chip"
          :class="{ 'hot-tags-summary__chip--active': activeTag === item.tag.tag }"
          type="button"
          :aria-pressed="activeTag === item.tag.tag"
          @click="handleTagSelect(item.tag)"
        >
          {{ item.kind === 'keyword' ? '# ' : '' }}{{ item.tag.tag }}
        </button>
      </div>
      <button
        ref="panelToggleRef"
        class="hot-tags-panel-toggle"
        type="button"
        :aria-expanded="isPanelExpanded"
        :aria-controls="panelDetailsId"
        @click="handlePanelToggle"
      >
        <span>{{ isPanelExpanded ? '收起推荐' : '展开全部' }}</span>
        <span
          class="hot-tags-panel-toggle__icon"
          :class="{ 'hot-tags-panel-toggle__icon--expanded': isPanelExpanded }"
          aria-hidden="true"
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M4 6.5L8 10L12 6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>
    </div>

    <Transition
      @before-enter="onPanelBeforeEnter"
      @enter="onPanelEnter"
      @after-enter="onPanelAfterEnter"
      @before-leave="onPanelBeforeLeave"
      @leave="onPanelLeave"
      @after-leave="onPanelAfterLeave"
    >
      <div v-show="isPanelExpanded" :id="panelDetailsId" class="hot-tags-details">
        <p class="hot-tags-hint hot-tags-hint--details">
          分类会直接切换筛选，关键词会进入搜索
        </p>
        <LoadingSurface :busy="loading" label="正在加载推荐" :size="44">
          <div v-if="loading" class="hot-tags-groups">
            <div
              v-for="group in loadingSkeletonGroups"
              :key="group.key"
              class="hot-tags-group"
            >
              <div class="hot-tags-group__title">
                {{ group.title }}
              </div>
              <div class="hot-tags-skeleton">
                <span
                  v-for="index in group.count"
                  :key="`${group.key}-${index}`"
                  class="skeleton-chip"
                />
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
                    class="hot-tag-chip hot-tag-chip--category"
                    :class="{ 'hot-tag-chip--active': activeTag === tag.tag }"
                    type="button"
                    :aria-pressed="activeTag === tag.tag"
                    @click="handleTagSelect(tag)"
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
                :aria-expanded="isCategoryExpanded"
                @click="toggleTagGroup('category')"
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
                    class="hot-tag-chip hot-tag-chip--keyword"
                    :class="{ 'hot-tag-chip--active': activeTag === tag.tag }"
                    type="button"
                    :aria-pressed="activeTag === tag.tag"
                    @click="handleTagSelect(tag)"
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
                :aria-expanded="isKeywordExpanded"
                @click="toggleTagGroup('keyword')"
              >
                {{ isKeywordExpanded ? '收起热门关键词' : '展开更多关键词' }}
              </button>
            </div>
          </div>
        </LoadingSurface>
      </div>
    </Transition>
  </section>
</template>

<style lang="scss" scoped>
.hot-tags-panel {
  position: relative;
  z-index: 90;
  margin-bottom: 12px;
  padding: 8px 16px;
  border-radius: $radius-lg;
  border: 1px solid var(--accent-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(239, 246, 255, 0.8)),
    radial-gradient(circle at top left, rgba(var(--color-accent-rgb), 0.18), transparent 58%),
    radial-gradient(circle at bottom right, rgba(var(--color-accent-secondary-rgb), 0.12), transparent 62%);
  box-shadow:
    0 18px 36px rgba(15, 23, 42, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);

  [data-theme='dark'] & {
    background:
      linear-gradient(180deg, rgba(8, 15, 29, 0.9), rgba(7, 12, 24, 0.84)),
      radial-gradient(circle at top left, rgba(96, 165, 250, 0.22), transparent 44%),
      radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.16), transparent 52%);
    border-color: rgba(96, 165, 250, 0.16);
    box-shadow:
      0 22px 42px rgba(2, 8, 23, 0.34),
      inset 0 1px 0 rgba(191, 219, 254, 0.06);
  }
}

.hot-tags-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.hot-tags-header__content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.hot-tags-title {
  font-size: $font-size-md;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.hot-tags-hint {
  font-size: $font-size-xs;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.hot-tags-hint--details {
  margin-bottom: 12px;
  white-space: normal;
}

.hot-tags-details {
  padding-top: 12px;
}

.hot-tags-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 52px;
  overflow-x: auto;
  padding: 3px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.hot-tags-summary__chip {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--accent-border);
  border-radius: $radius-full;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.72);
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
  transition:
    background 180ms ease,
    color 180ms ease;

  [data-theme='dark'] & {
    background: rgba(7, 17, 31, 0.78);
  }

  &:hover,
  &--active {
    color: #fff;
    background: var(--accent-gradient);
    border-color: transparent;
  }
}

.hot-tags-summary__loading {
  font-size: $font-size-xs;
  color: var(--color-text-muted);
}

.hot-tags-panel button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.hot-tags-panel-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--accent-border);
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: $font-weight-semibold;

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--accent-border);
  }
}

.hot-tags-panel-toggle__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  transition: transform 220ms ease;

  svg {
    width: 100%;
    height: 100%;
  }
}

.hot-tags-panel-toggle__icon--expanded {
  transform: rotate(180deg);
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
  min-height: 72px;
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
  border: 1px solid var(--accent-border);
  box-shadow:
    0 1px 4px rgba(37, 99, 235, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.52);
  transition:
    color 220ms ease,
    background 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease;

  [data-theme='dark'] & {
    background: rgba(7, 17, 31, 0.78);
    border-color: var(--accent-border);
    box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.04);
  }

  &:hover {
    transform: translateY(-1px);
    color: #fff;
    background: var(--accent-gradient);
    border-color: transparent;
    box-shadow: 0 10px 24px var(--accent-shadow);
  }

  &--active {
    color: #fff;
    background: var(--accent-gradient);
    border-color: transparent;
    box-shadow: 0 6px 16px var(--accent-shadow);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  min-height: 44px;
  padding: 0 4px;
  border: none;
  background: transparent;
  color: var(--color-accent);
  font-size: 12px;
  font-weight: $font-weight-semibold;
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
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.92)),
    radial-gradient(circle at top left, rgba(var(--color-accent-rgb), 0.12), transparent 56%);
  border: 1px solid var(--accent-border);
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
  pointer-events: none;

  [data-theme='dark'] & {
    background:
      linear-gradient(180deg, rgba(9, 18, 32, 0.96), rgba(7, 15, 27, 0.92)),
      radial-gradient(circle at top left, rgba(96, 165, 250, 0.16), transparent 52%);
    border-color: rgba(96, 165, 250, 0.14);
    box-shadow:
      0 18px 40px rgba(2, 8, 23, 0.34),
      inset 0 1px 0 rgba(191, 219, 254, 0.06);
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
  background: rgba(var(--color-accent-rgb), 0.08);
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
  background: linear-gradient(
    90deg,
    rgba(var(--color-accent-rgb), 0.08),
    rgba(var(--color-accent-secondary-rgb), 0.18),
    rgba(var(--color-accent-rgb), 0.08)
  );
  // 统一由覆盖层的圆环反馈加载，避免每个占位标签持续重绘。
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
    padding: 8px 12px;
    margin-bottom: 12px;
  }

  .hot-tags-header {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 8px;
  }

  .hot-tags-summary {
    grid-row: 2;
    grid-column: 1 / -1;
    height: 58px;
  }

  .hot-tags-summary__chip {
    min-height: 44px;
  }

  .hot-tags-panel-toggle {
    padding: 0 12px;
  }

  .hot-tags-group__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .hot-tags-title {
    font-size: $font-size-md;
  }

  .hot-tags-hint {
    white-space: normal;
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

@media (prefers-reduced-motion: reduce) {
  .hot-tags-panel-toggle__icon,
  .hot-tags-summary__chip,
  .hot-tag-chip,
  .preview-fade-enter-active,
  .preview-fade-leave-active {
    transition: none;
  }

  .hot-tag-chip:hover {
    transform: none;
  }
}
</style>
