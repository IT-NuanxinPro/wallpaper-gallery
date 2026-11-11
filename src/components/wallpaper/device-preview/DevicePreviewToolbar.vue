<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DevicePreviewIcon from './DevicePreviewIcon.vue'

const props = defineProps({ devices: { type: Array, required: true }, selected: { type: String, required: true }, follow: Boolean, vertical: Boolean, tabletLayout: { type: String, default: 'both' }, folding: Boolean })
const emit = defineEmits(['select', 'follow', 'layout', 'replay'])
const toolbar = ref(null)
const indicator = ref({ opacity: 0 })
let observer
function alignIndicator() {
  const active = toolbar.value?.querySelector('[data-device-option][aria-pressed="true"], [aria-checked="true"]')
  indicator.value = active ? { opacity: 1, width: `${active.offsetWidth}px`, height: `${active.offsetHeight}px`, transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)` } : { opacity: 0 }
}
watch(() => [props.selected, props.follow, props.tabletLayout, props.vertical], async () => {
  await nextTick()
  alignIndicator()
})
onMounted(() => {
  observer = new ResizeObserver(alignIndicator)
  observer.observe(toolbar.value)
  alignIndicator()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="device-controls" :class="{ 'is-vertical': vertical }">
    <div ref="toolbar" class="device-toolbar" :class="{ 'is-vertical': vertical }" role="toolbar" aria-label="预览设备">
      <span class="device-toolbar__indicator" :style="indicator" />
      <button class="device-toolbar__follow" role="switch" :aria-checked="follow" title="按本机屏幕比例预览" @click="emit('follow')">
        <DevicePreviewIcon name="screen" /><i class="device-toolbar__toggle" :class="{ 'is-on': follow }" /><span>本机屏幕</span>
      </button>
      <i class="device-toolbar__separator" />
      <button v-for="device in devices" :key="device.id" data-device-option :aria-pressed="!follow && selected === device.id" :title="device.label" @click="emit('select', device.id)">
        <DevicePreviewIcon :name="device.id" /><span>{{ device.label }}</span>
      </button>
    </div>
    <div class="device-toolbar__extras">
      <div class="device-toolbar device-toolbar--secondary device-toolbar__extra" :class="{ 'is-visible': selected === 'tablet' && !vertical && !follow }" :inert="!(selected === 'tablet' && !vertical && !follow)">
        <button v-for="layout in [{ id: 'both', label: '并排' }, { id: 'landscape', label: '横放' }, { id: 'portrait', label: '竖放' }]" :key="layout.id" class="device-toolbar__layout" :aria-pressed="tabletLayout === layout.id" @click="emit('layout', layout.id)">
          {{ layout.label }}
        </button>
      </div>
      <div class="device-toolbar device-toolbar--secondary device-toolbar__extra" :class="{ 'is-visible': !follow && (selected === 'fold2' || selected === 'fold3') }" :inert="follow || !['fold2', 'fold3'].includes(selected)">
        <button title="重播折叠动画" aria-label="重播折叠动画" @click="emit('replay')">
          <DevicePreviewIcon name="replay" /><span>重播</span>
        </button>
      </div>
    </div>
  </div>
</template>
