<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import PageLoadingScene from '@/components/common/feedback/PageLoadingScene.vue'
import UpdateNotification from '@/components/common/feedback/UpdateNotification.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import GridLoadingState from '@/components/wallpaper/WallpaperGrid/shared/GridLoadingState.vue'
import { useVersionCheck } from '@/composables/useVersionCheck'
import { downloadChallenge } from '@/services/downloadVerification'

const DownloadVerificationDialog = defineAsyncComponent(() => import('@/components/wallpaper/DownloadVerificationDialog.vue'))

// Version check (启动版本检测)
useVersionCheck()

// Route
const route = useRoute()
const router = useRouter()
const navigationPending = ref(false)
let pendingDestination
const removeBeforeNavigation = router.beforeEach((to) => {
  pendingDestination = to
  navigationPending.value = !(to.meta.browseShell && route.meta.browseShell)
})
const removeAfterNavigation = router.afterEach((to) => {
  if (pendingDestination === to)
    navigationPending.value = false
})
const removeNavigationError = router.onError((_error, to) => {
  if (pendingDestination === to)
    navigationPending.value = false
})
onBeforeUnmount(() => {
  removeBeforeNavigation()
  removeAfterNavigation()
  removeNavigationError()
})

// 根据路由 meta 动态获取骨架屏宽高比
const skeletonAspectType = computed(() => route.meta?.aspectType || 'landscape')

// 是否隐藏导航栏（用于下载页等独立页面）
const hideHeader = computed(() => route.meta?.hideHeader === true)
const useSceneLoadingFallback = computed(() => route.meta?.loadingScene === true)
const loadingSceneTitle = computed(() => route.meta?.loadingTitle || '页面加载中')
const loadingSceneText = computed(() => route.meta?.loadingText || '请稍候...')
const compactMain = computed(() => route.meta?.compactMain === true)
</script>

<template>
  <ElConfigProvider :locale="zhCn">
    <div class="app" :class="{ 'compact-main': compactMain, 'no-header': hideHeader }">
      <AppHeader v-if="!hideHeader" />

      <Transition name="route-feedback">
        <div v-if="navigationPending" class="route-feedback" role="status" aria-live="polite">
          <LoadingSpinner size="sm" />
          <span>正在打开页面</span>
        </div>
      </Transition>

      <main class="main-content" :class="{ 'compact-page': compactMain, 'no-padding': hideHeader }">
        <RouterView v-slot="{ Component }">
          <Suspense v-if="Component">
            <template #default>
              <component :is="Component" />
            </template>
            <template #fallback>
              <div class="route-loading-fallback">
                <div class="container">
                  <PageLoadingScene
                    v-if="useSceneLoadingFallback"
                    :text="loadingSceneText"
                    :title="loadingSceneTitle"
                  />
                  <GridLoadingState
                    v-else
                    :skeleton-count="20"
                    :aspect-type="skeletonAspectType"
                    :aspect-ratio="skeletonAspectType === 'portrait' ? '9/16' : skeletonAspectType === 'square' ? '1/1' : '16/10'"
                  />
                </div>
              </div>
            </template>
          </Suspense>
        </RouterView>
      </main>

      <DownloadVerificationDialog v-if="downloadChallenge" :key="downloadChallenge.id" :challenge="downloadChallenge" />

      <!-- 版本更新提示 -->
      <UpdateNotification v-if="!hideHeader" />
    </div>
  </ElConfigProvider>
</template>

<style lang="scss">
@use '@/assets/styles/main.scss';
</style>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &.compact-main {
    min-height: auto;
  }

  &.no-header {
    min-height: 100vh;
    min-height: 100dvh;
  }
}

.main-content {
  flex: 1;
  padding-top: $header-height;

  &.compact-page {
    flex: 0 0 auto;
  }

  &.no-padding {
    padding-top: 0;
  }
}

.route-feedback {
  position: fixed;
  top: calc(#{$header-height} + 10px);
  left: 50%;
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  background: var(--color-bg-card);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
  font-size: 13px;
  transform: translateX(-50%);
  pointer-events: none;
}

.route-feedback-enter-active,
.route-feedback-leave-active {
  transition:
    opacity 160ms ease,
    translate 160ms ease;
}

.route-feedback-enter-from,
.route-feedback-leave-to {
  opacity: 0;
  translate: 0 -4px;
}

@media (prefers-reduced-motion: reduce) {
  .route-feedback-enter-from,
  .route-feedback-leave-to {
    translate: none;
  }
}
</style>
