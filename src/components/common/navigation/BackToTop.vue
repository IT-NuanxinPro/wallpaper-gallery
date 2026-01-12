<script setup>
import { gsap } from 'gsap'
import { ref, watch } from 'vue'
import { useScrollTop } from '@/composables/useScrollTop'
import { trackBackToTop } from '@/utils/analytics'

const { showButton, scrollToTop } = useScrollTop()
const buttonRef = ref(null)

// 按钮出现/消失动画
watch(showButton, (show) => {
  if (buttonRef.value) {
    if (show) {
      gsap.fromTo(
        buttonRef.value,
        { opacity: 0, scale: 0.5, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(2)' },
      )
    }
    else {
      gsap.to(buttonRef.value, {
        opacity: 0,
        scale: 0.5,
        y: 20,
        duration: 0.3,
        ease: 'power2.in',
      })
    }
  }
})

function handleClick() {
  // 追踪返回顶部点击，记录当前滚动位置
  const scrollPosition = window.scrollY || document.documentElement.scrollTop
  trackBackToTop(scrollPosition)

  // 点击动画
  if (buttonRef.value) {
    gsap.to(buttonRef.value, {
      scale: 0.9,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
    })
  }
  scrollToTop()
}
</script>

<template>
  <Transition name="fade">
    <button
      v-show="showButton"
      ref="buttonRef"
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: $radius-full;
  color: white;
  cursor: pointer;
  box-shadow:
    0 4px 20px rgba(102, 126, 234, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
  border: none;
  outline: none;

  // 光晕效果
  &::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: $radius-full;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
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
      0 8px 30px rgba(102, 126, 234, 0.5),
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
      0 4px 16px rgba(102, 126, 234, 0.45),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;

    svg {
      width: 20px;
      height: 20px;
    }

    &:active {
      transform: scale(0.92);
      box-shadow: 0 2px 10px rgba(102, 126, 234, 0.35);
    }
  }
}

// Transition
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
