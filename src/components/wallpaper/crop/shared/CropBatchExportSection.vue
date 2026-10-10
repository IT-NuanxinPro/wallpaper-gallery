<script setup>
defineProps({
  batchPresets: {
    type: Array,
    default: () => [],
  },
  isProcessing: {
    type: Boolean,
    default: false,
  },
  selectedBatchPresetIds: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'batchExport',
  'clearPresets',
  'selectRecommended',
  'togglePreset',
])
</script>

<template>
  <div class="panel-section panel-section--batch">
    <div class="section-header">
      <h3 class="section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M7 3H5a2 2 0 0 0-2 2v2M21 7V5a2 2 0 0 0-2-2h-2M17 21h2a2 2 0 0 0 2-2v-2M3 17v2a2 2 0 0 0 2 2h2" />
          <rect x="7" y="7" width="10" height="10" rx="2" />
        </svg>
        一键多版本
      </h3>
      <div class="batch-actions">
        <button class="batch-link" @click="emit('selectRecommended')">
          推荐
        </button>
        <button class="batch-link" @click="emit('clearPresets')">
          清空
        </button>
      </div>
    </div>

    <p class="batch-hint">
      按当前裁剪比例一次导出多个常用尺寸，适合不同屏幕和设备。
    </p>

    <div class="batch-grid">
      <button
        v-for="preset in batchPresets"
        :key="preset.id"
        class="batch-card"
        :class="{
          'batch-card--active': selectedBatchPresetIds.includes(preset.id),
        }"
        :aria-pressed="selectedBatchPresetIds.includes(preset.id)"
        @click="emit('togglePreset', preset.id)"
      >
        <div class="batch-card__top">
          <span class="batch-card__label">{{ preset.label }}</span>
          <span v-if="preset.recommended" class="batch-card__badge">推荐</span>
        </div>
        <div class="batch-card__size">
          {{ preset.width }} × {{ preset.height }}
        </div>
        <div class="batch-card__desc">
          {{ preset.description }}
        </div>
      </button>
    </div>

    <button
      class="batch-export-btn"
      :disabled="selectedBatchPresetIds.length === 0 || isProcessing"
      @click="emit('batchExport')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 17V7a2 2 0 0 1 2-2h4M20 7v10a2 2 0 0 1-2 2h-4M12 3v12M7 10l5 5 5-5" />
      </svg>
      <span>
        {{ isProcessing ? '正在导出...' : selectedBatchPresetIds.length ? `一键导出 ${selectedBatchPresetIds.length} 个版本` : '请选择导出尺寸' }}
      </span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;

  &--batch {
    padding-bottom: 16px;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 1px;

  svg {
    width: 13px;
    height: 13px;
    color: var(--color-accent);
  }
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-link {
  padding: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--crop-text-muted);
  background: transparent;
  border: none;
  transition: color 0.2s ease;

  &:hover {
    color: var(--accent-contrast-soft);
  }
}

.batch-hint {
  margin: 0 0 12px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--crop-text-muted);
}

.batch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.batch-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  text-align: left;
  background: var(--crop-control-surface);
  border: 1px solid var(--crop-control-border);
  border-radius: 10px;
  transition: all 0.22s ease;

  &:hover {
    background: var(--crop-control-surface-hover);
    border-color: var(--crop-control-border-hover);
  }

  &--active {
    background: var(--accent-gradient-soft);
    border-color: var(--accent-border-strong);
    box-shadow: 0 0 0 1px var(--accent-ring) inset;

    .batch-card__label,
    .batch-card__size {
      color: var(--accent-contrast-soft);
    }

    .batch-card__desc {
      color: rgba(var(--color-accent-rgb), 0.92);
    }
  }
}

.batch-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.batch-card__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--crop-control-text);
}

.batch-card__badge {
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 700;
  color: var(--accent-contrast-soft);
  background: var(--accent-surface);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
}

.batch-card__size {
  font-size: 11px;
  font-weight: 700;
  color: var(--crop-control-text);
  font-family: 'SF Mono', Monaco, monospace;
}

.batch-card__desc {
  font-size: 10px;
  color: var(--crop-control-hint);
  line-height: 1.5;
}

.batch-export-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding: 11px 14px;
  font-size: 12px;
  font-weight: 700;
  color: white;
  background: var(--accent-gradient);
  border: none;
  border-radius: 10px;
  box-shadow: 0 4px 16px var(--accent-shadow);
  transition: all 0.22s ease;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: var(--accent-gradient-hover);
    box-shadow: 0 8px 24px var(--accent-shadow-strong);
  }

  &:disabled {
    opacity: 0.45;
    transform: none;
    box-shadow: none;
    cursor: not-allowed;
  }
}
</style>
