<script setup>
import { computed } from 'vue'
import SearchBar from '@/components/search/index.vue'
import { useTheme } from '@/composables/useTheme'

defineProps({
  searchQuery: {
    type: String,
    default: '',
  },
  show: {
    type: Boolean,
    default: false,
  },
  wallpapers: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['close', 'search', 'update:searchQuery', 'update:show'])

const { theme } = useTheme()
const isDark = computed(() => theme.value === 'dark')
</script>

<template>
  <Teleport to="body">
    <van-popup
      :show="show"
      position="top"
      :style="{ width: '100%' }"
      class="mobile-search-popup"
      :class="{ 'is-dark': isDark }"
      :teleport="null"
      :close-on-click-overlay="true"
      @update:show="$emit('update:show', $event)"
    >
      <div class="search-popup-content" :class="{ 'is-dark': isDark }">
        <SearchBar
          :model-value="searchQuery"
          placeholder="搜索壁纸..."
          :wallpapers="wallpapers"
          class="mobile-search-bar"
          @update:model-value="$emit('update:searchQuery', $event)"
          @search="$emit('search', $event)"
        />
        <button class="search-close-btn" @click="$emit('close')">
          取消
        </button>
      </div>
    </van-popup>
  </Teleport>
</template>

<style lang="scss" scoped>
.mobile-search-popup {
  :deep(.van-popup) {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.9);
    }
  }
}

:deep(.van-popup.mobile-search-popup.is-dark) {
  background: rgba(15, 23, 42, 0.94) !important;
}

.search-popup-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  padding-top: calc(14px + env(safe-area-inset-top, 0px));
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  &.is-dark {
    background: rgba(15, 23, 42, 0.92);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

.mobile-search-bar {
  flex: 1;

  :deep(.search-bar) {
    --search-height: 42px;
    --search-radius: 21px;
    max-width: 100%;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.6);
      border-color: rgba(255, 255, 255, 0.08);
    }
  }
}

.search-close-btn {
  flex-shrink: 0;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 500;
  color: #667eea;
  background: transparent;
  white-space: nowrap;
  transition: opacity 200ms;

  .is-dark & {
    color: #8ea2ff;
  }

  &:active {
    opacity: 0.7;
  }
}
</style>
