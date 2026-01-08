<script setup>
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import UpdateNotification from '@/components/common/feedback/UpdateNotification.vue'
import PWAInstallPrompt from '@/components/common/ui/PWAInstallPrompt.vue'
// import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import GridSkeleton from '@/components/wallpaper/WallpaperGrid/GridSkeleton.vue'

import { useTheme } from '@/composables/useTheme'
import { useVersionCheck } from '@/composables/useVersionCheck'

// Theme
const { initTheme } = useTheme()

// Version check (启动版本检测)
useVersionCheck()

// Route
const route = useRoute()

// 根据路由 meta 动态获取骨架屏宽高比
const skeletonAspectType = computed(() => route.meta?.aspectType || 'landscape')

// Initialize
onMounted(() => {
  initTheme()
})
</script>

<template>
  <ElConfigProvider :locale="zhCn">
    <div class="app">
      <AppHeader />

      <main class="main-content">
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
      <UpdateNotification />

      <!-- PWA 安装提示 -->
      <PWAInstallPrompt />
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
}

.main-content {
  flex: 1;
  padding-top: $header-height;
}
</style>
