<script setup>
import { useScrollTop } from '@/composables/useScrollTop'
import { trackBackToTop } from '@/utils/common/analytics'

const { showButton, scrollToTop } = useScrollTop()

function handleClick() {
  // 追踪返回顶部点击，记录当前滚动位置
  const scrollPosition = window.scrollY || document.documentElement.scrollTop
  trackBackToTop(scrollPosition)

  scrollToTop()
}
</script>

<template>
  <Transition name="fade">
    <button
      v-show="showButton"
      class="back-to-top"
      aria-label="回到顶部"
      @click="handleClick"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </Transition>
</template>

<style lang="scss" scoped>
.back-to-top {
  position: fixed;
  right: $spacing-lg;
  bottom: $spacing-lg;
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  background: var(--accent-gradient);
  border-radius: $radius-full;
  color: white;
  cursor: pointer;
  box-shadow:
    0 4px 20px var(--accent-shadow),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    opacity 180ms ease;
  border: none;

  // 光晕效果
  &::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: $radius-full;
    background: var(--accent-gradient-soft);
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  svg {
    width: 22px;
    height: 22px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  &:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow:
      0 8px 30px var(--accent-shadow-strong),
      0 0 0 1px rgba(255, 255, 255, 0.15) inset;

    &::before {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(-2px) scale(0.98);
  }

  @include mobile-only {
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: 48px;
    height: 48px;
    box-shadow:
      0 4px 16px var(--accent-shadow-strong),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;

    svg {
      width: 20px;
      height: 20px;
    }

    &:active {
      transform: scale(0.92);
      box-shadow: 0 2px 10px var(--accent-shadow);
    }
  }
}

// Transition
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 180ms ease,
    translate 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  translate: 0 10px;
}

@media (prefers-reduced-motion: reduce) {
  .back-to-top,
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 100ms ease;
  }

  .back-to-top:hover,
  .back-to-top:active,
  .fade-enter-from,
  .fade-leave-to {
    transform: none;
    translate: none;
  }
}
</style>
