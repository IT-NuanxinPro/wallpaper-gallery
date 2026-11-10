<script setup>
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import SoftLoading from '@/components/common/feedback/SoftLoading.vue'
import { useLoadingSurface } from '@/components/common/feedback/useLoadingSurface'
import { useDesktopWallpaper } from '@/composables/useDesktopWallpaper'
import { DESKTOP_CLIENT_URL } from '@/services/desktopWallpaperService'

const props = defineProps({
  wallpaper: { type: Object, default: null },
  visible: { type: Boolean, default: true },
  appearance: { type: String, default: 'page' },
})
const { phase, status, busy, error, initialize, eligibility, apply, restore } = useDesktopWallpaper({ visible: () => props.visible })
const eligibilityResult = computed(() => eligibility(props.wallpaper))
const operation = ref('')
const progressLabel = ref('正在设置壁纸')
const ownsOverlay = ref(false)
const progressElement = ref(null)
const loadingVisible = useLoadingSurface(() => Boolean(operation.value), 240)
const showProgress = computed(() => loadingVisible.value && ownsOverlay.value && props.visible)
let requestContext = 0
let disposed = false
let previousFocus

watch([() => props.visible, () => eligibilityResult.value.item?.assetKey], () => {
  // 关闭或切图不会取消原生操作，但迟到结果不再影响新的弹窗。
  requestContext += 1
  ownsOverlay.value = false
  operation.value = ''
}, { flush: 'sync' })

watch(showProgress, async (visible) => {
  if (visible) {
    previousFocus = document.activeElement
    await nextTick()
    if (showProgress.value)
      progressElement.value?.focus({ preventScroll: true })
  }
  else if (previousFocus?.isConnected) {
    previousFocus.focus({ preventScroll: true })
  }
})

onBeforeUnmount(() => {
  disposed = true
  requestContext += 1
  if (previousFocus?.isConnected)
    previousFocus.focus({ preventScroll: true })
})

async function runOperation(action) {
  if (busy.value || operation.value || !props.visible)
    return
  const context = ++requestContext
  operation.value = action
  ownsOverlay.value = true
  progressLabel.value = action === 'restore' ? '正在恢复壁纸' : '正在设置壁纸'
  const succeeded = await (action === 'restore' ? restore() : apply(props.wallpaper))
  if (disposed || context !== requestContext)
    return
  operation.value = ''
  if (succeeded)
    ElMessage.success(action === 'restore' ? '已恢复上一张壁纸' : '壁纸已设置')
  else
    ElMessage.error(error.value || '设置未完成，请重试')
}
</script>

<template>
  <section class="desktop-wallpaper-actions" :class="{ 'is-dark': appearance === 'dark' }" aria-label="原生桌面壁纸">
    <template v-if="phase === 'ready'">
      <button
        v-if="eligibilityResult.item"
        class="desktop-wallpaper-actions__apply"
        type="button"
        :disabled="busy"
        :aria-busy="Boolean(operation)"
        @click="runOperation('apply')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 21h8M12 16v5m-4-11 3 3 5-5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>设为桌面壁纸</span>
      </button>
      <p v-else class="desktop-wallpaper-actions__hint">
        {{ eligibilityResult.reason }}
      </p>
      <button v-if="status?.previous" class="desktop-wallpaper-actions__restore" type="button" :disabled="busy" @click="runOperation('restore')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -3)" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        恢复上一张
      </button>
    </template>
    <p v-else-if="phase === 'browser'" class="desktop-wallpaper-actions__hint">
      使用桌面客户端，可直接设置壁纸。
      <a :href="DESKTOP_CLIENT_URL" target="_blank" rel="noopener noreferrer">下载客户端</a>
    </p>
    <p v-else-if="phase === 'checking' || phase === 'idle'" class="desktop-wallpaper-actions__hint" role="status">
      正在检查客户端…
    </p>
    <template v-else>
      <p class="desktop-wallpaper-actions__hint" role="status">
        {{ error }}
      </p>
      <a v-if="phase === 'upgrade'" :href="DESKTOP_CLIENT_URL" target="_blank" rel="noopener noreferrer">升级桌面客户端</a>
      <button v-else class="desktop-wallpaper-actions__restore" type="button" @click="initialize(true)">
        重新检查客户端
      </button>
    </template>
  </section>

  <Teleport to="body">
    <Transition name="wallpaper-progress">
      <div
        v-if="showProgress"
        ref="progressElement"
        class="desktop-wallpaper-progress"
        :class="{ 'is-finishing': !operation }"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="progressLabel"
        :aria-busy="Boolean(operation)"
        @keydown.stop
        @keydown.tab.prevent
        @keydown.esc.stop.prevent
        @wheel.prevent
        @touchmove.prevent
      >
        <div class="desktop-wallpaper-progress__card">
          <SoftLoading :size="72" :label="progressLabel" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.desktop-wallpaper-actions {
  display: grid;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.desktop-wallpaper-actions.is-dark {
  --color-text-secondary: #b9c8e1;
  --color-accent: #93c5fd;
  --native-restore-bg: rgba(96, 165, 250, 0.08);
  --native-restore-border: rgba(147, 197, 253, 0.2);
}
.desktop-wallpaper-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  border-radius: 14px;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}
.desktop-wallpaper-actions__apply {
  min-height: 56px;
  padding: 16px 24px;
  background: var(--accent-gradient);
  border: 0;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 8px 24px var(--accent-shadow);
}
.desktop-wallpaper-actions__apply:hover:not(:disabled) {
  background: var(--accent-gradient-hover);
  box-shadow: 0 12px 28px var(--accent-shadow-strong);
  transform: translateY(-2px);
}
.desktop-wallpaper-actions__restore {
  min-height: 44px;
  padding: 8px 14px;
  background: var(--native-restore-bg, transparent);
  border: 1px solid var(--native-restore-border, var(--color-border));
  color: var(--color-accent);
  font-size: 13px;
}
.desktop-wallpaper-actions__restore:hover:not(:disabled) {
  background: var(--accent-ring);
}
.desktop-wallpaper-actions button:active:not(:disabled) {
  transform: translateY(0) scale(0.99);
}
.desktop-wallpaper-actions button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.desktop-wallpaper-actions svg {
  flex: none;
  width: 20px;
  height: 20px;
}
.desktop-wallpaper-actions__restore svg {
  width: 16px;
  height: 16px;
}
.desktop-wallpaper-actions a {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  color: var(--color-accent);
}
.desktop-wallpaper-actions :is(button, a):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
.desktop-wallpaper-actions__hint {
  margin: 0;
  color: inherit;
}
.desktop-wallpaper-progress {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 12, 26, 0.45);
  backdrop-filter: blur(5px);
  outline: none;
}
.desktop-wallpaper-progress__card {
  display: grid;
  place-items: center;
  min-width: 188px;
  min-height: 166px;
  padding: 28px 32px;
  border: 1px solid rgba(147, 197, 253, 0.2);
  border-radius: 24px;
  background: linear-gradient(145deg, #22334f, #15223a);
  box-shadow: 0 20px 60px rgba(2, 8, 23, 0.3);
  --color-text-secondary: #dbeafe;
}
.wallpaper-progress-enter-active,
.wallpaper-progress-leave-active {
  transition: opacity 180ms ease;
}
.wallpaper-progress-enter-active .desktop-wallpaper-progress__card,
.wallpaper-progress-leave-active .desktop-wallpaper-progress__card {
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.wallpaper-progress-enter-from,
.wallpaper-progress-leave-to {
  opacity: 0;
}
.wallpaper-progress-enter-from .desktop-wallpaper-progress__card,
.wallpaper-progress-leave-to .desktop-wallpaper-progress__card {
  transform: translateY(6px) scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .desktop-wallpaper-actions button,
  .wallpaper-progress-enter-active,
  .wallpaper-progress-leave-active,
  .wallpaper-progress-enter-active .desktop-wallpaper-progress__card,
  .wallpaper-progress-leave-active .desktop-wallpaper-progress__card {
    transition: none;
  }
}
</style>
