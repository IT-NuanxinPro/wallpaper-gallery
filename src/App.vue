<script setup>
import { Capacitor } from '@capacitor/core'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import UpdateNotification from '@/components/common/feedback/UpdateNotification.vue'
import PWAInstallPrompt from '@/components/common/ui/PWAInstallPrompt.vue'
// import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import GridSkeleton from '@/components/wallpaper/WallpaperGrid/GridSkeleton.vue'

import { useTheme } from '@/composables/useTheme'
import { useVersionCheck } from '@/composables/useVersionCheck'

// 动态导入 Splash 组件（仅原生环境）
const AppSplash = Capacitor.isNativePlatform()
  ? defineAsyncComponent(() => import('@/components/common/ui/AppSplash.vue'))
  : null

// Theme
const { initTheme } = useTheme()

// Version check (启动版本检测)
useVersionCheck()

// Route
const route = useRoute()

// Splash 状态
const showSplash = ref(Capacitor.isNativePlatform())

// 根据路由 meta 动态获取骨架屏宽高比
const skeletonAspectType = computed(() => route.meta?.aspectType || 'landscape')

// 是否隐藏导航栏
const hideHeader = computed(() => route.meta?.hideHeader === true)

// Splash 完成
function onSplashComplete() {
  showSplash.value = false
}

// Initialize
onMounted(() => {
  initTheme()
})
</script>

<template>
  <ElConfigProvider :locale="zhCn">
    <!-- App 欢迎页（仅原生环境） -->
    <AppSplash v-if="AppSplash && showSplash" @complete="onSplashComplete" />

    <div class="app" :class="{ 'no-header': hideHeader }">
      <AppHeader v-if="!hideHeader" />

      <main class="main-content" :class="{ 'no-padding': hideHeader }">
        <RouterView v-slot="{ Component }">
          <Suspense v-if="Component">
            <template #default>
              <component :is="Component" />
            </template>
            <template #fallback>
              <div class="home-page">
                <div class="container">
                  <GridSkeleton :count="12" :aspect-type="skeletonAspectType" />
                </div>
              </div>
            </template>
          </Suspense>
        </RouterView>
      </main>

      <!-- <AppFooter /> -->

      <!-- 版本更新提示 -->
      <UpdateNotification v-if="!hideHeader" />

      <!-- PWA 安装提示 -->
      <PWAInstallPrompt v-if="!hideHeader" />
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

  &.no-header {
    min-height: 100vh;
  }
}

.main-content {
  flex: 1;
  padding-top: calc(var(--header-height) + env(safe-area-inset-top, 0px));

  &.no-padding {
    padding-top: 0;
  }
}
</style>
