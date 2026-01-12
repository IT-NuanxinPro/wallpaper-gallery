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
  font-weight: $font-weight-bold;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: 0;
  word-break: break-word;
  letter-spacing: -0.3px;
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
  padding: 6px 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border-radius: 20px;
  box-shadow: 0 3px 12px rgba(102, 126, 234, 0.35);

  svg {
    width: 14px;
    height: 14px;
  }
}

.bing-resolution-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  font-size: $font-size-xs;
  font-weight: $font-weight-bold;
  border-radius: 20px;
  box-shadow: 0 3px 10px rgba(16, 185, 129, 0.3);
  letter-spacing: 0.5px;
}

.bing-location,
.bing-photographer {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: $spacing-sm $spacing-md;
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border);
  border-radius: $radius-md;
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
  line-height: 1.5;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
  }

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  span {
    flex: 1;
  }
}

.bing-location {
  svg {
    color: #ef4444;
  }
}

.bing-photographer {
  svg {
    color: #667eea;
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
  padding: 10px 16px;
  border: none;
  border-radius: $radius-md;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  &--search {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
    color: #667eea;
    border: 1px solid rgba(102, 126, 234, 0.25);

    &:hover {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
    }
  }

  &--quiz {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.15) 100%);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.25);

    &:hover {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(234, 88, 12, 0.25) 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
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
    padding: 5px 12px;
    font-size: $font-size-xs;

    svg {
      width: 12px;
      height: 12px;
    }
  }

  .bing-resolution-badge {
    padding: 4px 10px;
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
