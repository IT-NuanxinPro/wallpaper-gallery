<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useMotionPreference } from '@/composables/useMotionPreference'

const props = defineProps({
  tabs: { type: Array, required: true },
  modelValue: { type: String, required: true },
  idPrefix: { type: String, default: '' },
  panelId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const generatedId = useId()
const prefix = computed(() => props.idPrefix || `profile-tabs-${generatedId}`)
const reducedMotion = useMotionPreference()
const nav = ref(null)
const marker = ref({ opacity: 0 })
let observer
function align() {
  const active = nav.value?.querySelector('[aria-selected="true"]')
  marker.value = active ? { width: `${active.offsetWidth}px`, transform: `translateX(${active.offsetLeft}px)`, opacity: 1 } : { opacity: 0 }
}
function keyboard(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
    return
  if (!props.tabs.length)
    return
  event.preventDefault()
  const index = props.tabs.findIndex(tab => tab.key === props.modelValue)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? props.tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + props.tabs.length) % props.tabs.length
  emit('update:modelValue', props.tabs[next].key)
  nav.value?.querySelectorAll('[role="tab"]')[next]?.focus()
}
watch(() => [props.modelValue, props.tabs], () => nextTick(align))
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(align)
    observer.observe(nav.value)
  }
  align()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <nav ref="nav" class="profile-tabs" :class="{ 'is-reduced-motion': reducedMotion }" role="tablist" aria-label="个人主页内容" @keydown="keyboard">
    <button v-for="tab in tabs" :id="`${prefix}-${tab.key}`" :key="tab.key" type="button" role="tab" :aria-selected="modelValue === tab.key" :aria-controls="panelId || undefined" :tabindex="modelValue === tab.key ? 0 : -1" @click="emit('update:modelValue', tab.key)">
      {{ tab.label }}<span v-if="tab.count !== undefined">{{ tab.count }}</span>
    </button>
    <i class="profile-tabs__marker" :style="marker" aria-hidden="true" />
  </nav>
</template>

<style scoped>
.profile-tabs {
  position: relative;
  display: flex;
  gap: 26px;
  padding: 0 26px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--color-border);
}
.profile-tabs button {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  border: 0;
  background: none;
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  padding: 20px 4px;
  cursor: pointer;
  transition: color 180ms;
}
.profile-tabs button[aria-selected='true'] {
  color: var(--color-accent);
}
.profile-tabs button span {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.7;
}
.profile-tabs__marker {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--accent-gradient);
  transition:
    width 180ms cubic-bezier(0.2, 0, 0, 1),
    transform 180ms cubic-bezier(0.2, 0, 0, 1),
    opacity 160ms;
}
.profile-tabs button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -4px;
  border-radius: 8px;
}
.profile-tabs.is-reduced-motion .profile-tabs__marker {
  transition: none;
}
@media (max-width: 600px) {
  .profile-tabs {
    gap: 20px;
    padding-inline: 18px;
  }
  .profile-tabs button {
    font-size: 14px;
    padding-block: 16px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .profile-tabs__marker {
    transition: none;
  }
}
</style>
