<script setup>
/**
 * 弹窗底部信息栏
 */
import { computed } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { formatDate, formatFileSize, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/format'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: null,
  },
  dimensions: {
    type: Object,
    default: () => ({ width: 0, height: 0 }),
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  isLoading: {
    type: Boolean,
    default: true,
  },
  isDownloading: {
    type: Boolean,
    default: false,
  },
  canUseDeviceMode: {
    type: Boolean,
    default: false,
  },
  isDeviceMode: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['download', 'toggleDeviceMode'])

// 计算属性 - 优先使用 AI 生成的 displayTitle
const displayFilename = computed(() => {
  if (!props.wallpaper)
    return ''
  // 优先使用 AI 生成的标题
  if (props.wallpaper.displayTitle) {
    return props.wallpaper.displayTitle
  }
  return getDisplayFilename(props.wallpaper.filename)
})

const categoryDisplay = computed(() => {
  if (!props.wallpaper?.category)
    return ''
  const { category, subcategory } = props.wallpaper
  return subcategory ? `${category} / ${subcategory}` : category
})

const resolution = computed(() => {
  if (props.wallpaper?.resolution)
    return props.wallpaper.resolution
  if (props.dimensions.width > 0)
    return getResolutionLabel(props.dimensions.width, props.dimensions.height)
  return { label: '加载中', type: 'secondary' }
})

const fileExt = computed(() =>
  props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '',
)

const formattedSize = computed(() =>
  props.wallpaper ? formatFileSize(props.wallpaper.size) : '',
)

const formattedDate = computed(() =>
  props.wallpaper ? formatDate(props.wallpaper.createdAt) : '',
)

// AI 信息
const aiDescription = computed(() => props.wallpaper?.description || '')
const aiKeywords = computed(() => props.wallpaper?.keywords || [])
</script>

<template>
  <div class="modal-info">
    <!-- 骨架屏 -->
    <template v-if="isLoading">
      <div class="modal-info__skeleton">
        <div class="skeleton__left">
          <div class="skeleton__title" />
          <div class="skeleton__tags">
            <div class="skeleton__tag" />
            <div class="skeleton__tag skeleton__tag--short" />
          </div>
        </div>
        <div class="skeleton__btn" />
      </div>
    </template>

    <!-- 实际内容 -->
    <template v-else>
      <div class="modal-info__main">
        <div class="modal-info__header">
          <h3 class="modal-info__title">
            {{ displayFilename }}
          </h3>
        </div>

        <!-- AI 描述 -->
        <p v-if="aiDescription" class="modal-ai-description">
          {{ aiDescription }}
        </p>

        <!-- 原始文件名（如果使用了 AI 标题） -->
        <div v-if="wallpaper?.displayTitle && wallpaper.displayTitle !== getDisplayFilename(wallpaper.filename)" class="modal-info__original-name">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
            <path d="M13 2v7h7" />
          </svg>
          <span>{{ getDisplayFilename(wallpaper.filename) }}</span>
        </div>

        <div v-if="categoryDisplay" class="modal-info__category">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>{{ categoryDisplay }}</span>
        </div>

        <div class="modal-info__meta">
          <div class="modal-info__tags">
            <span class="tag" :class="[`tag--${resolution.type || 'success'}`]">
              {{ resolution.label }}
            </span>
            <span class="tag tag--secondary">{{ fileExt }}</span>
            <span v-if="viewCount > 0" class="tag tag--view">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {{ viewCount }}
            </span>
            <span v-if="downloadCount > 0" class="tag tag--download">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              {{ downloadCount }}
            </span>
          </div>

          <!-- AI 关键词标签云 -->
          <div v-if="aiKeywords.length > 0" class="modal-ai-keywords">
            <span class="keyword-label">关键词：</span>
            <span v-for="keyword in aiKeywords" :key="keyword" class="keyword-tag">
              {{ keyword }}
            </span>
          </div>

          <div class="modal-info__details">
            <span class="detail-item">{{ formattedSize }}</span>
            <span class="detail-item">{{ formattedDate }}</span>
          </div>
        </div>
      </div>

      <div class="modal-info__actions">
        <!-- 真机模式按钮 -->
        <button
          v-if="canUseDeviceMode"
          class="action-btn action-btn--secondary"
          :class="{ 'is-active': isDeviceMode }"
          @click="emit('toggleDeviceMode')"
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
          :disabled="isDownloading"
          @click="emit('download')"
        >
          <LoadingSpinner v-if="isDownloading" size="sm" />
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.modal-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-md;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border);

  @include mobile-only {
    padding: $spacing-sm;
    gap: $spacing-sm;
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__title {
    flex: 1;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__original-name {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--color-text-muted);
    padding: 4px 0;

    svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__category {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-sm;
    color: var(--color-text-secondary);

    svg {
      width: 16px;
      height: 16px;
      color: var(--color-text-muted);
    }
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__details {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
    font-size: 13px;
    color: var(--color-text-muted);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    flex-shrink: 0;
  }

  &__skeleton {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: $spacing-md;
  }
}

// 骨架屏
.skeleton {
  &__left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  &__title {
    height: 16px;
    width: 60%;
    background: var(--color-bg-hover);
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  &__tags {
    display: flex;
    gap: 4px;
  }

  &__tag {
    height: 18px;
    width: 36px;
    background: var(--color-bg-hover);
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;

    &--short {
      width: 30px;
      animation-delay: 0.1s;
    }
  }

  &__btn {
    height: 48px;
    width: 48px;
    background: var(--color-bg-hover);
    border-radius: var(--radius-lg);
    animation: pulse 1.5s ease-in-out infinite;

    @include mobile-only {
      height: 44px;
      width: 44px;
    }
  }
}

// 详情项
.detail-item {
  &:not(:last-child)::after {
    content: '·';
    margin-left: $spacing-xs;
    color: var(--color-text-muted);
  }
}

// 标签
.tag {
  padding: 2px 6px;
  font-size: 12px;
  font-weight: $font-weight-bold;
  border-radius: 4px;

  &--success {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }

  &--warning {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
  }

  &--secondary {
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
  }

  &--view,
  &--download {
    display: inline-flex;
    align-items: center;
    gap: 2px;

    svg {
      width: 10px;
      height: 10px;
    }
  }

  &--view {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  &--download {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }
}

// AI 相关样式
.modal-ai-description {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  margin: 4px 0;
  padding: 8px 12px;
  background: var(--color-bg-hover);
  border-radius: $radius-md;
  border-left: 3px solid #667eea;
}

.modal-ai-keywords {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;

  .keyword-label {
    font-size: 12px;
    color: var(--color-text-muted);
    font-weight: $font-weight-medium;
  }

  .keyword-tag {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: $font-weight-medium;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12));
    color: #667eea;
    border-radius: $radius-md;
    border: 1px solid rgba(102, 126, 234, 0.25);
    transition: all 0.2s ease;

    &:hover {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
      transform: translateY(-1px);
    }

    [data-theme='dark'] & {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
      border-color: rgba(102, 126, 234, 0.35);
    }
  }
}

// 操作按钮
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;

  svg {
    width: 24px;
    height: 24px;
  }

  &:active {
    transform: scale(0.92);
  }

  &--primary {
    background: var(--color-accent);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);

    &:hover:not(:disabled) {
      background: var(--color-accent-hover);
      transform: translateY(-2px);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &--secondary {
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);

    &:hover {
      background: var(--color-bg-active);
      color: var(--color-text-primary);
    }

    &.is-active {
      background: var(--color-accent);
      color: white;
      border-color: var(--color-accent);
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

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
