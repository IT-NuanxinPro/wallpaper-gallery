<script setup>
import { ElMessage } from 'element-plus'
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import WallpaperDesktopActions from '@/components/wallpaper/desktop/WallpaperDesktopActions.vue'
import WallpaperImageStage from '@/components/wallpaper/shared/WallpaperImageStage.vue'
import { useImageFallback } from '@/composables/useImageFallback'
import { useInteraction } from '@/composables/useInteraction'
import { useInteractionPrefetch } from '@/composables/useInteractionPrefetch'
import { isCurrentMediaEvent, usePreviewTracking } from '@/composables/usePreviewTracking'
import { useWallpaperDownload } from '@/composables/useWallpaperDownload'
import { createWallpaperDetailLoader, loadWallpaperCatalog } from '@/services/wallpaperDetailService'
import { copyText } from '@/utils/common/clipboard'
import { formatFileSize } from '@/utils/common/format'
import { createInteractionFeedback } from '@/utils/interaction/feedback'
import { applyWallpaperDetailSeo } from '@/utils/seo/wallpaperDetail'
import { getRelatedWallpapers, isTrustedWallpaperDetailUrl } from '@/utils/wallpaper/detailRecords'
import { buildWallpaperShareUrl } from '@/utils/wallpaper/share'

const ImageCropModal = defineAsyncComponent(() => import('@/components/wallpaper/crop/index.vue'))
const route = useRoute()
const router = useRouter()
const record = ref(null)
const loading = ref(true)
const failure = ref(null)
const ready = ref(false)
const cropOpen = ref(false)
const catalog = ref([])
const mediaFailed = ref(false)
let catalogController
const series = computed(() => record.value?._series || '')
const primarySource = computed(() => record.value?.mediaType === 'video' ? record.value?.thumbnailUrl : record.value?.previewUrl || '')
const { displayUrl, advance, reset } = useImageFallback(primarySource)
const { liked, collected, isAuthenticated, toggleLike, toggleCollect } = useInteraction(record, series)
const withFeedback = createInteractionFeedback({ router, getRedirect: () => route.fullPath, message: ElMessage })
const handleLike = withFeedback(toggleLike)
const handleCollect = withFeedback(toggleCollect)
const { downloading, handleDownload, cancelDownload } = useWallpaperDownload(record, series)
useInteractionPrefetch(() => record.value ? [record.value] : [])
const related = computed(() => record.value ? getRelatedWallpapers(record.value, catalog.value).filter(item => isTrustedWallpaperDetailUrl(item.thumbnailUrl)) : [])
const dimensionLabel = computed(() => record.value?.resolution ? `${record.value.resolution.width} × ${record.value.resolution.height}` : '尺寸信息未提供')
const loader = createWallpaperDetailLoader({
  onState(state) {
    loading.value = state.loading
    record.value = state.record
    failure.value = state.error
    ready.value = false
    mediaFailed.value = false
    cropOpen.value = false
    catalogController?.abort()
    catalog.value = []
    if (state.record) {
      applyWallpaperDetailSeo(state.record)
      catalogController = new AbortController()
      loadWallpaperCatalog({ series: state.record._series, signal: catalogController.signal }).then((items) => {
        if (record.value?.assetKey === state.record.assetKey)
          catalog.value = items
      }).catch(() => {})
    }
    else if (state.error) {
      document.title = state.error.status === 404 ? '壁纸不存在 - Wallpaper Gallery' : '详情加载失败 - Wallpaper Gallery'
      let robots = document.head.querySelector('meta[name="robots"]')
      if (!robots) {
        robots = document.createElement('meta')
        robots.setAttribute('name', 'robots')
        document.head.appendChild(robots)
      }
      robots.setAttribute('data-detail-status', 'error')
      robots.setAttribute('content', 'noindex')
    }
  },
})

watch(() => route.params.token, (token) => {
  cancelDownload()
  loader.load(String(token || ''))
}, { immediate: true })
onBeforeUnmount(() => {
  loader.cancel()
  catalogController?.abort()
})
usePreviewTracking({ wallpaper: record, series, isOpen: () => Boolean(record.value), ready })

function imageReady(event) {
  if (isCurrentMediaEvent(event, displayUrl.value)) {
    ready.value = true
    mediaFailed.value = false
  }
}

function imageError() {
  ready.value = false
  if (!advance())
    mediaFailed.value = true
}

function videoReady(event) {
  if (isCurrentMediaEvent(event, record.value?.previewUrl || record.value?.url))
    ready.value = true
}

async function copyLink() {
  try {
    await copyText(buildWallpaperShareUrl(record.value))
    ElMessage.success('站内分享链接已复制')
  }
  catch { ElMessage.error('复制失败，请复制浏览器地址') }
}

function retryMedia() {
  reset()
  mediaFailed.value = false
}
</script>

<template>
  <article class="wallpaper-detail">
    <RouterLink :to="record ? `/${record._series}` : '/desktop'" class="detail-back">
      返回壁纸列表
    </RouterLink>
    <p v-if="loading" role="status">
      正在加载壁纸详情…
    </p>
    <section v-else-if="failure" class="detail-error" role="status">
      <h1>{{ failure.status === 404 ? '壁纸不存在' : failure.status === 400 ? '分享链接无效' : '详情暂时无法加载' }}</h1>
      <p>{{ failure.message }}</p>
      <button v-if="failure.status !== 404 && failure.status !== 400" type="button" @click="loader.load(String(route.params.token))">
        重新加载
      </button>
    </section>
    <template v-else-if="record">
      <div class="detail-layout">
        <section class="detail-media" :aria-label="record.title">
          <video
            v-if="record.mediaType === 'video'"
            :key="record.assetKey"
            :src="record.previewUrl || record.url"
            :poster="record.thumbnailUrl"
            controls
            playsinline
            preload="metadata"
            @loadeddata="videoReady"
            @error="mediaFailed = true"
          />
          <WallpaperImageStage
            v-else
            :key="`${record.assetKey}:${displayUrl}`"
            :src="displayUrl"
            :alt="record.title"
            :resolution="record.resolution"
            @load="imageReady"
            @error="imageError"
          />
          <button v-if="mediaFailed && record.mediaType !== 'video'" type="button" @click="retryMedia">
            重新加载图片
          </button>
          <p v-if="mediaFailed && record.mediaType === 'video'" role="status">
            视频暂时无法播放，请稍后重试或下载原文件。
          </p>
        </section>
        <section class="detail-info">
          <p class="detail-category">
            {{ [record.category, record.subcategory].filter(Boolean).join(' / ') }}
          </p>
          <h1>{{ record.title }}</h1>
          <p v-if="record.description">
            {{ record.description }}
          </p>
          <p>{{ dimensionLabel }}<span v-if="record.size"> · {{ formatFileSize(record.size) }}</span></p>
          <div class="detail-tags">
            <span v-for="tag in record.tags" :key="tag">{{ tag }}</span>
          </div>
          <div class="detail-actions">
            <button type="button" :disabled="downloading" @click="handleDownload">
              {{ downloading ? '正在下载…' : '下载原文件' }}
            </button>
            <button type="button" @click="copyLink">
              复制分享链接
            </button>
            <button v-if="record._series === 'desktop' && record.mediaType === 'image'" type="button" @click="cropOpen = true">
              裁剪壁纸
            </button>
          </div>
          <WallpaperCardActions
            :liked="liked"
            :collected="collected"
            :is-authenticated="isAuthenticated"
            :show-counts="false"
            @toggle-like="handleLike"
            @toggle-collect="handleCollect"
          />
          <div class="detail-extensions">
            <WallpaperDesktopActions :wallpaper="record" />
          </div>
          <dl class="detail-attribution">
            <template v-if="record.author">
              <dt>作者</dt><dd>{{ record.author }}</dd>
            </template>
            <template v-if="record.source">
              <dt>来源</dt><dd>{{ record.source }}</dd>
            </template>
            <dt>授权</dt><dd>{{ record.license || '来源未提供授权信息，请自行确认使用权限。' }}</dd>
          </dl>
        </section>
      </div>
      <section v-if="related.length" class="detail-related">
        <h2>相关推荐</h2>
        <div class="detail-related-grid">
          <RouterLink v-for="item in related" :key="item.assetKey" :to="item.sharePath">
            <img :src="item.thumbnailUrl" :alt="item.title" loading="lazy" decoding="async">
            <span>{{ item.title }}</span>
          </RouterLink>
        </div>
      </section>
      <ImageCropModal
        v-if="cropOpen"
        :is-open="cropOpen"
        :image-url="record.downloadUrl"
        :filename="record.filename"
        :original-resolution="record.resolution"
        @close="cropOpen = false"
      />
    </template>
  </article>
</template>

<style scoped>
.wallpaper-detail {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 20px 64px;
  color: var(--color-text-primary);
}
.detail-back {
  display: inline-block;
  padding: 10px 0;
  margin-bottom: 16px;
  color: var(--color-accent);
}
.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  gap: 28px;
}
.detail-media {
  min-width: 0;
  border-radius: 16px;
  overflow: hidden;
}
.detail-media video {
  width: 100%;
  max-height: 70dvh;
  background: #101827;
}
.detail-info h1 {
  font-size: clamp(24px, 3vw, 36px);
  line-height: 1.3;
  margin: 8px 0 16px;
}
.detail-info p {
  line-height: 1.8;
  color: var(--color-text-secondary);
}
.detail-category {
  font-size: 13px;
}
.detail-tags,
.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0;
}
.detail-tags span {
  border: 1px solid var(--color-border, #94a3b8);
  border-radius: 24px;
  padding: 4px 10px;
  font-size: 12px;
}
.detail-actions button,
.detail-error button,
.detail-media button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--color-border, #94a3b8);
  border-radius: 10px;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  cursor: pointer;
}
.detail-actions button:first-child {
  background: var(--color-accent);
  color: #fff;
}
.detail-actions button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.detail-attribution {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  margin-top: 24px;
  font-size: 13px;
  line-height: 1.7;
}

.detail-extensions {
  display: grid;
  gap: 12px;
  margin-top: 20px;
  min-width: 0;
}

.detail-attribution dt {
  color: var(--color-text-secondary);
}
.detail-attribution dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.detail-related {
  margin-top: 48px;
}
.detail-related-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.detail-related-grid a {
  color: inherit;
}
.detail-related-grid img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 10px;
}
.detail-related-grid span {
  display: block;
  padding: 8px 0;
}
@media (max-width: 767px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
  .detail-related-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
