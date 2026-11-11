<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LoadingSurface from '@/components/common/feedback/LoadingSurface.vue'

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

const emit = defineEmits(['canplay', 'error', 'loadedmetadata', 'playing', 'waiting'])

const playerRef = ref(null)
const muted = ref(true)
const duration = ref(0)
const status = ref(props.autoplay ? 'loading' : 'paused')
const busy = computed(() => status.value === 'loading')
let playAttempt = 0
let loadingTimer

const playerKey = computed(() => `${props.src}-${props.poster}`)

watch(playerKey, async () => {
  playAttempt++
  clearTimeout(loadingTimer)
  status.value = props.autoplay ? 'loading' : 'paused'
  duration.value = 0
  await nextTick()
  if (!props.src)
    return release()
  if (props.autoplay)
    startPlayback()
})

onMounted(() => {
  if (props.autoplay)
    startPlayback()
})

onBeforeUnmount(() => {
  playAttempt++
  clearTimeout(loadingTimer)
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
  playAttempt++
  clearTimeout(loadingTimer)
  status.value = 'paused'
  if (playerRef.value) {
    releaseVideoElement(playerRef.value)
  }
}

function handleLoadedMetadata(event) {
  if (event.target !== playerRef.value)
    return
  duration.value = event?.target?.duration || 0
  emit('loadedmetadata', event)
}

function handleError(event) {
  if (event.target !== playerRef.value)
    return
  clearTimeout(loadingTimer)
  status.value = 'error'
  emit('error')
}

function handleCanPlay(event) {
  if (event.target !== playerRef.value)
    return
  emit('canplay', event)
}

function beginLoading() {
  clearTimeout(loadingTimer)
  status.value = 'loading'
  // 慢网或永久挂起也必须提供可操作出口，收到 playing 后仍会自动恢复。
  loadingTimer = setTimeout(() => {
    status.value = 'slow'
  }, 20000)
}

async function startPlayback() {
  const video = playerRef.value
  if (!video || !props.src)
    return
  const attempt = ++playAttempt
  if (status.value === 'error')
    video.load()
  beginLoading()
  try {
    await video.play()
  }
  catch (error) {
    if (attempt !== playAttempt || video !== playerRef.value)
      return
    clearTimeout(loadingTimer)
    status.value = error?.name === 'NotAllowedError' ? 'blocked' : 'error'
    if (status.value === 'error')
      emit('error')
  }
}

function handlePlaying(event) {
  if (event.target !== playerRef.value)
    return
  clearTimeout(loadingTimer)
  status.value = 'playing'
  emit('playing', event)
}

function handleWaiting(event) {
  if (event.target !== playerRef.value || status.value !== 'playing')
    return
  beginLoading()
  emit('waiting', event)
}

function handlePause(event) {
  if (event.target === playerRef.value && status.value === 'playing') {
    clearTimeout(loadingTimer)
    status.value = 'paused'
  }
}

defineExpose({
  release,
})
</script>

<template>
  <div class="video-wallpaper-player">
    <LoadingSurface class="video-wallpaper-player__stage" :class="{ 'is-portrait': isPortrait }" :busy="busy" label="正在加载视频">
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
        @playing="handlePlaying"
        @waiting="handleWaiting"
        @stalled="handleWaiting"
        @pause="handlePause"
        @error="handleError"
      />
      <div v-if="!busy && status !== 'playing'" class="video-wallpaper-player__feedback" role="status">
        <p>{{ status === 'blocked' ? '浏览器已暂停自动播放' : status === 'error' ? '视频暂时无法播放' : status === 'slow' ? '视频加载较慢，可重新尝试' : '视频已暂停' }}</p>
        <button type="button" @click="startPlayback">
          {{ status === 'error' || status === 'slow' ? '重新播放' : '点击播放' }}
        </button>
      </div>
    </LoadingSurface>
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
    --color-bg-secondary: #101827;
    --color-text-secondary: #cbd5e1;

    &.is-portrait {
      min-height: 700px;
    }
  }

  &__stage :deep(.loading-surface__content) {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__feedback {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 16px;
    padding: 24px;
    color: #fff;
    background: rgba(16, 24, 39, 0.82);
    text-align: center;

    button {
      min-height: 44px;
      padding: 10px 20px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 999px;
      color: #fff;
      background: #2563eb;
      font: inherit;
      cursor: pointer;
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
