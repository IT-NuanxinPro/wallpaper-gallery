<script setup>
defineProps({
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md', 'lg'].includes(v),
  },
})
</script>

<template>
  <div class="loading-spinner" :class="[`size-${size}`]" aria-hidden="true">
    <div class="spinner" />
  </div>
</template>

<style lang="scss" scoped>
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;

  &.size-sm {
    .spinner {
      width: 20px;
      height: 20px;
      border-width: 2px;
    }
  }

  &.size-md {
    .spinner {
      width: 32px;
      height: 32px;
      border-width: 3px;
    }
  }

  &.size-lg {
    .spinner {
      width: 36px;
      height: 36px;
      border-width: 3px;
    }
  }
}

.spinner {
  border-radius: 50%;
  border-style: solid;
  border-color: var(--color-border);
  border-top-color: var(--color-accent);
  border-right-color: var(--color-accent);
  animation: spin 0.85s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
