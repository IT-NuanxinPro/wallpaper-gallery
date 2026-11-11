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

<style src="./soft-loading.css" scoped></style>
