<script setup>
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ElectronUpdateNotification from '@/components/common/feedback/ElectronUpdateNotification.vue'
import SplashScreen from '@/components/common/feedback/SplashScreen.vue'
import UpdateNotification from '@/components/common/feedback/UpdateNotification.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppTitleBar from '@/components/layout/AppTitleBar.vue'
import GridSkeleton from '@/components/wallpaper/WallpaperGrid/GridSkeleton.vue'
import { useElectron } from '@/composables/useElectron'

import { useTheme } from '@/composables/useTheme'
import { useVersionCheck } from '@/composables/useVersionCheck'
import 'element-plus/dist/index.css'

const { isElectron } = useElectron()

// 启动动画状态
const showSplash = ref(isElectron.value) // 只在 Electron 环境显示
const appReady = ref(false)

function handleSplashReady() {
  appReady.value = true
}

// Theme
const { initTheme } = useTheme()

// Version check (启动版本检测)
useVersionCheck()

// Route
const route = useRoute()

// 根据路由 meta 动态获取骨架屏宽高比
const skeletonAspectType = computed(() => route.meta?.aspectType || 'landscape')

// 是否隐藏导航栏（用于下载页等独立页面）
const hideHeader = computed(() => route.meta?.hideHeader === true)

// Initialize
onMounted(() => {
  initTheme()

  // Electron 环境下设置标题栏高度 CSS 变量
  if (isElectron.value) {
    document.documentElement.style.setProperty('--titlebar-height', '32px')
  }
})
</script>

<template>
  <ElConfigProvider :locale="zhCn">
    <!-- Electron 启动动画 -->
    <SplashScreen v-if="showSplash && !appReady" @ready="handleSplashReady" />

    <!-- Electron 自定义标题栏 -->
    <AppTitleBar v-if="isElectron" />

    <div v-show="!showSplash || appReady" class="app" :class="{ 'no-header': hideHeader, 'is-electron': isElectron }">
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

      <!-- 版本更新提示 -->
      <UpdateNotification v-if="!hideHeader && !isElectron" />
      <ElectronUpdateNotification v-if="!hideHeader && isElectron" />
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
  // 为标题栏留出空间（Web 端为 0，Electron 端为 32px）
  padding-top: var(--titlebar-height);

  &.no-header {
    min-height: 100vh;
    min-height: 100dvh;
  }
}

.main-content {
  flex: 1;
  padding-top: $header-height;

  &.no-padding {
    padding-top: 0;
  }
}
</style>
