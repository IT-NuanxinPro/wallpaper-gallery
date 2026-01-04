<script setup>
import { computed } from 'vue'
import { formatBingFullDate } from '@/utils/format'

const props = defineProps({
  wallpaper: {
    type: Object,
    required: true,
  },
  // 是否显示精简版（用于移动端或紧凑布局）
  compact: {
    type: Boolean,
    default: false,
  },
})

// 基础信息
const title = computed(() => props.wallpaper?.title || '')
const date = computed(() => {
  if (!props.wallpaper?.date)
    return ''
  return formatBingFullDate(props.wallpaper.date)
})
const copyright = computed(() => props.wallpaper?.copyright || '')

// 解析 copyright 信息：格式为 "地点描述 (© 摄影师/来源)"
const location = computed(() => {
  const c = copyright.value
  if (!c)
    return ''
  // 提取括号前的地点描述
  const match = c.match(/^([^(]+)\(©/)
  return match ? match[1].trim() : c.split('(©')[0].trim()
})

const photographer = computed(() => {
  const c = copyright.value
  if (!c)
    return ''
  // 提取 (© xxx) 中的摄影师信息
  const match = c.match(/\(©([^)]+)\)$/)
  return match ? match[1].trim() : ''
})

// 链接
const searchLink = computed(() => props.wallpaper?.copyrightlink || '')
const quizLink = computed(() => {
  const quiz = props.wallpaper?.quiz
  if (!quiz)
    return ''
  // quiz 是相对路径，需要补全
  return quiz.startsWith('http') ? quiz : `https://cn.bing.com${quiz}`
})

// 打开链接
function openLink(url) {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <div class="bing-info" :class="{ 'bing-info--compact': compact }">
    <!-- 标题 -->
    <h3 class="bing-title">
      {{ title }}
    </h3>

    <!-- 日期徽章 -->
    <div class="bing-date-row">
      <span class="bing-date-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {{ date }}
      </span>
      <span class="bing-resolution-badge">4K UHD</span>
    </div>

    <!-- 地点信息 -->
    <div v-if="location" class="bing-location">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span>{{ location }}</span>
    </div>

    <!-- 摄影师信息 -->
    <div v-if="photographer" class="bing-photographer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      <span>{{ photographer }}</span>
    </div>

    <!-- 链接区域 -->
    <div v-if="!compact && (searchLink || quizLink)" class="bing-links">
      <button
        v-if="searchLink"
        class="bing-link-btn bing-link-btn--search"
        @click="openLink(searchLink)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>了解更多</span>
      </button>
      <button
        v-if="quizLink"
        class="bing-link-btn bing-link-btn--quiz"
        @click="openLink(quizLink)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>每日问答</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bing-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.bing-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: 0;
  word-break: break-word;
}

.bing-date-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

.bing-date-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #0078d4, #106ebe);
  color: white;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border-radius: $radius-sm;
  box-shadow: 0 2px 8px rgba(0, 120, 212, 0.3);

  svg {
    width: 14px;
    height: 14px;
  }
}

.bing-resolution-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: linear-gradient(135deg, #107c10, #0e8a0e);
  color: white;
  font-size: $font-size-xs;
  font-weight: $font-weight-bold;
  border-radius: $radius-sm;
  box-shadow: 0 2px 6px rgba(16, 124, 16, 0.3);
}

.bing-location,
.bing-photographer {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: $spacing-sm $spacing-md;
  background: var(--color-bg-hover);
  border-radius: $radius-sm;
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
  line-height: 1.5;

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--color-text-muted);
  }

  span {
    flex: 1;
  }
}

.bing-location {
  svg {
    color: #d83b01;
  }
}

.bing-photographer {
  svg {
    color: #0078d4;
  }
}

.bing-links {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-xs;
  flex-wrap: wrap;
}

.bing-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: $radius-md;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  cursor: pointer;
  transition: all 0.2s ease;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &--search {
    background: rgba(0, 120, 212, 0.1);
    color: #0078d4;

    &:hover {
      background: rgba(0, 120, 212, 0.2);
    }
  }

  &--quiz {
    background: rgba(107, 76, 184, 0.1);
    color: #6b4cb8;

    &:hover {
      background: rgba(107, 76, 184, 0.2);
    }
  }
}

// 紧凑模式
.bing-info--compact {
  gap: $spacing-xs;

  .bing-title {
    font-size: $font-size-md;
  }

  .bing-date-badge {
    padding: 4px 10px;
    font-size: $font-size-xs;

    svg {
      width: 12px;
      height: 12px;
    }
  }

  .bing-resolution-badge {
    padding: 3px 8px;
    font-size: 10px;
  }

  .bing-location,
  .bing-photographer {
    padding: $spacing-xs $spacing-sm;
    font-size: $font-size-xs;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}
</style>
