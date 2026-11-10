<script setup>
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useCollectionsContent } from '@/composables/useCollectionsContent'
import { WALLPAPER_COLLECTIONS } from '@/content/collections'
import { applyWallpaperDetailSeo } from '@/utils/seo/wallpaperDetail'
import { resolveWallpaperCollection } from '@/utils/wallpaper/collections'

const { records, loading, failedKeys, reload } = useCollectionsContent()
const collections = computed(() => WALLPAPER_COLLECTIONS.map(collection => resolveWallpaperCollection(collection, records.value)))
watch(collections, (items) => {
  const cover = items.find(collection => collection.cover)?.cover
  if (cover)
    applyWallpaperDetailSeo({ title: '精选专题', description: '静夜、山间与海岸：人工挑选的主题壁纸与电脑手机搭配。', thumbnailUrl: cover.thumbnailUrl, sharePath: '/collections' })
})
</script>

<template>
  <article class="collections-page" :data-collection-ready="loading ? 'loading' : failedKeys.length ? 'error' : 'ready'">
    <header class="collections-heading">
      <h1>精选专题</h1>
      <p>围绕夜色、山间与海岸挑选，也为电脑和手机找一组主题搭配。</p>
    </header>
    <p v-if="loading" role="status">
      正在准备专题图片…
    </p>
    <p v-if="failedKeys.length" role="status">
      部分图片暂时无法加载。<button type="button" @click="reload">
        重新加载
      </button>
    </p>
    <div v-if="!loading" class="collections-list">
      <section v-for="collection in collections" :key="collection.slug" class="collection-entry">
        <RouterLink v-if="collection.cover" :to="`/collections/${collection.slug}`" class="collection-cover">
          <img :src="collection.cover.previewUrl || collection.cover.thumbnailUrl" :alt="collection.cover.title" decoding="async">
        </RouterLink>
        <div class="collection-entry__copy">
          <h2>
            <RouterLink :to="`/collections/${collection.slug}`">
              {{ collection.title }}
            </RouterLink>
          </h2>
          <p>{{ collection.description }}</p>
          <p>{{ collection.items.length }} 张有效壁纸 · {{ collection.pairs.length }} 组主题搭配</p>
          <RouterLink :to="`/collections/${collection.slug}`">
            查看专题
          </RouterLink>
          <p v-if="!collection.items.length">
            当前专题暂无可用图片，可稍后重试或返回其他专题。
          </p>
        </div>
      </section>
    </div>
    <p class="collections-note">
      配套按主题和构图人工挑选，不表示来自同一作者或同一原作；授权以各图片已提供信息为准。
    </p>
  </article>
</template>

<style scoped>
.collections-page {
  max-width: 1240px;
  margin: 0 auto;
  padding: 32px 20px 64px;
  color: var(--color-text-primary);
}
.collections-heading {
  margin-bottom: 32px;
}
h1 {
  font-size: clamp(30px, 4vw, 46px);
  margin: 0 0 12px;
}
p {
  color: var(--color-text-secondary);
  line-height: 1.8;
}
a,
button {
  color: var(--color-accent);
}
.collections-list {
  display: grid;
  gap: 40px;
}
.collection-entry {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(240px, 1fr);
  gap: 28px;
  align-items: center;
}
.collection-cover img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
  border-radius: 14px;
}
.collection-entry h2 {
  margin: 0 0 12px;
  font-size: 28px;
}
.collection-entry h2 a {
  color: inherit;
}
.collection-entry__copy > a {
  display: inline-block;
  min-height: 44px;
  align-content: center;
}
.collections-note {
  margin-top: 40px;
  font-size: 13px;
}
@media (max-width: 767px) {
  .collection-entry {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
