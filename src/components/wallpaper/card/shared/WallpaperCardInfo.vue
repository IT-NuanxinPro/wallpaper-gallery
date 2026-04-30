<script setup>
import { formatNumber } from '@/utils/common/format'

defineProps({
  actionMode: {
    type: String,
    default: 'all',
  },
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
  collected: {
    type: Boolean,
    default: false,
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
  isVideoWallpaper: {
    type: Boolean,
    default: false,
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  liked: {
    type: Boolean,
    default: false,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  collectCount: {
    type: Number,
    default: 0,
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

      <div v-if="aiKeywords.length > 0 && !isVideoWallpaper" class="card-ai-keywords">
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
      <div class="card-footer">
        <div class="card-meta-secondary">
          <span v-if="!isVideoWallpaper" class="meta-item meta-time">{{ relativeTime }}</span>
          <span class="meta-item meta-format">{{ fileFormat }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.card-info {
  position: relative;
  padding: $spacing-md;
  transition:
    background 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease,
    margin 220ms ease;

  @include mobile-only {
    &--grid {
      display: none;
    }
  }

  &--grid {
    [data-theme='dark'] & {
      margin: 0;
      border: none;
      background: transparent;
      box-shadow: none;
    }
  }

  &--list {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: $spacing-md $spacing-lg;

    [data-theme='dark'] & {
      align-self: stretch;
      margin: 0;
      border: none;
      background: transparent;
      box-shadow: none;
    }

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

  [data-theme='dark'] & {
    color: #f8fafc;
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
  background: var(--accent-gradient-soft);
  color: var(--color-accent);
  border-radius: $radius-sm;
  border: 1px solid var(--accent-border);
  white-space: nowrap;

  [data-theme='dark'] & {
    background: linear-gradient(180deg, rgba(18, 31, 56, 0.88), rgba(11, 20, 36, 0.84));
    color: #dbeafe;
    border-color: rgba(96, 165, 250, 0.16);
    box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.06);
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

  [data-theme='dark'] & {
    color: #cbd5e1;
  }

  svg {
    width: 12px;
    height: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;

    [data-theme='dark'] & {
      color: #7dd3fc;
    }
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

  [data-theme='dark'] & {
    color: #94a3b8;
  }
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
  flex-wrap: wrap;
  gap: $spacing-sm;
  font-size: $font-size-xs;
  color: var(--color-text-muted);

  [data-theme='dark'] & {
    color: #94a3b8;
  }
}

.card-footer {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-top: 2px;
  min-width: 0;
}

.card-footer--with-actions,
.card-footer--bing {
  justify-content: space-between;
}

.card-info--list .card-footer {
  margin-top: auto;
  padding-top: $spacing-sm;
}

.card-info-actions {
  flex-shrink: 0;
  margin-left: auto;
}

.card-footer .card-meta-secondary,
.card-footer .card-bing-copyright {
  min-width: 0;
  flex: 1;
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
  background: var(--accent-gradient-soft);
  color: var(--color-accent);
  border-radius: $radius-sm;
  font-weight: $font-weight-semibold;
  font-size: 10px;
  border: 1px solid var(--accent-border);

  [data-theme='dark'] & {
    background: linear-gradient(180deg, rgba(20, 34, 60, 0.9), rgba(11, 20, 36, 0.86));
    color: #bfdbfe;
    border-color: rgba(96, 165, 250, 0.16);
    box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.06);
  }
}

.meta-views,
.meta-downloads {
  color: var(--color-text-muted);
  padding: 3px 8px;
  border-radius: 999px;

  svg {
    width: 12px;
    height: 12px;
  }
}

.meta-views {
  [data-theme='dark'] & {
    color: #93c5fd;
    background: rgba(37, 99, 235, 0.16);
    border: 1px solid rgba(96, 165, 250, 0.14);
  }
}

.meta-downloads {
  [data-theme='dark'] & {
    color: #86efac;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.14);
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

  [data-theme='dark'] & {
    color: #f8fafc;
  }
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
    background: linear-gradient(180deg, rgba(18, 31, 56, 0.82), rgba(11, 20, 36, 0.78));
    border: 1px solid rgba(96, 165, 250, 0.12);
    box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.05);
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

.card-footer--bing {
  margin-top: $spacing-sm;
}

.card-footer--bing .card-bing-copyright {
  margin-top: 0;
}
</style>
