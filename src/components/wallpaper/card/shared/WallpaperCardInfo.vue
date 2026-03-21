<script setup>
import { formatNumber } from '@/utils/common/format'

defineProps({
  aiKeywords: {
    type: Array,
    default: () => [],
  },
  bingCopyright: {
    type: String,
    default: '',
  },
  bingDate: {
    type: String,
    default: '',
  },
  bingTitle: {
    type: String,
    default: '',
  },
  categoryDisplay: {
    type: String,
    default: '',
  },
  displayFilename: {
    type: String,
    default: '',
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  fileFormat: {
    type: String,
    default: '',
  },
  formattedSize: {
    type: String,
    default: '',
  },
  highlightedFilename: {
    type: Array,
    default: () => [],
  },
  isBingWallpaper: {
    type: Boolean,
    default: false,
  },
  relativeTime: {
    type: String,
    default: '',
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  viewMode: {
    type: String,
    default: 'grid',
  },
  wallpaperCopyright: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="card-info" :class="`card-info--${viewMode}`">
    <template v-if="isBingWallpaper">
      <p class="card-filename card-bing-title" :title="bingTitle">
        {{ bingTitle }}
      </p>
      <div class="card-bing-meta">
        <span class="bing-date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {{ bingDate }}
        </span>
        <span class="bing-resolution">4K</span>
      </div>
      <div v-if="bingCopyright" class="card-bing-copyright" :title="wallpaperCopyright">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M14.83 14.83a4 4 0 1 1 0-5.66" />
        </svg>
        <span>{{ bingCopyright }}</span>
      </div>
    </template>

    <template v-else>
      <div class="card-filename-row">
        <p class="card-filename" :title="displayFilename">
          <template v-for="(part, idx) in highlightedFilename" :key="idx">
            <span v-if="part.highlight" class="highlight">{{ part.text }}</span>
            <span v-else>{{ part.text }}</span>
          </template>
        </p>
      </div>

      <div v-if="aiKeywords.length > 0" class="card-ai-keywords">
        <span v-for="keyword in aiKeywords" :key="keyword" class="ai-keyword-tag">
          {{ keyword }}
        </span>
      </div>

      <div v-if="categoryDisplay" class="card-category">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>{{ categoryDisplay }}</span>
      </div>
      <div class="card-meta">
        <span class="meta-item">{{ formattedSize }}</span>
        <span v-if="viewCount > 0" class="meta-item meta-views">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {{ formatNumber(viewCount) }}
        </span>
        <span v-if="downloadCount > 0" class="meta-item meta-downloads">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {{ formatNumber(downloadCount) }}
        </span>
      </div>
      <div class="card-meta-secondary">
        <span class="meta-item meta-time">{{ relativeTime }}</span>
        <span class="meta-item meta-format">{{ fileFormat }}</span>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.card-info {
  padding: $spacing-md;

  @include mobile-only {
    &--grid {
      display: none;
    }
  }

  &--list {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: $spacing-md $spacing-lg;

    @include mobile-only {
      padding: $spacing-sm $spacing-md;
    }
  }
}

.card-filename-row {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  margin-bottom: $spacing-xs;
}

.card-filename {
  flex: 1;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0;

  .highlight {
    background: rgba(229, 62, 62, 0.1);
    color: #e53e3e;
    font-weight: $font-weight-semibold;
    padding: 1px 4px;
    border-radius: 3px;
  }
}

.card-info--list .card-filename {
  font-size: $font-size-md;
  margin-bottom: $spacing-sm;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;

  @include mobile-only {
    font-size: $font-size-sm;
  }
}

.card-ai-keywords {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: $spacing-xs;
}

.ai-keyword-tag {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: $font-weight-medium;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  color: #667eea;
  border-radius: $radius-sm;
  border: 1px solid rgba(102, 126, 234, 0.2);
  white-space: nowrap;

  [data-theme='dark'] & {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
    border-color: rgba(102, 126, 234, 0.3);
  }
}

.card-category {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: $spacing-xs;
  font-size: $font-size-xs;
  color: var(--color-text-secondary);
  font-weight: $font-weight-medium;

  svg {
    width: 12px;
    height: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-sm;
  font-size: $font-size-xs;
  color: var(--color-text-muted);
  margin-bottom: $spacing-xs;
}

.card-info--list .card-meta {
  gap: $spacing-lg;

  @include mobile-only {
    gap: $spacing-md;
    font-size: $font-size-xs;
  }
}

.card-meta-secondary {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-xs;
  color: var(--color-text-muted);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.meta-time {
  color: var(--color-text-muted);
}

.meta-format {
  padding: 3px 8px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
  color: #667eea;
  border-radius: $radius-sm;
  font-weight: $font-weight-semibold;
  font-size: 10px;
  border: 1px solid rgba(102, 126, 234, 0.2);

  [data-theme='dark'] & {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%);
    border-color: rgba(102, 126, 234, 0.3);
  }
}

.meta-views,
.meta-downloads {
  color: var(--color-text-muted);

  svg {
    width: 12px;
    height: 12px;
  }
}

.card-bing-title {
  font-size: $font-size-sm;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: $spacing-sm;
  line-height: 1.5;
  letter-spacing: 0.2px;
}

.card-bing-meta {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
  font-size: $font-size-xs;

  .bing-date {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: linear-gradient(135deg, rgba(0, 120, 212, 0.12), rgba(16, 110, 190, 0.08));
    color: #0078d4;
    font-weight: $font-weight-semibold;
    border-radius: $radius-md;
    border: 1px solid rgba(0, 120, 212, 0.15);
    transition: all 0.2s ease;

    [data-theme='dark'] & {
      background: linear-gradient(135deg, rgba(0, 120, 212, 0.25), rgba(16, 110, 190, 0.2));
      border-color: rgba(0, 120, 212, 0.3);
      color: #4da6ff;
    }

    svg {
      width: 12px;
      height: 12px;
    }
  }

  .bing-resolution {
    padding: 4px 10px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-size: 10px;
    font-weight: $font-weight-bold;
    border-radius: $radius-md;
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
    letter-spacing: 0.5px;
  }
}

.card-bing-copyright {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: $radius-md;
  margin-top: 2px;

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.05);
  }

  svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    color: var(--color-text-muted);
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
}
</style>
