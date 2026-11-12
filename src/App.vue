<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import UpdateNotification from '@/components/common/feedback/UpdateNotification.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import GridLoadingState from '@/components/wallpaper/WallpaperGrid/shared/GridLoadingState.vue'
import WallpaperMediaTransition from '@/components/wallpaper/WallpaperMediaTransition.vue'
import { useOnlinePresence } from '@/composables/useOnlinePresence'
import { useVersionCheck } from '@/composables/useVersionCheck'
import { downloadChallenge } from '@/services/downloadVerification'

const DownloadVerificationDialog = defineAsyncComponent(() => import('@/components/wallpaper/DownloadVerificationDialog.vue'))

// Version check (启动版本检测)
useVersionCheck()
useOnlinePresence()

// Route
const route = useRoute()

// 根据路由 meta 动态获取骨架屏宽高比
const skeletonAspectType = computed(() => route.meta?.aspectType || 'landscape')

// 是否隐藏导航栏（用于下载页等独立页面）
const hideHeader = computed(() => route.meta?.hideHeader === true)
const compactMain = computed(() => route.meta?.compactMain === true)
</script>

<template>
  <ElConfigProvider :locale="zhCn">
    <div class="app" :class="{ 'compact-main': compactMain, 'no-header': hideHeader }">
      <AppHeader v-if="!hideHeader" />

      <main class="main-content" :class="{ 'compact-page': compactMain, 'no-padding': hideHeader }">
        <RouterView v-slot="{ Component }">
          <Suspense v-if="Component">
            <template #default>
              <KeepAlive include="BrowseLayout" :max="1">
                <component :is="Component" />
              </KeepAlive>
            </template>
            <template #fallback>
              <div class="route-loading-fallback">
                <div class="container">
                  <GridLoadingState
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
      <WallpaperMediaTransition />

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
</style>
