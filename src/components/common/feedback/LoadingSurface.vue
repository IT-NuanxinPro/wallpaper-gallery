<script setup>
import SoftLoading from './SoftLoading.vue'
import { useLoadingSurface } from './useLoadingSurface'

const props = defineProps({
  busy: { type: Boolean, default: false },
  label: { type: String, default: '正在加载' },
  size: { type: [Number, String], default: 64 },
  minVisible: { type: Number, default: 0 },
  showDelay: { type: Number, default: 120 },
})
const visible = useLoadingSurface(() => props.busy, () => props.minVisible, () => props.showDelay)
</script>

<template>
  <div class="loading-surface" :aria-busy="busy">
    <div class="loading-surface__content" :inert="busy ? true : undefined">
      <slot />
    </div>
    <Transition name="loading-surface" appear>
      <div v-if="visible" class="loading-surface__veil" :class="{ 'is-finishing': !busy }" :aria-hidden="!busy ? true : undefined">
        <slot name="loading">
          <SoftLoading :size="size" :label="label" />
        </slot>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.loading-surface {
  position: relative;
  min-width: 0;
  min-height: 0;
  isolation: isolate;
}

.loading-surface__content {
  height: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: inherit;
}

.loading-surface__veil {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  border-radius: inherit;
  background: color-mix(in srgb, var(--color-bg-secondary) 82%, transparent);
}

.loading-surface__veil.is-finishing {
  pointer-events: none;
}

.loading-surface-enter-active {
  transition: opacity 180ms ease-out;
}

.loading-surface-leave-active {
  transition: opacity 180ms ease-in;
}

.loading-surface-enter-active :deep(.soft-loading),
.loading-surface-leave-active :deep(.soft-loading) {
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.loading-surface-enter-from,
.loading-surface-leave-to {
  opacity: 0;
}

.loading-surface-enter-from :deep(.soft-loading) {
  transform: translateY(4px) scale(0.96);
}

.loading-surface-leave-to :deep(.soft-loading) {
  transform: translateY(-3px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .loading-surface-enter-active,
  .loading-surface-leave-active,
  .loading-surface-enter-active :deep(.soft-loading),
  .loading-surface-leave-active :deep(.soft-loading) {
    transition: none;
  }
}
</style>
