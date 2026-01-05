<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import GridSkeleton from '@/components/wallpaper/GridSkeleton.vue'

import { useTheme } from '@/composables/useTheme'

// Theme
const { initTheme } = useTheme()

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

    <AppFooter />
  </div>
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
