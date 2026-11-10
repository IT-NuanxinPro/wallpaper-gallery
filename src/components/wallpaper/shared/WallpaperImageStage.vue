<script setup>
import { computed, toRef } from 'vue'
import LoadingSurface from '@/components/common/feedback/LoadingSurface.vue'
import { getMediaAspectRatio, useDecodedImage } from '@/composables/useDecodedImage'

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '壁纸预览' },
  resolution: { type: Object, default: null },
  fallbackRatio: { type: String, default: '16 / 10' },
})
const emit = defineEmits(['load', 'error'])
const { ready, failed, handleLoad, handleError } = useDecodedImage(toRef(props, 'src'))
const frameStyle = computed(() => ({ aspectRatio: getMediaAspectRatio(props.resolution, props.fallbackRatio) }))

async function onLoad(event) {
  const image = event.target
  if (await handleLoad(event)) {
    // 在解码完成时快照尺寸，父组件无需在异步事件链中再次读取 DOM 属性。
    emit('load', {
      target: image,
      dimensions: { width: image.naturalWidth, height: image.naturalHeight },
    })
  }
}

function onError() {
  handleError()
  emit('error')
}
</script>

<template>
  <LoadingSurface
    class="wallpaper-image-stage"
    :style="frameStyle"
    :busy="!ready && !failed"
    label="正在加载图片"
    :size="64"
  >
    <img
      :key="src"
      :src="src"
      :alt="alt"
      decoding="async"
      class="wallpaper-image-stage__image"
      :class="{ 'is-ready': ready }"
      @load="onLoad"
      @error="onError"
    >
    <div v-if="failed" class="wallpaper-image-stage__error" role="status">
      图片暂时无法加载，可切换壁纸或重新打开
    </div>
  </LoadingSurface>
</template>

<style scoped>
.wallpaper-image-stage {
  --color-bg-secondary: #101827;
  --color-text-secondary: #cbd5e1;
  width: 100%;
  flex: none;
  max-height: var(--media-stage-max-height, min(68dvh, 640px));
  overflow: hidden;
  isolation: isolate;
  background: #101827;
  border-radius: inherit;
}

.wallpaper-image-stage__image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.wallpaper-image-stage__image.is-ready {
  opacity: 1;
}

.wallpaper-image-stage__error {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  padding: 24px;
  color: #cbd5e1;
  text-align: center;
  font-size: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .wallpaper-image-stage__image {
    transition: none;
  }
}
</style>
