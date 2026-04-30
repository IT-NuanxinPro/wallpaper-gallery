<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  autoplay: {
    type: Boolean,
    default: true,
  },
  controls: {
    type: Boolean,
    default: true,
  },
  isPortrait: {
    type: Boolean,
    default: false,
  },
  poster: {
    type: String,
    default: '',
  },
  src: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['canplay', 'error', 'loadedmetadata'])

const playerRef = ref(null)
const muted = ref(true)
const duration = ref(0)

const playerKey = computed(() => `${props.src}-${props.poster}`)

watch(() => props.src, async () => {
  if (!playerRef.value)
    return

  if (!props.src) {
    releaseVideoElement(playerRef.value)
    return
  }

  try {
    playerRef.value.load()
    duration.value = 0

    if (props.autoplay) {
      await playerRef.value.play()
    }
  }
  catch {
    // 浏览器可能拦截自动播放
  }
})

onMounted(async () => {
  if (!props.src || !playerRef.value || !props.autoplay)
    return

  try {
    await playerRef.value.play()
  }
  catch {
    // 自动播放可能被浏览器阻止
  }
})

onUnmounted(() => {
  if (playerRef.value) {
    releaseVideoElement(playerRef.value)
  }
})

function releaseVideoElement(videoEl) {
  videoEl.pause()
  videoEl.removeAttribute('src')
  videoEl.load()
  duration.value = 0
}

function release() {
  if (playerRef.value) {
    releaseVideoElement(playerRef.value)
  }
}

function handleLoadedMetadata(event) {
  duration.value = event?.target?.duration || 0
  emit('loadedmetadata', event)
}

function handleError() {
  emit('error')
}

function handleCanPlay(event) {
  emit('canplay', event)
}

function handlePlay() {
}

function handlePause() {
}

defineExpose({
  release,
})
</script>

<template>
  <div class="video-wallpaper-player">
    <div class="video-wallpaper-player__stage" :class="{ 'is-portrait': isPortrait }">
      <video
        :key="playerKey"
        ref="playerRef"
        class="video-wallpaper-player__media"
        :class="{ 'is-portrait': isPortrait }"
        :src="src"
        :poster="poster"
        :muted="muted"
        :autoplay="autoplay"
        :controls="controls"
        loop
        playsinline
        webkit-playsinline="true"
        preload="auto"
        @canplay="handleCanPlay"
        @loadedmetadata="handleLoadedMetadata"
        @play="handlePlay"
        @pause="handlePause"
        @error="handleError"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.video-wallpaper-player {
  width: 100%;

  &__stage {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 420px;
    padding: 0;
    background: transparent;

    &.is-portrait {
      min-height: 700px;
    }
  }

  &__media {
    display: block;
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: min(78vh, 920px);
    border-radius: 22px;
    background: transparent;
    box-shadow: 0 18px 32px rgba(15, 23, 42, 0.14);
    object-fit: contain;

    &.is-portrait {
      width: auto;
      max-width: min(100%, 480px);
      aspect-ratio: 9 / 16;
      object-fit: cover;
      border-radius: 34px;
      box-shadow: 0 24px 52px rgba(15, 23, 42, 0.18);
    }
  }
  @media (max-width: 768px) {
    &__stage {
      min-height: 300px;

      &.is-portrait {
        min-height: 500px;
      }
    }
  }
}
</style>
