<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  alt: {
    type: String,
    default: '头像',
  },
  blockedHosts: {
    type: Array,
    default: () => [],
  },
  fallbackClass: {
    type: String,
    default: '',
  },
  fallbackStyle: {
    type: Object,
    default: () => ({}),
  },
  imageClass: {
    type: String,
    default: '',
  },
  initial: {
    type: String,
    default: 'U',
  },
  sources: {
    type: Array,
    default: () => [],
  },
  src: {
    type: String,
    default: '',
  },
})

const hasLoadError = ref(false)
const activeSourceIndex = ref(0)

const normalizedSrc = computed(() => String(props.src || '').trim())
const normalizedSources = computed(() =>
  (Array.isArray(props.sources) ? props.sources : [])
    .map(source => String(source || '').trim())
    .filter(Boolean),
)
const candidateSources = computed(() => {
  const directSource = normalizedSrc.value ? [normalizedSrc.value] : []
  const mergedSources = normalizedSources.value.length ? normalizedSources.value : directSource

  return mergedSources.filter((source, index, list) =>
    !props.blockedHosts.some(host => source.includes(host))
    && list.indexOf(source) === index,
  )
})
const effectiveSrc = computed(() => hasLoadError.value ? '' : candidateSources.value[activeSourceIndex.value] || '')

watch([() => props.src, () => props.sources], () => {
  hasLoadError.value = false
  activeSourceIndex.value = 0
})

function handleError() {
  if (activeSourceIndex.value < candidateSources.value.length - 1) {
    activeSourceIndex.value += 1
    return
  }

  hasLoadError.value = true
}
</script>

<template>
  <img
    v-if="effectiveSrc"
    :class="imageClass"
    :src="effectiveSrc"
    :alt="alt"
    @error="handleError"
  >
  <slot v-else name="fallback">
    <span :class="fallbackClass" :style="fallbackStyle">{{ initial }}</span>
  </slot>
</template>
