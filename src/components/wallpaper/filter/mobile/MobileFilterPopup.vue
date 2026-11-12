<script setup>
import { ref, useId } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useMotionPreference } from '@/composables/useMotionPreference'
import { FORMAT_OPTIONS, SORT_OPTIONS } from '@/utils/config/constants'
import FilterPreviewAction from '../shared/FilterPreviewAction.vue'

const props = defineProps({
  preview: { type: Object, default: () => ({ status: 'loading', count: null }) },
  hideFormatFilter: {
    type: Boolean,
    default: false,
  },
  show: {
    type: Boolean,
    default: false,
  },
  tempFormatFilter: {
    type: String,
    default: 'all',
  },
  tempSortBy: {
    type: String,
    default: 'newest',
  },
})

const emit = defineEmits(['apply', 'close', 'reset', 'update:show', 'update:tempFormatFilter', 'update:tempSortBy'])
const panelRef = ref(null)
const titleId = `filter-title-${useId()}`
const reducedMotion = useMotionPreference()
useDialogFocus(() => props.show, panelRef, () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <van-popup
      :show="show"
      position="bottom"
      round
      class="filter-popup-dark"
      role="presentation"
      :tabindex="-1"
      :close-on-click-overlay="true"
      :lock-scroll="true"
      :duration="reducedMotion ? 0 : 0.24"
      safe-area-inset-bottom
      :teleport="null"
      @update:show="$emit('update:show', $event)"
    >
      <div ref="panelRef" class="popup-content" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
        <div class="popup-header">
          <button class="popup-reset" @click="$emit('reset')">
            重置
          </button>
          <span :id="titleId" class="popup-title">筛选与排序</span>
          <button class="popup-close" aria-label="取消筛选" @click="$emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="popup-body">
          <div v-if="!hideFormatFilter" class="filter-group">
            <h3 class="group-title">
              格式
            </h3>
            <div class="option-grid">
              <button
                v-for="option in FORMAT_OPTIONS"
                :key="option.value"
                class="option-btn"
                :class="{ 'is-active': tempFormatFilter === option.value }"
                :aria-pressed="tempFormatFilter === option.value"
                @click="$emit('update:tempFormatFilter', option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="filter-group">
            <h3 class="group-title">
              排序
            </h3>
            <div class="option-grid">
              <button
                v-for="option in SORT_OPTIONS"
                :key="option.value"
                class="option-btn"
                :class="{ 'is-active': tempSortBy === option.value }"
                :aria-pressed="tempSortBy === option.value"
                @click="$emit('update:tempSortBy', option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="popup-footer">
          <FilterPreviewAction :preview="preview" @confirm="$emit('apply')" />
        </div>
      </div>
    </van-popup>
  </Teleport>
</template>

<style lang="scss" scoped>
.popup-content {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.95);
  max-height: 80vh;
  max-height: calc(100dvh - max(12px, env(safe-area-inset-top, 0px)) - env(safe-area-inset-bottom, 0px));
  overflow: hidden;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.popup-reset {
  padding: 6px 12px;
  font-size: 14px;
  color: var(--color-accent);
  background: transparent;
  font-weight: 500;
  transition: opacity 200ms;

  &:active {
    opacity: 0.7;
  }
}

.popup-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--color-text-muted);
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 50%;
  transition: all 250ms;

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.08);
  }

  svg {
    width: 18px;
    height: 18px;
  }

  &:active {
    background: var(--accent-surface);
    color: var(--color-accent);
  }
}

.popup-body {
  padding: 20px 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.filter-group {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.option-btn {
  padding: 12px 18px;
  font-size: 14px;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-active {
    color: white;
    background: var(--accent-gradient);
    border-color: transparent;
    font-weight: 600;
    box-shadow: 0 2px 10px var(--accent-shadow);
  }
}

.popup-footer {
  flex-shrink: 0;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: transparent;

  [data-theme='dark'] & {
    border-top-color: rgba(255, 255, 255, 0.08);
  }
}

.confirm-btn {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: var(--accent-gradient);
  border-radius: 12px;
  box-shadow: 0 4px 15px var(--accent-shadow);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: 0 6px 20px var(--accent-shadow-strong);
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2px 10px var(--accent-shadow);
  }
}
</style>

<style lang="scss">
.van-popup.filter-popup-dark {
  background: rgba(255, 255, 255, 0.95) !important;
}

[data-theme='dark'] .van-popup.filter-popup-dark {
  background: rgba(15, 23, 42, 0.98) !important;

  .popup-content {
    background: transparent;
  }

  .popup-header {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .popup-close {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .option-btn {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.08);

    &.is-active {
      background: var(--accent-gradient);
      border-color: transparent;
    }
  }

  .popup-footer {
    border-top-color: rgba(255, 255, 255, 0.08);
  }
}
</style>
