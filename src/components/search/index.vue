<script setup>
import { gsap } from 'gsap'
import { nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { useMotionPreference } from '@/composables/useMotionPreference'
import { trackSearch } from '@/utils/common/analytics'
import { useSearchSuggestions } from './composables/useSearchSuggestions'
import SearchSuggestionsPanel from './shared/SearchSuggestionsPanel.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '搜索壁纸...',
  },
  wallpapers: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'search'])

const searchBarRef = ref(null)
const inputRef = ref(null)
const iconRef = ref(null)
const clearBtnRef = ref(null)
const listId = `search-suggestions-${useId()}`
const reducedMotion = useMotionPreference()
const {
  hideSuggestions,
  isFocused,
  localValue,
  markFocused,
  selectedIndex,
  selectNextSuggestion,
  selectPreviousSuggestion,
  suppressSuggestionsOnce,
  shouldShowSuggestions,
  suggestions,
  suggestionsPosition,
  updateSuggestionsPosition,
} = useSearchSuggestions({
  modelValue: {
    get value() {
      return props.modelValue
    },
  },
  wallpapers: {
    get value() {
      return props.wallpapers
    },
  },
})

onMounted(() => {
  // 入场动画
  if (searchBarRef.value && !reducedMotion.value) {
    gsap.fromTo(
      searchBarRef.value,
      { opacity: 0, y: 4 },
      { opacity: 1, y: 0, duration: 0.16, ease: 'power2.out' },
    )
  }
})

function handleInput(e) {
  localValue.value = e.target.value
  // 输入时只更新本地值，不触发搜索
  // 搜索只在回车确认或选择建议时触发
}

// 确认搜索
function confirmSearch() {
  suppressSuggestionsOnce()
  emit('update:modelValue', localValue.value)
  emit('search', {
    mode: 'fuzzy',
    query: localValue.value,
  })

  // 追踪搜索事件（搜索结果数量在父组件计算，这里先记录搜索行为）
  if (localValue.value) {
    trackSearch(localValue.value, suggestions.value.length)
  }

  hideSuggestions()
}

// 键盘导航
function handleKeydown(e) {
  if (e.isComposing || e.keyCode === 229)
    return
  switch (e.key) {
    case 'ArrowDown':
      if (shouldShowSuggestions.value) {
        e.preventDefault()
        selectNextSuggestion()
      }
      break
    case 'ArrowUp':
      if (shouldShowSuggestions.value) {
        e.preventDefault()
        selectPreviousSuggestion()
      }
      break
    case 'Enter':
      e.preventDefault()
      if (selectedIndex.value >= 0 && shouldShowSuggestions.value) {
        // 选中了建议项
        selectSuggestion(suggestions.value[selectedIndex.value])
      }
      else {
        // 直接确认搜索
        confirmSearch()
      }
      break
    case 'Escape':
      hideSuggestions()
      break
  }
}

// 选择建议
function selectSuggestion(suggestion) {
  suppressSuggestionsOnce()
  localValue.value = suggestion.value
  emit('update:modelValue', suggestion.value)
  emit('search', {
    exactValue: suggestion.exactValue,
    mode: 'exact',
    query: suggestion.value,
  })
  hideSuggestions()
  inputRef.value?.focus()
}

// 点击外部关闭建议
function handleClickOutside(e) {
  if (searchBarRef.value && !searchBarRef.value.contains(e.target)) {
    hideSuggestions()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', refreshSuggestionPosition)
  window.addEventListener('scroll', refreshSuggestionPosition, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', refreshSuggestionPosition)
  window.removeEventListener('scroll', refreshSuggestionPosition, true)
  gsap.killTweensOf([searchBarRef.value, iconRef.value, clearBtnRef.value].filter(Boolean))
})

function refreshSuggestionPosition() {
  if (shouldShowSuggestions.value)
    updateSuggestionsPosition(searchBarRef.value)
}

function clearInput() {
  // 业务状态立即生效，视觉过渡不能延迟用户操作。
  localValue.value = ''
  emit('update:modelValue', '')
  hideSuggestions()
  inputRef.value?.focus()
}

function handleFocus() {
  markFocused(true)
  updateSuggestionsPosition(searchBarRef.value)
  if (reducedMotion.value)
    return
  // 图标动画
  if (iconRef.value) {
    gsap.to(iconRef.value, {
      scale: 1.08,
      rotation: 0,
      duration: 0.16,
      ease: 'power2.out',
    })
  }
  // 搜索框扩展动画
  if (searchBarRef.value) {
    gsap.to(searchBarRef.value, {
      scale: 1,
      duration: 0.16,
      ease: 'power2.out',
    })
  }
}

function handleBlur() {
  markFocused(false)
  if (reducedMotion.value)
    return
  // 图标复位
  if (iconRef.value) {
    gsap.to(iconRef.value, {
      scale: 1,
      rotation: 0,
      duration: 0.16,
      ease: 'power2.out',
    })
  }
  // 搜索框复位
  if (searchBarRef.value) {
    gsap.to(searchBarRef.value, {
      scale: 1,
      duration: 0.16,
      ease: 'power2.out',
    })
  }
}

// 清除按钮出现动画
watch(localValue, (newVal, oldVal) => {
  if (!reducedMotion.value && newVal && !oldVal && clearBtnRef.value) {
    gsap.fromTo(
      clearBtnRef.value,
      { opacity: 0 },
      { opacity: 1, duration: 0.16, ease: 'power2.out' },
    )
  }

  nextTick(() => {
    updateSuggestionsPosition(searchBarRef.value)
  })
})

watch(reducedMotion, (reduced) => {
  if (!reduced)
    return
  const elements = [searchBarRef.value, iconRef.value, clearBtnRef.value].filter(Boolean)
  gsap.killTweensOf(elements)
  gsap.set(elements, { clearProps: 'opacity,transform' })
})
</script>

<template>
  <div
    ref="searchBarRef"
    class="search-bar"
    :class="{ 'is-focused': isFocused, 'has-value': localValue }"
  >
    <!-- 背景发光层 -->
    <div class="search-bar__glow" />

    <!-- 渐变边框 -->
    <div class="search-bar__border" />

    <!-- 内容容器 -->
    <div class="search-bar__content">
      <!-- 搜索图标 -->
      <div ref="iconRef" class="search-bar__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      <!-- 输入框 -->
      <input
        ref="inputRef"
        type="search"
        role="combobox"
        aria-label="搜索壁纸"
        aria-autocomplete="list"
        :aria-expanded="shouldShowSuggestions"
        :aria-controls="listId"
        :aria-activedescendant="shouldShowSuggestions && selectedIndex >= 0 ? `${listId}-${selectedIndex}` : undefined"
        class="search-bar__input"
        :placeholder="placeholder"
        :value="localValue"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      >

      <!-- 清除按钮 -->
      <button
        v-if="localValue"
        ref="clearBtnRef"
        class="search-bar__clear"
        type="button"
        aria-label="清除搜索"
        @click="clearInput"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <!-- 快捷键提示 -->
      <div v-if="!localValue && !isFocused" class="search-bar__shortcut">
        <kbd>Enter</kbd>
      </div>
    </div>

    <!-- 搜索建议下拉 - 使用 Teleport 避免层级问题 -->
    <SearchSuggestionsPanel
      :list-id="listId"
      :position="suggestionsPosition"
      :query="localValue"
      :selected-index="selectedIndex"
      :suggestions="suggestions"
      :visible="shouldShowSuggestions"
      @select="selectSuggestion"
      @search="confirmSearch"
      @hover="selectedIndex = $event"
    />
  </div>
</template>

<style lang="scss" scoped>
.search-bar {
  --search-height: 48px;
  --search-radius: 24px;
  --glow-color: var(--color-accent);
  --border-width: 2px;

  position: relative;
  width: 100%;
  max-width: 420px;
  height: var(--search-height);

  // 背景发光效果
  &__glow {
    position: absolute;
    inset: -4px;
    border-radius: calc(var(--search-radius) + 4px);
    background: radial-gradient(ellipse at center, var(--glow-color) 0%, transparent 70%);
    opacity: 0;
    filter: blur(12px);
    transition: opacity 0.4s ease;
    pointer-events: none;
    z-index: 0;
  }

  // 渐变边框
  &__border {
    position: absolute;
    inset: 0;
    border-radius: var(--search-radius);
    padding: var(--border-width);
    background: linear-gradient(135deg, var(--color-border) 0%, var(--color-border) 100%);
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask-composite: exclude;
    transition: background 0.4s ease;
    pointer-events: none;
    z-index: 1;
  }

  // 内容容器
  &__content {
    position: relative;
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 $spacing-md;
    background: var(--color-bg-secondary);
    border-radius: var(--search-radius);
    z-index: 2;
    overflow: hidden;

    // 内部光晕
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 30% 50%, var(--color-accent-light) 0%, transparent 50%);
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
    }
  }

  // 搜索图标
  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-right: $spacing-sm;
    color: var(--color-text-muted);
    flex-shrink: 0;
    transition: color 0.3s ease;
    will-change: transform;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  // 输入框
  &__input {
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    letter-spacing: 0.3px;

    &::placeholder {
      color: var(--color-text-muted);
      font-weight: $font-weight-normal;
      transition: color 0.3s ease;
    }

    &:focus {
      outline: none;

      &::placeholder {
        color: var(--color-text-secondary);
      }
    }
  }

  // 清除按钮
  &__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-left: $spacing-xs;
    border-radius: $radius-full;
    color: var(--color-text-muted);
    background: var(--color-bg-hover);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.25s ease;
    will-change: transform;

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover {
      background: var(--color-accent-light);
      color: var(--color-accent);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  // 快捷键提示
  &__shortcut {
    display: flex;
    align-items: center;
    margin-left: $spacing-sm;
    opacity: 0.6;
    transition: opacity 0.3s ease;

    kbd {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      background: var(--color-bg-hover);
      border: 1px solid var(--color-border);
      border-radius: $radius-sm;
      color: var(--color-text-muted);
      font-family: inherit;
      font-size: 11px;
      font-weight: $font-weight-medium;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
  }

  // 悬停状态
  &:hover:not(.is-focused) {
    .search-bar__border {
      background: linear-gradient(135deg, var(--color-text-muted) 0%, var(--color-border) 100%);
    }

    .search-bar__icon {
      color: var(--color-text-secondary);
    }

    .search-bar__shortcut {
      opacity: 1;
    }
  }

  // 聚焦状态
  &.is-focused {
    .search-bar__glow {
      opacity: 0.15;
    }

    .search-bar__border {
      background: var(--accent-gradient);
      background-size: 200% 200%;
      animation: none;
    }

    .search-bar__content::before {
      opacity: 1;
    }

    .search-bar__icon {
      color: var(--color-accent);
    }
  }

  // 有值状态
  &.has-value {
    .search-bar__icon {
      color: var(--color-accent);
    }
  }
}

// 渐变边框动画
@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

// 响应式适配
@include mobile-only {
  .search-bar {
    --search-height: 44px;
    --search-radius: 22px;
    max-width: 100%;

    &__shortcut {
      display: none;
    }
  }
}
@media (prefers-reduced-motion: reduce) {
  .search-bar,
  .search-bar__icon,
  .search-bar__clear {
    transform: none !important;
    transition-duration: 0.01ms;
  }
}
</style>
