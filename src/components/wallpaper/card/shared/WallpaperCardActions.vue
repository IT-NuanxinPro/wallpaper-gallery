<script setup>
import { computed, ref, useId, watch } from 'vue'
import { useMotionPreference } from '@/composables/useMotionPreference'
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
  likePending: { type: Boolean, default: false },
  collectPending: { type: Boolean, default: false },
  likeError: { type: String, default: '' },
  collectError: { type: String, default: '' },
})

const emit = defineEmits(['toggleLike', 'toggleCollect'])

const reducedMotion = useMotionPreference()
const feedbackId = useId()
const likeConfirmed = ref(false)
const collectConfirmed = ref(false)
const showCollectAction = computed(() => ['all', 'collect-only'].includes(props.actionMode))
const showLikeAction = computed(() => ['all', 'like-only'].includes(props.actionMode))

// 结果动效只跟随已完成的操作，不参与请求锁定，也不遮住状态和计数。
watch(() => props.likePending, (pending, wasPending) => {
  likeConfirmed.value = !pending && wasPending && !props.likeError && props.liked && !reducedMotion.value
})
watch(() => props.collectPending, (pending, wasPending) => {
  collectConfirmed.value = !pending && wasPending && !props.collectError && props.collected && !reducedMotion.value
})
watch(reducedMotion, () => {
  likeConfirmed.value = false
  collectConfirmed.value = false
})

function handleLike(e) {
  e.stopPropagation()
  if (props.likePending)
    return
  likeConfirmed.value = false
  emit('toggleLike')
}

function handleCollect(e) {
  e.stopPropagation()
  if (props.collectPending)
    return
  collectConfirmed.value = false
  emit('toggleCollect')
}
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
      :aria-busy="collectPending"
      :disabled="collectPending"
      :aria-describedby="collectError ? `${feedbackId}-collect` : undefined"
      :aria-label="collected ? '取消收藏' : '收藏壁纸'"
      :title="collected ? '取消收藏' : '收藏'"
      @click="handleCollect"
    >
      <span class="action-btn__content">
        <span
          class="action-btn__icon"
          :class="{ 'is-confirmed': collectConfirmed }"
          @animationend="collectConfirmed = false"
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
        <span v-if="!compact" class="action-btn__label">{{ collectPending ? (collected ? '正在收藏' : '正在取消') : collected ? '已收藏' : '收藏' }}</span>
      </span>
      <span v-if="showCounts && collectCount > 0" class="action-btn__count">{{ formatNumber(collectCount) }}</span>
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
      :aria-busy="likePending"
      :disabled="likePending"
      :aria-describedby="likeError ? `${feedbackId}-like` : undefined"
      :aria-label="liked ? '取消喜欢' : '喜欢壁纸'"
      :title="liked ? '取消喜欢' : '喜欢'"
      @click="handleLike"
    >
      <span class="action-btn__content">
        <span
          class="action-btn__icon"
          :class="{ 'is-confirmed': likeConfirmed }"
          @animationend="likeConfirmed = false"
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
        <span v-if="!compact" class="action-btn__label">{{ likePending ? (liked ? '正在喜欢' : '正在取消') : liked ? '已喜欢' : '喜欢' }}</span>
      </span>
      <span v-if="showCounts && likeCount > 0" class="action-btn__count">{{ formatNumber(likeCount) }}</span>
    </button>
    <p v-if="collectError && showCollectAction" :id="`${feedbackId}-collect`" class="action-feedback" role="status">
      <span>{{ collectError }}</span>
      <button type="button" :disabled="collectPending" aria-label="重试收藏" @click="handleCollect">
        重试
      </button>
    </p>
    <p v-if="likeError && showLikeAction" :id="`${feedbackId}-like`" class="action-feedback" role="status">
      <span>{{ likeError }}</span>
      <button type="button" :disabled="likePending" aria-label="重试喜欢" @click="handleLike">
        重试
      </button>
    </p>
  </div>
</template>

<style lang="scss" scoped>
.card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.action-feedback {
  display: flex;
  align-items: baseline;
  flex-basis: 100%;
  gap: 8px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;

  button {
    flex: none;
    min-height: 32px;
    padding: 2px 8px;
    color: var(--color-accent);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
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

  .action-btn__icon.is-confirmed {
    animation: action-confirmed 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
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

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.92));
    border-color: rgba(96, 165, 250, 0.24);
    color: #1e293b;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.86),
      0 14px 28px rgba(148, 163, 184, 0.16);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    cursor: progress;
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

@keyframes action-confirmed {
  0%,
  100% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.14);
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-btn,
  .action-btn .action-btn__icon,
  .action-btn svg {
    animation: none;
    transition: none;
  }
}
</style>
