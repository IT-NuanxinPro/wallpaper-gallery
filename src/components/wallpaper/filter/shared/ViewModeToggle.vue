<script setup>
import { computed } from 'vue'

const props = defineProps({
  allowListMode: {
    type: Boolean,
    default: true,
  },
  mode: {
    type: String,
    default: 'grid',
  },
  mobile: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['change'])

const sliderClass = computed(() => {
  if (!props.allowListMode) {
    return 'is-grid is-single'
  }
  return props.mode === 'list' ? 'is-list' : 'is-grid'
})
</script>

<template>
  <div :class="mobile ? 'view-mode-toggle-mobile' : 'view-mode-toggle'">
    <div :class="[mobile ? 'view-mode-slider-mobile' : 'view-mode-slider', sliderClass]" />
    <button
      :class="[mobile ? 'view-mode-btn-mobile' : 'view-mode-btn', { 'is-active': mode === 'grid' }]"
      aria-label="网格视图"
      @click="$emit('change', 'grid')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    </button>
    <button
      v-if="allowListMode"
      :class="[mobile ? 'view-mode-btn-mobile' : 'view-mode-btn', { 'is-active': mode === 'list' }]"
      aria-label="列表视图"
      @click="$emit('change', 'list')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.view-mode-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: $radius-lg;
  padding: 4px;
  position: relative;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

.view-mode-slider {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 40px;
  height: 34px;
  background: var(--accent-gradient);
  border-radius: $radius-md;
  box-shadow: 0 2px 10px var(--accent-shadow);
  transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;

  &.is-list {
    transform: translateX(44px);
  }

  &.is-single {
    width: calc(100% - 8px);
  }
}

.view-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 34px;
  border-radius: $radius-md;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 1;

  svg {
    width: 18px;
    height: 18px;
    transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:hover {
    color: var(--color-text-primary);

    svg {
      transform: scale(1.1);
    }
  }

  &.is-active {
    color: white;
  }
}

.view-mode-toggle-mobile {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 3px;
  position: relative;
  height: 38px;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

.view-mode-slider-mobile {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 32px;
  height: 32px;
  background: var(--accent-gradient);
  border-radius: 9px;
  box-shadow: 0 2px 8px var(--accent-shadow);
  transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;

  &.is-grid {
    transform: translateX(0);
  }

  &.is-list {
    transform: translateX(32px);
  }

  &.is-single {
    width: calc(100% - 6px);
  }
}

.view-mode-btn-mobile {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  cursor: pointer;
  position: relative;
  z-index: 1;
  color: var(--color-text-muted);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 16px;
    height: 16px;
  }

  &.is-active {
    color: white;
  }
}
</style>
