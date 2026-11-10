<script setup>
import { ElMessage } from 'element-plus'
import { computed, toRef } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import WallpaperCard from '@/components/wallpaper/card/index.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import { useInteraction } from '@/composables/useInteraction'
import { useWallpaperDownload } from '@/composables/useWallpaperDownload'
import { createInteractionFeedback } from '@/utils/interaction/feedback'

const props = defineProps({ wallpaper: { type: Object, required: true }, index: { type: Number, default: 0 } })
const router = useRouter()
const route = useRoute()
const record = toRef(props, 'wallpaper')
const series = computed(() => props.wallpaper.series)
const aspectRatio = computed(() => props.wallpaper.resolution ? `${props.wallpaper.resolution.width}/${props.wallpaper.resolution.height}` : '16/10')
const { collected, isAuthenticated, liked, toggleCollect, toggleLike } = useInteraction(record, series)
const withFeedback = createInteractionFeedback({ router, getRedirect: () => route.fullPath, message: ElMessage })
const handleLike = withFeedback(toggleLike)
const handleCollect = withFeedback(toggleCollect)
const { downloading, handleDownload } = useWallpaperDownload(record, series)
</script>

<template>
  <article class="collection-wallpaper">
    <WallpaperCard :wallpaper="wallpaper" :index="index" :aspect-ratio="aspectRatio" @click="router.push(wallpaper.sharePath)" />
    <div class="collection-wallpaper__actions">
      <RouterLink :to="wallpaper.sharePath">
        查看详情
      </RouterLink>
      <button type="button" :disabled="downloading" @click="handleDownload">
        {{ downloading ? '下载中…' : wallpaper.series === 'mobile' ? '下载手机版' : '下载电脑版' }}
      </button>
      <WallpaperCardActions :liked="liked" :collected="collected" :is-authenticated="isAuthenticated" :show-counts="false" @toggle-like="handleLike" @toggle-collect="handleCollect" />
    </div>
    <p v-if="wallpaper.resolution" class="collection-wallpaper__source">
      {{ wallpaper.resolution.width }} × {{ wallpaper.resolution.height }} 像素
    </p>
    <p class="collection-wallpaper__source">
      作者：{{ wallpaper.author || '未提供' }} · 来源：{{ wallpaper.source || '未提供' }}
    </p>
    <p class="collection-wallpaper__source">
      授权：{{ wallpaper.license || '未提供，请自行确认使用权限' }}
    </p>
  </article>
</template>

<style scoped>
.collection-wallpaper {
  min-width: 0;
}
.collection-wallpaper__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 10px;
}
.collection-wallpaper__actions a,
.collection-wallpaper__actions button {
  min-height: 44px;
  align-content: center;
  color: var(--color-accent);
  font-size: 13px;
}
.collection-wallpaper__actions button {
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  padding: 6px 10px;
  background: var(--color-bg-card);
  cursor: pointer;
}
.collection-wallpaper__source {
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
  margin: 6px 0;
}
</style>
