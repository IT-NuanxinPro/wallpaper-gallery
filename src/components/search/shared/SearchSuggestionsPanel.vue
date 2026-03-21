<script setup>
import { highlightText } from '@/utils/common/format'

const props = defineProps({
  position: {
    type: Object,
    default: () => ({ top: 0, left: 0, width: 0 }),
  },
  query: {
    type: String,
    default: '',
  },
  selectedIndex: {
    type: Number,
    default: -1,
  },
  suggestions: {
    type: Array,
    default: () => [],
  },
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['hover', 'select'])

function getHighlightedText(text) {
  return highlightText(text, props.query)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="suggestions">
      <div
        v-if="visible"
        class="search-bar__suggestions"
        :style="{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
        }"
      >
        <div
          v-for="(item, idx) in suggestions"
          :key="item.value || idx"
          class="suggestion-item"
          :class="{ 'is-selected': idx === selectedIndex }"
          @mousedown.prevent="emit('select', item)"
          @mouseenter="emit('hover', idx)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span class="suggestion-text">
            <template v-for="(part, partIdx) in getHighlightedText(item.label)" :key="partIdx">
              <span v-if="part.highlight" class="highlight">{{ part.text }}</span>
              <span v-else>{{ part.text }}</span>
            </template>
          </span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.suggestions-enter-active,
.suggestions-leave-active {
  transition: all 0.25s ease;
}

.suggestions-enter-from,
.suggestions-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

<style lang="scss">
@use '@/assets/styles/variables' as *;

.search-bar__suggestions {
  max-height: 300px;
  overflow-y: auto;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: $radius-lg;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 10000;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  cursor: pointer;
  transition: all 0.2s ease;

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .suggestion-text {
    flex: 1;
    font-size: $font-size-sm;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .highlight {
      color: #e53e3e;
      font-weight: $font-weight-semibold;
      background: rgba(229, 62, 62, 0.1);
      padding: 0 2px;
      border-radius: 2px;
    }
  }

  &:hover,
  &.is-selected {
    background: var(--color-bg-hover);

    svg {
      color: var(--color-accent);
    }
  }

  &.is-selected {
    background: var(--color-accent-light);

    .suggestion-text {
      color: var(--color-accent);
      font-weight: $font-weight-medium;
    }
  }
}
</style>
