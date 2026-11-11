<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AnnouncementBanner from '@/components/common/feedback/AnnouncementBanner.vue'
import LoadingSurface from '@/components/common/feedback/LoadingSurface.vue'
import BrowseIntroduction from '@/components/home/BrowseIntroduction.vue'
import HotTagsPanel from '@/components/home/HotTagsPanel.vue'
import { useDevice } from '@/composables/useDevice'
import { useFilterStore } from '@/stores/filter'
import { useHotTagsStore } from '@/stores/hotTags'
import { useWallpaperStore } from '@/stores/wallpaper'
import { buildHotTagQuery } from '@/utils/filter/hotTagQuery'

const route = useRoute()
const router = useRouter()
const { isMobile } = useDevice()
const filterStore = useFilterStore()
const hotTagsStore = useHotTagsStore()
const wallpaperStore = useWallpaperStore()
const currentSeries = computed(() => route.meta.series || 'desktop')
const categories = computed(() => wallpaperStore.getSeriesCategories(currentSeries.value).map(item => ({
  value: item.id || item.name,
  label: filterStore.getCategoryLabel(item.id || item.name),
  subcategories: item.subcategories || [],
})))
const categoryNames = computed(() => new Set(categories.value.flatMap(item => [item.value, item.label, ...item.subcategories.map(child => child.name)])))
const tags = computed(() => {
  const available = hotTagsStore.currentSeries === currentSeries.value ? hotTagsStore.tags : []
  return {
    categoryTags: available.filter(tag => categoryNames.value.has(tag.tag)).slice(0, 6),
    keywordTags: available.filter(tag => !categoryNames.value.has(tag.tag)).slice(0, 8),
    loading: hotTagsStore.loading,
    activeTag: route.query.q || route.query.subcategory || route.query.category || '',
    visible: currentSeries.value !== 'video',
  }
})
async function handleTag(tag) {
  if (!tag?.tag)
    return
  const sourceRoute = route.fullPath
  const query = buildHotTagQuery(tag, currentSeries.value, categories.value)
  if (currentSeries.value === 'bing' && !query.exact && query.q) {
    const years = [...new Set((tag.topWallpapers || []).map(file => Number(String(file).match(/bing-(\d{4})-/)?.[1])).filter(Boolean))]
    await Promise.allSettled(years.map(year => wallpaperStore.loadBingYear(year)))
  }
  if (route.fullPath === sourceRoute)
    void router.push({ path: route.path, query: { ...route.query, ...query } })
}
</script>

<template>
  <div class="browse-layout">
    <div class="container">
      <div class="browse-fixed-region">
        <AnnouncementBanner />
        <BrowseIntroduction :path="route.path" />
        <div v-show="tags.visible" class="browse-hot-tags">
          <HotTagsPanel
            :is-mobile="isMobile"
            :category-tags="tags.categoryTags"
            :keyword-tags="tags.keywordTags"
            :loading="tags.loading"
            :active-tag="tags.activeTag"
            :current-series="currentSeries"
            persistent
            @select="handleTag"
          />
        </div>
      </div>
      <div class="browse-route-region">
        <RouterView v-slot="{ Component }">
          <Suspense v-if="Component">
            <component :is="Component" />
            <template #fallback>
              <LoadingSurface class="browse-route-loading" busy label="正在加载内容" />
            </template>
          </Suspense>
        </RouterView>
      </div>
    </div>
  </div>
</template>

<style scoped>
.browse-layout {
  padding: 16px 0 48px;
}
.browse-hot-tags {
  min-height: 66px;
}
.browse-route-region,
.browse-route-loading {
  min-height: 60vh;
  overflow-anchor: none;
}
@media (max-width: 767px) {
  .browse-layout {
    padding-top: 68px;
  }
  .browse-hot-tags {
    min-height: 94px;
  }
}
</style>
