<script setup>
import { highlightText } from '@/utils/common/format'

const props = defineProps({
  listId: { type: String, required: true },
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

const emit = defineEmits(['hover', 'select', 'search'])

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
        @mousedown.prevent
      >
        <div :id="listId" role="listbox" aria-label="壁纸建议">
          <div
            v-for="(item, idx) in suggestions"
            :id="`${listId}-${idx}`"
            :key="item.exactValue || item.value || idx"
            role="option"
            :aria-selected="idx === selectedIndex"
            class="suggestion-item"
            :class="{ 'is-selected': idx === selectedIndex }"
            @click="emit('select', item)"
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
        <p v-if="!suggestions.length" class="search-suggestion-note">
          暂无匹配建议
        </p>
        <button type="button" class="search-suggestion-submit" @click="emit('search')">
          搜索“{{ query }}”<span>Enter</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.suggestions-enter-active,
.suggestions-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.suggestions-enter-from,
.suggestions-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
@media (prefers-reduced-motion: reduce) {
  .suggestions-enter-from,
  .suggestions-leave-to {
    transform: none;
  }
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

.search-suggestion-note {
  margin: 0;
  padding: 12px 16px;
  color: var(--color-text-muted);
  font-size: 13px;
}
.search-suggestion-submit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  color: var(--color-accent);
  background: transparent;
  text-align: left;
  span {
    color: var(--color-text-muted);
    font-size: 11px;
  }
  &:hover {
    background: var(--color-bg-hover);
  }
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease;

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
