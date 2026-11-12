<script setup>
import { computed } from 'vue'
import { onlinePresence } from '@/composables/useOnlinePresence'

const count = onlinePresence.count
const available = computed(() => Number.isSafeInteger(count.value) && count.value >= 0)
const formattedCount = computed(() => available.value ? count.value.toLocaleString('zh-CN') : '')
</script>

<template>
  <span class="online-visitors-slot" :class="{ 'is-available': available }" :aria-hidden="!available">
    <span
      class="online-visitors"
      :aria-label="available ? `${formattedCount} 人在线` : undefined"
    >
      <span class="online-visitors-count" aria-hidden="true">
        <Transition name="online-count">
          <span :key="formattedCount" class="online-visitors-value">
            <span class="online-visitors-dot" />
            {{ formattedCount }}
          </span>
        </Transition>
      </span>
      <span aria-hidden="true">人在线</span>
    </span>
  </span>
</template>

<style scoped>
.online-visitors-slot {
  display: inline-flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  inline-size: 150px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 180ms ease;
}

.online-visitors-slot.is-available {
  opacity: 1;
  visibility: visible;
}

.online-visitors {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
}

.online-visitors-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-success);
}

.online-visitors-count {
  position: relative;
  display: inline-block;
  width: 8ch;
  height: 1.5em;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.online-visitors-value {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.online-count-enter-active,
.online-count-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.online-count-enter-from {
  opacity: 0;
  transform: translateY(2px);
}

.online-count-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

@media (max-width: 767px) {
  .online-visitors-slot {
    inline-size: 132px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .online-visitors-slot,
  .online-count-enter-active,
  .online-count-leave-active {
    transition: none;
  }

  .online-count-enter-from,
  .online-count-leave-to {
    transform: none;
  }
}
</style>
