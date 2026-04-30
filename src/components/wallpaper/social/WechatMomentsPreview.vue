<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import RemoteAvatar from '@/components/common/ui/RemoteAvatar.vue'

const props = defineProps({
  coverPoster: {
    type: String,
    default: '',
  },
  profileAvatarInitial: {
    type: String,
    default: '雨',
  },
  profileAvatarSources: {
    type: Array,
    default: () => [],
  },
  profileAvatarSrc: {
    type: String,
    default: '',
  },
  profileAvatarStyle: {
    type: Object,
    default: () => ({}),
  },
  profileName: {
    type: String,
    default: '小雨',
  },
  profileSignature: {
    type: String,
    default: '生活很苦，自己加糖',
  },
  videoSrc: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['canplay', 'error', 'loadedmetadata'])

const coverVideoRef = ref(null)
const statusTime = '10:18'
const FIRST_FEED_AVATAR = 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.1.26/wallpaper/avatar/%E4%BA%BA%E5%83%8F/%E5%8D%A1%E9%80%9A%E7%AE%80%E7%AC%94%E7%94%BB/%E5%91%86%E8%90%8C%E5%B0%91%E5%A5%B3_%E7%8C%AB%E8%80%B3%E5%A4%B4%E5%A5%97.png'

const posts = computed(() => [
  {
    id: 'post-1',
    name: '小张',
    avatarInitial: '张',
    avatarSrc: FIRST_FEED_AVATAR,
    avatarStyle: {
      '--moments-avatar-start': '#60a5fa',
      '--moments-avatar-end': '#1d4ed8',
    },
    content: '周末愉快，天气真好☀️',
    mediaSrc: props.coverPoster,
    mediaAlt: '朋友圈照片',
    time: '1小时前',
    useTallMedia: true,
    menuOffset: 8,
  },
  {
    id: 'post-2',
    name: '强哥',
    avatarInitial: '马',
    avatarStyle: {
      '--moments-avatar-start': '#86efac',
      '--moments-avatar-end': '#16a34a',
    },
    content: '今日份的快乐也正常营业啦🍃',
    mediaSrc: '',
    mediaAlt: '',
    time: '3小时前',
    useTallMedia: false,
    menuOffset: 8,
  },
])

watch(() => props.videoSrc, async () => {
  if (!coverVideoRef.value)
    return

  if (!props.videoSrc) {
    release()
    return
  }

  try {
    coverVideoRef.value.load()
    await coverVideoRef.value.play()
  }
  catch {
    // 自动播放可能被浏览器阻止
  }
})

onUnmounted(() => {
  release()
})

function handleCanPlay(event) {
  emit('canplay', event)
}

function handleLoadedMetadata(event) {
  emit('loadedmetadata', event)
}

function handleError() {
  emit('error')
}

function release() {
  if (!coverVideoRef.value)
    return

  coverVideoRef.value.pause()
  coverVideoRef.value.removeAttribute('src')
  coverVideoRef.value.load()
}

defineExpose({
  release,
})
</script>

<template>
  <div class="wechat-moments-preview">
    <header class="wechat-moments-preview__statusbar">
      <span class="wechat-moments-preview__time">{{ statusTime }}</span>

      <div class="wechat-moments-preview__signals" aria-hidden="true">
        <span class="signal signal--cell">
          <i />
          <i />
          <i />
        </span>
        <span class="signal signal--wifi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
            <path d="M2.5 9.5C7.9 4.9 16.1 4.9 21.5 9.5" />
            <path d="M5.8 12.9C9.4 9.8 14.6 9.8 18.2 12.9" />
            <path d="M9.3 16.2C10.9 14.9 13.1 14.9 14.7 16.2" />
            <circle cx="12" cy="18.3" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span class="signal signal--battery">
          <svg viewBox="0 0 30 16" fill="none">
            <rect x="1" y="1" width="24" height="14" rx="4" stroke="currentColor" stroke-width="1.5" />
            <rect x="3.5" y="3.5" width="17" height="9" rx="2.5" fill="currentColor" />
            <rect x="26" y="5" width="3" height="6" rx="1.4" fill="currentColor" />
          </svg>
          <span>72</span>
        </span>
      </div>
    </header>

    <div class="wechat-moments-preview__nav">
      <button class="wechat-moments-preview__nav-btn" type="button" aria-label="返回">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M14.5 4.5 7 12l7.5 7.5" />
        </svg>
      </button>

      <button class="wechat-moments-preview__nav-btn" type="button" aria-label="拍照">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.2 6.1h2.2l1.2-1.7c.3-.5.9-.8 1.5-.8h2c.6 0 1.2.3 1.5.8l1.2 1.7h2.2c1.4 0 2.6 1.2 2.6 2.6v8.7c0 1.4-1.2 2.6-2.6 2.6H7.2c-1.4 0-2.6-1.2-2.6-2.6V8.7c0-1.4 1.2-2.6 2.6-2.6Zm5.8 3a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Zm0 1.8a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z" />
        </svg>
      </button>
    </div>

    <div class="wechat-moments-preview__scroll">
      <section class="wechat-moments-preview__cover">
        <div class="wechat-moments-preview__cover-media">
          <video
            ref="coverVideoRef"
            class="wechat-moments-preview__cover-video"
            :src="videoSrc"
            autoplay
            muted
            loop
            playsinline
            webkit-playsinline="true"
            preload="auto"
            @canplay="handleCanPlay"
            @loadedmetadata="handleLoadedMetadata"
            @error="handleError"
          />
          <div class="wechat-moments-preview__cover-shade" />
        </div>

        <div class="wechat-moments-preview__profile">
          <div class="wechat-moments-preview__profile-copy">
            <strong>{{ profileName }}</strong>
          </div>

          <div class="wechat-moments-preview__profile-avatar">
            <RemoteAvatar
              :sources="profileAvatarSources"
              :src="profileAvatarSrc"
              :alt="`${profileName} 头像`"
              :initial="profileAvatarInitial"
              :fallback-style="profileAvatarStyle"
              image-class="wechat-moments-preview__profile-avatar-image"
              fallback-class="wechat-moments-preview__profile-avatar-fallback"
            />
          </div>
        </div>
      </section>

      <div class="wechat-moments-preview__signature">
        <span>{{ profileSignature }}</span>
      </div>

      <section class="wechat-moments-preview__feed">
        <article v-for="post in posts" :key="post.id" class="moments-card">
          <div class="moments-card__avatar" :style="post.avatarStyle">
            <img
              v-if="post.avatarSrc"
              :src="post.avatarSrc"
              :alt="`${post.name} 头像`"
              class="moments-card__avatar-image"
            >
            <template v-else>
              {{ post.avatarInitial }}
            </template>
          </div>

          <div class="moments-card__body">
            <div class="moments-card__name">
              {{ post.name }}
            </div>
            <p class="moments-card__text">
              {{ post.content }}
            </p>

            <div
              class="moments-card__media"
              :class="{ 'moments-card__media--square': !post.useTallMedia }"
            >
              <img
                v-if="post.mediaSrc"
                :src="post.mediaSrc"
                :alt="post.mediaAlt"
                class="moments-card__media-image"
              >
              <div v-else class="moments-card__mock-photo">
                <div class="moments-card__mock-photo-cup" />
                <div class="moments-card__mock-photo-road" />
              </div>
            </div>

            <div class="moments-card__footer">
              <span class="moments-card__time">{{ post.time }}</span>
              <button class="moments-card__menu" :style="{ marginTop: `${post.menuOffset}px` }" type="button" aria-label="更多">
                <i />
                <i />
                <i />
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wechat-moments-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
  color: #111827;

  &__statusbar,
  &__nav {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 15px;
    color: #fff;
  }

  &__statusbar {
    top: 13px;
    height: 20px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0;
  }

  &__nav {
    top: 62px;
    height: 34px;
  }

  &__nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    color: inherit;
    background: transparent;
    border: 0;

    svg {
      width: 21px;
      height: 21px;
    }
  }

  &__time {
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.12);
  }

  &__signals {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__scroll {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__cover {
    position: relative;
    height: 286px;
    overflow: visible;
    background: linear-gradient(180deg, #8fc0f3 0%, #7eb3ec 45%, #6c9dd5 100%);
  }

  &__cover-media {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  &__cover-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__cover-shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(67, 119, 183, 0.1) 0%, rgba(17, 24, 39, 0) 38%, rgba(15, 23, 42, 0.08) 100%),
      radial-gradient(circle at 50% 14%, rgba(255, 255, 255, 0.2), transparent 42%);
    pointer-events: none;
  }

  &__profile {
    position: absolute;
    right: 14px;
    bottom: -26px;
    z-index: 8;
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }

  &__profile-copy {
    margin-bottom: 36px;
    text-align: right;
    color: #fff;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);

    strong {
      display: block;
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
    }
  }

  &__profile-avatar {
    width: 65px;
    height: 65px;
    border-radius: 14px;
    overflow: hidden;
    position: relative;
    z-index: 9;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
    background: #dbe4f1;
    flex-shrink: 0;
  }

  &__signature {
    transform: translateX(-10px);
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: #9b9b9b;
    font-size: 10px;
  }
}

.moments-card__avatar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

:deep(.wechat-moments-preview__profile-avatar-image),
:deep(.wechat-moments-preview__profile-avatar-fallback) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
}

:deep(.wechat-moments-preview__profile-avatar-image) {
  object-fit: cover;
}

:deep(.wechat-moments-preview__profile-avatar-fallback) {
  color: #fff;
  background: linear-gradient(135deg, var(--avatar-accent-start, #93c5fd), var(--avatar-accent-end, #2563eb));
}

.signal {
  display: inline-flex;
  align-items: center;
  color: #fff;

  &--cell {
    align-items: flex-end;
    gap: 1.6px;
    height: 12px;
    transform: translateX(10px);

    i {
      width: 2.2px;
      border-radius: 999px;
      background: currentColor;

      &:nth-child(1) {
        height: 5px;
        opacity: 0.52;
      }
      &:nth-child(2) {
        height: 7px;
        opacity: 0.68;
      }
      &:nth-child(3) {
        height: 9px;
        opacity: 0.84;
      }
      &:nth-child(4) {
        height: 10px;
      }
    }
  }

  &--wifi svg {
    width: 18px;
    height: 18px;
    margin-left: 8px;
  }

  &--battery {
    gap: 3px;
    font-size: 10px;
    font-weight: 700;

    svg {
      width: 21px;
      height: 11px;
    }
  }
}

.wechat-moments-preview__feed {
  background: #fff;
}

.moments-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  padding: 18px 14px 12px 14px;

  &__avatar {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 17px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--moments-avatar-start), var(--moments-avatar-end));
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  }

  &__body {
    min-width: 0;
  }

  &__name {
    color: #6c80b7;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.1;
  }

  &__text {
    margin: 8px 0 10px;
    font-size: 16px;
    line-height: 1.5;
    color: #1f1f1f;
  }

  &__media {
    width: 150px;
    height: 196px;
    border-radius: 3px;
    overflow: hidden;
    background: #e5e7eb;

    &--square {
      width: 150px;
      height: 150px;
    }
  }

  &__media-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__mock-photo {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(160deg, #d7d9de 0%, #f2f4f7 32%, #e7e5e4 100%);
  }

  &__mock-photo-cup {
    position: absolute;
    left: 24px;
    top: 26px;
    width: 72px;
    height: 88px;
    border-radius: 20px 20px 26px 26px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.85) 0 20%,
      rgba(194, 146, 99, 0.32) 20% 42%,
      rgba(172, 126, 86, 0.72) 42% 100%
    );
    transform: rotate(-12deg);
    box-shadow: 0 16px 30px rgba(120, 113, 108, 0.14);

    &::before {
      content: '';
      position: absolute;
      top: -10px;
      left: 8px;
      right: 8px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.8);
      border-radius: 999px;
    }
  }

  &__mock-photo-road {
    position: absolute;
    right: -12px;
    bottom: 16px;
    width: 120px;
    height: 56px;
    background:
      linear-gradient(150deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.12)),
      repeating-linear-gradient(115deg, transparent 0 18px, rgba(255, 255, 255, 0.92) 18px 28px);
    transform: rotate(-26deg);
    opacity: 0.88;
  }

  &__footer {
    margin-top: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__time {
    color: #b0b0b0;
    font-size: 11px;
  }

  &__menu {
    width: 34px;
    height: 22px;
    border: 0;
    border-radius: 5px;
    background: #f8f8f8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;

    i {
      width: 3px;
      height: 3px;
      border-radius: 999px;
      background: #6f7da8;
    }
  }
}
</style>
