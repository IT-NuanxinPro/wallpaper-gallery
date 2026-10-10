<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue'
import { formatNumber } from '@/utils/common/format'

const props = defineProps({
  liked: {
    type: Boolean,
    default: false,
  },
  collected: {
    type: Boolean,
    default: false,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  collectCount: {
    type: Number,
    default: 0,
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  showCounts: {
    type: Boolean,
    default: true,
  },
  actionMode: {
    type: String,
    default: 'all',
  },
})

const emit = defineEmits(['toggleLike', 'toggleCollect'])

const LottieScene = defineAsyncComponent(() => import('@/components/common/ui/LottieScene.vue'))

const likeAnimating = ref(false)
const collectAnimating = ref(false)
const likeSettling = ref(false)
const collectSettling = ref(false)
const showCollectAction = computed(() => ['all', 'collect-only'].includes(props.actionMode))
const showLikeAction = computed(() => ['all', 'like-only'].includes(props.actionMode))

const likeAnimationSrc = `${import.meta.env.BASE_URL}lottie/like.lottie`
const collectAnimationSrc = `${import.meta.env.BASE_URL}lottie/star.lottie`

let likeAnimationTimer = null
let collectAnimationTimer = null
let likeRevealTimer = null
let collectRevealTimer = null

const LIKE_ANIMATION_DURATION = 1080
const COLLECT_ANIMATION_DURATION = 1520
const LIKE_REVEAL_DELAY = 680
const COLLECT_REVEAL_DELAY = 980

function clearLikeAnimationTimer() {
  if (likeAnimationTimer) {
    clearTimeout(likeAnimationTimer)
    likeAnimationTimer = null
  }
}

function clearCollectAnimationTimer() {
  if (collectAnimationTimer) {
    clearTimeout(collectAnimationTimer)
    collectAnimationTimer = null
  }
}

function clearLikeRevealTimer() {
  if (likeRevealTimer) {
    clearTimeout(likeRevealTimer)
    likeRevealTimer = null
  }
}

function clearCollectRevealTimer() {
  if (collectRevealTimer) {
    clearTimeout(collectRevealTimer)
    collectRevealTimer = null
  }
}

function triggerLikeAnimation() {
  clearLikeAnimationTimer()
  clearLikeRevealTimer()
  likeAnimating.value = true
  likeSettling.value = false
  likeRevealTimer = setTimeout(() => {
    likeSettling.value = true
    likeRevealTimer = null
  }, LIKE_REVEAL_DELAY)
  likeAnimationTimer = setTimeout(() => {
    likeAnimating.value = false
    likeSettling.value = false
    likeAnimationTimer = null
  }, LIKE_ANIMATION_DURATION)
}

function triggerCollectAnimation() {
  clearCollectAnimationTimer()
  clearCollectRevealTimer()
  collectAnimating.value = true
  collectSettling.value = false
  collectRevealTimer = setTimeout(() => {
    collectSettling.value = true
    collectRevealTimer = null
  }, COLLECT_REVEAL_DELAY)
  collectAnimationTimer = setTimeout(() => {
    collectAnimating.value = false
    collectSettling.value = false
    collectAnimationTimer = null
  }, COLLECT_ANIMATION_DURATION)
}

function handleLike(e) {
  e.stopPropagation()
  if (likeAnimating.value)
    return

  if (!props.isAuthenticated) {
    emit('toggleLike')
    return
  }

  if (!props.liked) {
    triggerLikeAnimation()
  }
  emit('toggleLike')
}

function handleCollect(e) {
  e.stopPropagation()
  if (collectAnimating.value)
    return

  if (!props.isAuthenticated) {
    emit('toggleCollect')
    return
  }

  if (!props.collected) {
    triggerCollectAnimation()
  }
  emit('toggleCollect')
}

onBeforeUnmount(() => {
  clearLikeAnimationTimer()
  clearCollectAnimationTimer()
  clearLikeRevealTimer()
  clearCollectRevealTimer()
})
</script>

<template>
  <div
    v-if="showCollectAction || showLikeAction"
    class="card-actions"
    :class="{ 'card-actions--compact': compact }"
  >
    <button
      v-if="showCollectAction"
      class="action-btn action-btn--collect"
      :class="{
        'is-active': collected,
        'is-unauth': !isAuthenticated,
        'has-count': showCounts && collectCount > 0,
      }"
      type="button"
      :aria-pressed="collected"
      :aria-label="collected ? '取消收藏' : '收藏壁纸'"
      :title="collected ? '取消收藏' : '收藏'"
      @click="handleCollect"
    >
      <span class="action-btn__content">
        <span
          class="action-btn__icon"
          :class="{
            'is-hidden': collectAnimating && !collectSettling,
            'is-settling': collectAnimating && collectSettling,
          }"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="12 2.75 15.02 8.87 21.77 9.85 16.89 14.61 18.04 21.33 12 18.16 5.96 21.33 7.11 14.61 2.23 9.85 8.98 8.87 12 2.75" />
          </svg>
        </span>
        <span v-if="!compact" class="action-btn__label">{{ collected ? '已收藏' : '收藏' }}</span>
      </span>
      <span v-if="showCounts && collectCount > 0 && !collectAnimating" class="action-btn__count">{{ formatNumber(collectCount) }}</span>
      <span v-if="collectAnimating" class="action-btn__lottie action-btn__lottie--collect">
        <LottieScene
          :src="collectAnimationSrc"
          :loop="false"
          :pause-when-hidden="false"
          :speed="0.92"
          fit="contain"
        />
      </span>
    </button>

    <button
      v-if="showLikeAction"
      class="action-btn action-btn--like"
      :class="{
        'is-active': liked,
        'is-unauth': !isAuthenticated,
        'has-count': showCounts && likeCount > 0,
      }"
      type="button"
      :aria-pressed="liked"
      :aria-label="liked ? '取消喜欢' : '喜欢壁纸'"
      :title="liked ? '取消喜欢' : '喜欢'"
      @click="handleLike"
    >
      <span class="action-btn__content">
        <span
          class="action-btn__icon"
          :class="{
            'is-hidden': likeAnimating && !likeSettling,
            'is-settling': likeAnimating && likeSettling,
          }"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m12 20.4-1.29-1.17C5.73 14.72 2.5 11.79 2.5 8.5a5 5 0 0 1 5-5c1.74 0 3.41.82 4.5 2.12a5.95 5.95 0 0 1 4.5-2.12 5 5 0 0 1 5 5c0 3.29-3.23 6.22-8.21 10.73L12 20.4z" />
          </svg>
        </span>
        <span v-if="!compact" class="action-btn__label">{{ liked ? '已喜欢' : '喜欢' }}</span>
      </span>
      <span v-if="showCounts && likeCount > 0 && !likeAnimating" class="action-btn__count">{{ formatNumber(likeCount) }}</span>
      <span v-if="likeAnimating" class="action-btn__lottie action-btn__lottie--like">
        <LottieScene
          :src="likeAnimationSrc"
          :loop="false"
          :pause-when-hidden="false"
          :speed="0.94"
          fit="contain"
        />
      </span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  min-width: 118px;
  height: 44px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  cursor: pointer;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(241, 245, 249, 0.88));
  color: #475569;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 10px 22px rgba(148, 163, 184, 0.12);
  transition:
    transform 180ms ease,
    background 200ms ease,
    border-color 200ms ease,
    color 200ms ease,
    box-shadow 200ms ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.44), transparent 60%);
    pointer-events: none;
  }

  .action-btn__content {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  .action-btn__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    transition:
      opacity 220ms ease,
      transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
      filter 220ms ease;
  }

  .action-btn__icon.is-hidden {
    opacity: 0;
    transform: scale(0.82);
  }

  .action-btn__icon.is-settling {
    opacity: 0.92;
    transform: scale(1.04);
    filter: saturate(1.08);
  }

  .action-btn__label {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  svg {
    width: 16px;
    height: 16px;
    transition: transform 200ms ease;
  }

  .action-btn__lottie {
    position: absolute;
    inset: -14px;
    z-index: 2;
    pointer-events: none;
    transform: scale(1.34);
    transform-origin: center;
    filter: drop-shadow(0 10px 20px rgba(15, 23, 42, 0.18));
  }

  .action-btn__count {
    position: relative;
    z-index: 1;
    min-width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  &:hover {
    transform: translateY(-1px);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.92));
    border-color: rgba(96, 165, 250, 0.24);
    color: #1e293b;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.86),
      0 14px 28px rgba(148, 163, 184, 0.16);
  }

  &:active {
    transform: scale(0.98);
  }

  &.is-unauth:active {
    animation: shake 400ms ease;
  }

  &--collect.is-active {
    color: #d97706;
    background: linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(255, 247, 237, 0.92));
    border-color: rgba(245, 158, 11, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.84),
      0 14px 28px rgba(245, 158, 11, 0.12);

    &:hover {
      background: linear-gradient(180deg, rgba(255, 247, 237, 0.98), rgba(255, 237, 213, 0.94));
      color: #b45309;
    }

    .action-btn__count {
      background: rgba(255, 255, 255, 0.82);
      color: #b45309;
    }
  }

  &--like.is-active {
    color: #e11d48;
    background: linear-gradient(180deg, rgba(255, 241, 242, 0.98), rgba(255, 228, 230, 0.92));
    border-color: rgba(244, 63, 94, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.84),
      0 14px 28px rgba(244, 63, 94, 0.12);

    &:hover {
      background: linear-gradient(180deg, rgba(255, 228, 230, 0.98), rgba(255, 205, 215, 0.94));
      color: #be123c;
    }

    .action-btn__count {
      background: rgba(255, 255, 255, 0.82);
      color: #be123c;
    }
  }
}

.card-actions--compact .action-btn {
  min-width: 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 999px;
  justify-content: center;
  overflow: visible;
  background: transparent;
  color: rgba(226, 232, 240, 0.7);
  box-shadow: none;

  &::before {
    display: none;
  }

  &.has-count {
    width: auto;
    min-width: 44px;
    padding: 0 10px 0 0;
  }

  svg {
    width: 24px;
    height: 24px;
    fill: transparent;
    stroke: currentColor;
    transition:
      fill 180ms ease,
      stroke 180ms ease,
      transform 180ms ease;
  }

  .action-btn__label {
    display: none;
  }

  .action-btn__content {
    gap: 0;
  }

  .action-btn__icon {
    width: 24px;
    height: 24px;
  }

  .action-btn__count {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    margin-left: 8px;
    font-size: 10px;
    background: rgba(15, 23, 42, 0.72);
    color: rgba(255, 255, 255, 0.92);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .action-btn__lottie {
    inset: -28px;
    transform: scale(1.82);
  }

  &:hover {
    background: transparent;
    color: rgba(248, 250, 252, 0.96);
    box-shadow: none;
  }
}

.card-actions--compact .action-btn.action-btn--collect.is-active {
  background: transparent;
  color: #f4c845;
  box-shadow: none;
  filter: drop-shadow(0 0 10px rgba(244, 200, 69, 0.18));

  .action-btn__icon svg {
    fill: currentColor;
    stroke: currentColor;
    transform: scale(1.04);
  }

  &:hover {
    background: transparent;
    color: #f4c845;
  }

  .action-btn__count {
    background: rgba(244, 200, 69, 0.16);
    color: #f4c845;
  }
}

.card-actions--compact .action-btn.action-btn--like.is-active {
  background: transparent;
  color: #eb474c;
  box-shadow: none;
  filter: drop-shadow(0 0 10px rgba(235, 71, 76, 0.18));

  .action-btn__icon svg {
    fill: currentColor;
    stroke: currentColor;
    transform: scale(1.04);
  }

  &:hover {
    background: transparent;
    color: #eb474c;
  }

  .action-btn__count {
    background: rgba(235, 71, 76, 0.16);
    color: #eb474c;
  }
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-3px);
  }
  40% {
    transform: translateX(3px);
  }
  60% {
    transform: translateX(-2px);
  }
  80% {
    transform: translateX(2px);
  }
}
</style>
