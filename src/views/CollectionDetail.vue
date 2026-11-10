<script setup>
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CollectionWallpaperCard from '@/components/collections/CollectionWallpaperCard.vue'
import { useCollectionsContent } from '@/composables/useCollectionsContent'
import { WALLPAPER_COLLECTIONS } from '@/content/collections'
import { copyText } from '@/utils/common/clipboard'
import { getCollectionRelatedWallpapers, resolveWallpaperCollection } from '@/utils/wallpaper/collections'
import { WALLPAPER_SITE_ORIGIN } from '@/utils/wallpaper/share'

const route = useRoute()
const { records, loading, failedKeys, reload } = useCollectionsContent()
const definition = computed(() => WALLPAPER_COLLECTIONS.find(collection => collection.slug === route.params.slug))
const collection = computed(() => definition.value ? resolveWallpaperCollection(definition.value, records.value) : null)
const visibleItems = computed(() => collection.value ? collection.value.items : [])
const related = computed(() => getCollectionRelatedWallpapers(collection.value, records.value))

async function copyLink() {
  try {
    await copyText(`${WALLPAPER_SITE_ORIGIN}/collections/${collection.value.slug}`)
    ElMessage.success('专题链接已复制')
  }
  catch { ElMessage.error('复制失败，请复制浏览器地址') }
}
</script>

<template>
  <article class="collection-detail" :data-collection-ready="loading ? 'loading' : failedKeys.length ? 'error' : 'ready'">
    <RouterLink to="/collections" class="collection-back">
      返回精选专题
    </RouterLink>
    <section v-if="!definition" role="status">
      <h1>专题不存在</h1><p>可以返回专题列表继续挑选。</p>
    </section>
    <template v-else>
      <header class="collection-heading">
        <h1>{{ definition.title }}</h1><p>{{ definition.description }}</p>
        <div class="collection-tools">
          <button type="button" @click="copyLink">
            复制专题链接
          </button>
        </div>
      </header>
      <p v-if="loading" role="status">
        正在加载专题图片…
      </p>
      <p v-if="failedKeys.length" role="status">
        部分图片暂时无法加载。<button type="button" @click="reload">
          重新加载
        </button>
      </p>
      <template v-if="!loading && collection">
        <p class="source-notes">
          {{ collection.sourceNotes }}
        </p>
        <p v-if="collection.missingKeys.length && !failedKeys.length" role="status">
          {{ collection.missingKeys.length }} 张原清单图片已不可用，当前仅显示有效内容。
        </p>
        <section v-if="collection.pairs.length" class="collection-pairs">
          <h2>电脑与手机的主题搭配</h2>
          <div v-for="(pair, index) in collection.pairs" :key="pair.desktop.assetKey" class="collection-pair">
            <CollectionWallpaperCard :wallpaper="pair.desktop" :index="index * 2" />
            <CollectionWallpaperCard :wallpaper="pair.mobile" :index="index * 2 + 1" />
          </div>
        </section>
        <section>
          <h2>专题壁纸 <span>({{ visibleItems.length }})</span></h2>
          <div v-if="visibleItems.length" class="collection-grid">
            <CollectionWallpaperCard v-for="(item, index) in visibleItems" :key="item.assetKey" :wallpaper="item" :index="index" />
          </div>
          <div v-else class="collection-empty" role="status">
            <p>专题图片暂不可用。</p>
            <button type="button" @click="reload">
              重新加载
            </button>
          </div>
        </section>
        <section v-if="related.length" class="collection-related">
          <h2>同风格继续看</h2>
          <div class="collection-related-grid">
            <RouterLink v-for="item in related" :key="item.assetKey" :to="item.sharePath">
              <img :src="item.thumbnailUrl" :alt="item.title" loading="lazy"><span>{{ item.title }}</span>
            </RouterLink>
          </div>
        </section>
      </template>
    </template>
  </article>
</template>

<style scoped>
.collection-detail {
  max-width: 1240px;
  margin: 0 auto;
  padding: 28px 20px 64px;
  color: var(--color-text-primary);
}
.collection-back {
  display: inline-block;
  padding: 10px 0;
  margin-bottom: 20px;
  color: var(--color-accent);
}
h1 {
  font-size: clamp(30px, 4vw, 46px);
  margin: 0 0 12px;
}
h2 {
  font-size: 24px;
  margin: 32px 0 18px;
}
h2 span {
  color: var(--color-text-secondary);
  font-size: 16px;
}
p {
  line-height: 1.8;
  color: var(--color-text-secondary);
}
.collection-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 14px;
  margin: 20px 0;
}
button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--accent-border);
  background: var(--color-bg-card);
  border-radius: 8px;
  color: var(--color-accent);
  cursor: pointer;
}
.source-notes {
  font-size: 13px;
  max-width: 760px;
}
.collection-pair {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(180px, 1fr);
  gap: 24px;
  align-items: start;
  margin-bottom: 32px;
}
.collection-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  align-items: start;
}
.collection-related-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.collection-related-grid img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 10px;
}
.collection-related-grid a {
  color: inherit;
}
.collection-related-grid span {
  display: block;
  padding: 8px 0;
}
.collection-empty {
  padding: 24px 0;
}
@media (max-width: 767px) {
  .collection-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .collection-pair {
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 14px;
  }
  .collection-related-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 420px) {
  .collection-grid {
    grid-template-columns: 1fr;
  }
  .collection-pair {
    grid-template-columns: 1fr;
  }
}
</style>
