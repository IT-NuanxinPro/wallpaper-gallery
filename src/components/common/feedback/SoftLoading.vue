<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { observeLoadingVisibility } from './observeLoadingVisibility'

const props = defineProps({
  size: { type: [Number, String], default: 64 },
  label: { type: String, default: '' },
  decorative: { type: Boolean, default: false },
})
const element = ref(null)
const running = ref(false)
const loaderSize = computed(() => `${Math.max(1, Number(props.size) || 64)}px`)
let stopObserving

onMounted(() => {
  stopObserving = observeLoadingVisibility(element.value, (visible) => {
    running.value = visible
  })
})
onBeforeUnmount(() => stopObserving?.())
</script>

<template>
  <span
    ref="element"
    class="soft-loading"
    :class="{ 'is-paused': !running }"
    :style="{ '--loader-size': loaderSize }"
    :role="decorative ? undefined : 'status'"
    :aria-live="decorative ? undefined : 'polite'"
    :aria-label="!decorative && !label ? '正在加载' : undefined"
    :aria-hidden="decorative ? true : undefined"
  >
    <svg class="pl" viewBox="0 0 240 240" aria-hidden="true">
      <circle class="pl__ring pl__ring--a" cx="120" cy="120" r="105" fill="none" stroke-width="20" stroke-dasharray="0 660" stroke-dashoffset="-330" stroke-linecap="round" />
      <circle class="pl__ring pl__ring--b" cx="120" cy="120" r="35" fill="none" stroke-width="20" stroke-dasharray="0 220" stroke-dashoffset="-110" stroke-linecap="round" />
      <circle class="pl__ring pl__ring--c" cx="85" cy="120" r="70" fill="none" stroke-width="20" stroke-dasharray="0 440" stroke-dashoffset="-110" stroke-linecap="round" />
      <circle class="pl__ring pl__ring--d" cx="155" cy="120" r="70" fill="none" stroke-width="20" stroke-dasharray="0 440" stroke-dashoffset="-110" stroke-linecap="round" />
    </svg>
    <span v-if="label" class="soft-loading__label">{{ label }}</span>
  </span>
</template>

<style scoped>
.soft-loading {
  flex: none;
  vertical-align: middle;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--color-text-secondary);
}
.soft-loading__label {
  font-size: 13px;
  font-weight: 550;
  line-height: 1.5;
}

/* Nawsome/young-goat-78：保留原版四色、四圆环和2秒错峰动画。 */
.pl {
  display: block;
  width: var(--loader-size);
  height: var(--loader-size);
  overflow: visible;
}
.pl__ring {
  animation: ringA 2s linear infinite;
}
.is-paused .pl__ring {
  animation-play-state: paused;
}
.pl__ring--a {
  stroke: #f42f25;
}
.pl__ring--b {
  animation-name: ringB;
  stroke: #f49725;
}
.pl__ring--c {
  animation-name: ringC;
  stroke: #255ff4;
}
.pl__ring--d {
  animation-name: ringD;
  stroke: #f42582;
}

@keyframes ringA {
  from,
  4% {
    stroke-dasharray: 0 660;
    stroke-width: 20;
    stroke-dashoffset: -330;
  }
  12% {
    stroke-dasharray: 60 600;
    stroke-width: 30;
    stroke-dashoffset: -335;
  }
  32% {
    stroke-dasharray: 60 600;
    stroke-width: 30;
    stroke-dashoffset: -595;
  }
  40%,
  54% {
    stroke-dasharray: 0 660;
    stroke-width: 20;
    stroke-dashoffset: -660;
  }
  62% {
    stroke-dasharray: 60 600;
    stroke-width: 30;
    stroke-dashoffset: -665;
  }
  82% {
    stroke-dasharray: 60 600;
    stroke-width: 30;
    stroke-dashoffset: -925;
  }
  90%,
  to {
    stroke-dasharray: 0 660;
    stroke-width: 20;
    stroke-dashoffset: -990;
  }
}
@keyframes ringB {
  from,
  12% {
    stroke-dasharray: 0 220;
    stroke-width: 20;
    stroke-dashoffset: -110;
  }
  20% {
    stroke-dasharray: 20 200;
    stroke-width: 30;
    stroke-dashoffset: -115;
  }
  40% {
    stroke-dasharray: 20 200;
    stroke-width: 30;
    stroke-dashoffset: -195;
  }
  48%,
  62% {
    stroke-dasharray: 0 220;
    stroke-width: 20;
    stroke-dashoffset: -220;
  }
  70% {
    stroke-dasharray: 20 200;
    stroke-width: 30;
    stroke-dashoffset: -225;
  }
  90% {
    stroke-dasharray: 20 200;
    stroke-width: 30;
    stroke-dashoffset: -305;
  }
  98%,
  to {
    stroke-dasharray: 0 220;
    stroke-width: 20;
    stroke-dashoffset: -330;
  }
}
@keyframes ringC {
  from {
    stroke-dasharray: 0 440;
    stroke-width: 20;
    stroke-dashoffset: 0;
  }
  8% {
    stroke-dasharray: 40 400;
    stroke-width: 30;
    stroke-dashoffset: -5;
  }
  28% {
    stroke-dasharray: 40 400;
    stroke-width: 30;
    stroke-dashoffset: -175;
  }
  36%,
  58% {
    stroke-dasharray: 0 440;
    stroke-width: 20;
    stroke-dashoffset: -220;
  }
  66% {
    stroke-dasharray: 40 400;
    stroke-width: 30;
    stroke-dashoffset: -225;
  }
  86% {
    stroke-dasharray: 40 400;
    stroke-width: 30;
    stroke-dashoffset: -395;
  }
  94%,
  to {
    stroke-dasharray: 0 440;
    stroke-width: 20;
    stroke-dashoffset: -440;
  }
}
@keyframes ringD {
  from,
  8% {
    stroke-dasharray: 0 440;
    stroke-width: 20;
    stroke-dashoffset: 0;
  }
  16% {
    stroke-dasharray: 40 400;
    stroke-width: 30;
    stroke-dashoffset: -5;
  }
  36% {
    stroke-dasharray: 40 400;
    stroke-width: 30;
    stroke-dashoffset: -175;
  }
  44%,
  50% {
    stroke-dasharray: 0 440;
    stroke-width: 20;
    stroke-dashoffset: -220;
  }
  58% {
    stroke-dasharray: 40 400;
    stroke-width: 30;
    stroke-dashoffset: -225;
  }
  78% {
    stroke-dasharray: 40 400;
    stroke-width: 30;
    stroke-dashoffset: -395;
  }
  86%,
  to {
    stroke-dasharray: 0 440;
    stroke-width: 20;
    stroke-dashoffset: -440;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pl__ring {
    animation: none;
    stroke-width: 20;
  }
  .pl__ring--a {
    stroke-dasharray: 140 520;
    stroke-dashoffset: -80;
  }
  .pl__ring--b {
    stroke-dasharray: 60 160;
    stroke-dashoffset: -60;
  }
  .pl__ring--c {
    stroke-dasharray: 110 330;
    stroke-dashoffset: -180;
  }
  .pl__ring--d {
    stroke-dasharray: 110 330;
    stroke-dashoffset: -20;
  }
}
</style>
