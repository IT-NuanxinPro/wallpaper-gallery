<script setup>
import { ElButton, ElMessage } from 'element-plus'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import SoftLoading from '@/components/common/feedback/SoftLoading.vue'
import RelatedCollections from '@/components/community/RelatedCollections.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import WallpaperDesktopActions from '@/components/wallpaper/desktop/WallpaperDesktopActions.vue'
import DevicePreviewStage from '@/components/wallpaper/device-preview/DevicePreviewStage.vue'
import WallpaperImageStage from '@/components/wallpaper/shared/WallpaperImageStage.vue'
import VideoWallpaperPlayer from '@/components/wallpaper/VideoWallpaperPlayer.vue'
import WallpaperDetailStats from '@/components/wallpaper/WallpaperDetailStats.vue'
import { useCopyFeedback } from '@/composables/useCopyFeedback'
import { useImageFallback } from '@/composables/useImageFallback'
import { useInteraction } from '@/composables/useInteraction'
import { useInteractionPrefetch } from '@/composables/useInteractionPrefetch'
import { isCurrentMediaEvent, usePreviewTracking } from '@/composables/usePreviewTracking'
import { useWallpaperDownload } from '@/composables/useWallpaperDownload'
import { useWallpaperStats } from '@/composables/useWallpaperStats'
import { createWallpaperDetailLoader, loadWallpaperCatalog, primeWallpaperDetail, readInitialWallpaperDetail } from '@/services/wallpaperDetailService'
import { copyText } from '@/utils/common/clipboard'
import { formatFileSize } from '@/utils/common/format'
import { createInteractionFeedback } from '@/utils/interaction/feedback'
import { applyWallpaperDetailSeo } from '@/utils/seo/wallpaperDetail'
import { getBrowseReturn, isBrowseReturnPath } from '@/utils/wallpaper/browseReturn'
import { getRelatedWallpapers, getWallpaperDetailSeo, isTrustedWallpaperDetailUrl } from '@/utils/wallpaper/detailRecords'
import { getWallpaperTransitionPreview } from '@/utils/wallpaper/detailTransition'
import { getPreviewMode } from '@/utils/wallpaper/devicePreview'
import { getWallpaperDisplayTitle } from '@/utils/wallpaper/displayTitle'
import { getWallpaperCardAspectRatio } from '@/utils/wallpaper/mediaPresentation'
import { advanceRelatedImageFallback } from '@/utils/wallpaper/relatedImageFallback'
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
const mediaAttempt = ref(0)
const transitionPreview = ref('')
const serverToken = String(route.params.token || '')
const serverArticle = typeof document === 'undefined' ? null : document.querySelector('[data-wallpaper-detail]')
const initialDetail = readInitialWallpaperDetail(serverToken)
const initialImage = serverArticle?.querySelector('.detail-static-stage img')
const initialImageSource = initialImage?.complete && initialImage.naturalWidth ? initialImage.currentSrc || initialImage.src : ''
const serverContentVisible = ref(Boolean(serverArticle))
let catalogController
const series = computed(() => record.value?._series || '')
const seo = computed(() => record.value ? getWallpaperDetailSeo(record.value) : null)
const listPath = computed(() => `/${series.value || 'desktop'}`)
const fileFormat = computed(() => record.value?.format || record.value?.filename?.split('.').pop()?.toUpperCase() || '')
const previewMode = computed(() => getPreviewMode(series.value, record.value?.usage || record.value?.category))
const primarySource = computed(() => record.value?.mediaType === 'video' ? record.value?.thumbnailUrl : record.value?.previewUrl || '')
const imageResolution = computed(() => record.value?.previewResolution || record.value?.resolution)
const { displayUrl, advance, reset } = useImageFallback(primarySource)
const hasServerPreview = computed(() => Boolean(initialImageSource && record.value?.assetKey === initialDetail?.record.assetKey
  && new URL(displayUrl.value, globalThis.location?.href || 'https://wallpaper.061129.xyz').href === initialImageSource))
const { liked, collected, likePending, collectPending, likeError, collectError, isAuthenticated, toggleLike, toggleCollect } = useInteraction(record, series)
const { stats, loading: statsLoading, failed: statsFailed, refresh: refreshStats, afterSuccessful } = useWallpaperStats(record)
const withFeedback = createInteractionFeedback({ router, getRedirect: () => route.fullPath, message: ElMessage })
const handleLike = withFeedback(afterSuccessful(toggleLike))
const handleCollect = withFeedback(afterSuccessful(toggleCollect))
const { downloading, downloadStatus, downloadLabel, downloadFeedback, downloadPercent, canCancelDownload, handleDownload, cancelDownload, resetDownload } = useWallpaperDownload(record, series, { onRecorded: refreshStats })
const { pending: copying, label: copyLabel, feedback: copyFeedback, run: copyLink, reset: resetCopy } = useCopyFeedback(() => copyText(buildWallpaperShareUrl(record.value)))
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
      transitionPreview.value = getWallpaperTransitionPreview(state.record.assetKey, route.fullPath)
      applyWallpaperDetailSeo(state.record)
      const embedded = initialDetail?.record.assetKey === state.record.assetKey ? initialDetail : null
      if (embedded)
        catalog.value = embedded.related
      nextTick(() => {
        if (record.value?.assetKey === state.record.assetKey) {
          clearServerContent()
        }
      })
      if (embedded)
        return
      catalogController = new AbortController()
      loadWallpaperCatalog({ series: state.record._series, signal: catalogController.signal }).then((items) => {
        if (record.value?.assetKey === state.record.assetKey)
          catalog.value = items
      }).catch(() => {})
    }
    else if (state.error && !serverContentVisible.value) {
      document.title = state.error.status === 404 ? '壁纸不存在 - Wallpaper Gallery' : '详情加载失败 - Wallpaper Gallery'
      document.head.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"], meta[property^="og:"], meta[name^="twitter:"], meta[name="description"]').forEach(element => element.remove())
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
  if (resetDownload)
    resetDownload()
  else
    cancelDownload()
  resetCopy()
  transitionPreview.value = ''
  if (String(token || '') !== serverToken) {
    clearServerContent()
  }
  loader.load(String(token || ''))
}, { immediate: true })
onBeforeUnmount(() => {
  loader.cancel()
  catalogController?.abort()
  clearServerContent()
})
usePreviewTracking({ wallpaper: record, series, isOpen: () => Boolean(record.value), ready, onRecorded: refreshStats })

function clearServerContent() {
  serverArticle?.remove()
  if (typeof document !== 'undefined')
    document.body.removeAttribute('data-wallpaper-fallback')
  serverContentVisible.value = false
}

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
  if (isCurrentMediaEvent(event, record.value?.previewUrl || record.value?.url)) {
    ready.value = true
    mediaFailed.value = false
  }
}

function videoError() {
  ready.value = false
  mediaFailed.value = true
}

function retryMedia() {
  ready.value = false
  reset()
  mediaAttempt.value++
  mediaFailed.value = false
}

function returnToList() {
  const previous = router.options.history.state.back
  if (isBrowseReturnPath(previous))
    router.back()
  else
    router.push(getBrowseReturn() || listPath.value)
}
</script>

<template>
  <article class="wallpaper-detail" :class="{ 'has-server-content': serverContentVisible && !record }">
    <div v-if="!serverContentVisible || record" class="detail-topbar">
      <nav v-if="record" class="detail-breadcrumbs" aria-label="面包屑">
        <RouterLink to="/">
          首页
        </RouterLink>
        <span aria-hidden="true">/</span>
        <RouterLink :to="listPath">
          {{ seo.seriesName }}
        </RouterLink>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ seo.name }}</span>
      </nav>
      <ElButton class="detail-back" round @click="returnToList">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        返回列表
      </ElButton>
    </div>
    <div v-if="loading && !serverContentVisible" class="detail-loading">
      <SoftLoading :size="64" label="正在加载壁纸详情" />
    </div>
    <section v-else-if="failure && !serverContentVisible" class="detail-error" role="status">
      <h1>{{ failure.status === 404 ? '壁纸不存在' : failure.status === 400 ? '分享链接无效' : '详情暂时无法加载' }}</h1>
      <p>{{ failure.message }}</p>
      <ElButton v-if="failure.status !== 404 && failure.status !== 400" round type="primary" @click="loader.load(String(route.params.token))">
        重新加载
      </ElButton>
    </section>
    <div v-else-if="failure && serverContentVisible" class="detail-server-retry" role="status">
      <span>已保留壁纸内容，互动功能暂时无法加载。</span>
      <ElButton round @click="loader.load(String(route.params.token))">
        重新加载
      </ElButton>
    </div>
    <template v-else-if="record">
      <div class="detail-layout">
        <section class="detail-media" :class="{ 'is-video': record.mediaType === 'video', 'is-phone': series === 'mobile', 'is-avatar': series === 'avatar', 'has-device-preview': series !== 'avatar' }" :aria-label="seo.name">
          <DevicePreviewStage v-if="series !== 'avatar'" :key="record.assetKey" :mode="previewMode" :src="displayUrl" :alt="seo.name" :ready="ready">
            <VideoWallpaperPlayer
              v-if="record.mediaType === 'video'"
              :key="record.assetKey"
              class="detail-video-player"
              :data-wallpaper-detail-media="record.assetKey"
              :src="record.previewUrl || record.url"
              :poster="record.thumbnailUrl"
              :autoplay="true"
              :controls="false"
              @playing="videoReady"
              @error="videoError"
            />
            <WallpaperImageStage
              v-else
              :key="`${record.assetKey}:${displayUrl}:${mediaAttempt}`"
              :src="displayUrl"
              :placeholder-src="transitionPreview"
              :data-wallpaper-detail-media="record.assetKey"
              :class="{ 'has-server-preview': hasServerPreview }"
              :alt="seo.name"
              :resolution="imageResolution"
              @load="imageReady"
              @error="imageError"
            />
          </DevicePreviewStage>
          <WallpaperImageStage
            v-else
            :key="`${record.assetKey}:${displayUrl}:${mediaAttempt}`"
            :src="displayUrl"
            :placeholder-src="transitionPreview"
            :data-wallpaper-detail-media="record.assetKey"
            :class="{ 'has-server-preview': hasServerPreview }"
            :alt="seo.name"
            :resolution="imageResolution"
            :style="{ aspectRatio: '1 / 1' }"
            @load="imageReady"
            @error="imageError"
          />
          <ElButton v-if="mediaFailed && record.mediaType !== 'video'" round class="detail-media-retry" @click="retryMedia">
            重新加载图片
          </ElButton>
          <p v-if="mediaFailed && record.mediaType === 'video'" role="status">
            视频暂时无法播放，请稍后重试或下载文件。
          </p>
        </section>
        <section :key="record.assetKey" class="detail-info detail-info-enter" :class="{ 'detail-info-enter--after-media': transitionPreview }">
          <p class="detail-category">
            {{ seo.seriesName }}<span v-if="record.category"> · {{ record.category }}</span><span v-if="record.subcategory"> / {{ record.subcategory }}</span>
          </p>
          <h1>{{ seo.name }}</h1>
          <p class="detail-description">
            {{ record.description || seo.description }}
          </p>
          <WallpaperDetailStats :stats="stats" :loading="statsLoading" :failed="statsFailed" />
          <dl class="detail-facts">
            <div><dt>原文件尺寸</dt><dd>{{ dimensionLabel }}</dd></div>
            <div v-if="fileFormat">
              <dt>文件格式</dt><dd>{{ fileFormat }}</dd>
            </div>
            <div v-if="record.size">
              <dt>文件大小</dt><dd>{{ formatFileSize(record.size) }}</dd>
            </div>
          </dl>
          <div v-if="record.tags?.length" class="detail-tags" aria-label="壁纸标签">
            <span v-for="tag in record.tags" :key="tag">{{ tag }}</span>
          </div>
          <div class="detail-actions">
            <ElButton type="primary" round class="detail-download-button" :class="{ 'is-downloading': downloading }" :disabled="downloading" :aria-busy="downloading" :style="{ '--download-progress': downloadPercent === null ? '0%' : `${downloadPercent}%` }" @click="handleDownload">
              <svg v-if="!downloading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5" /></svg>
              <span v-if="downloading" class="detail-download-activity" aria-hidden="true"><i /><i /><i /></span>
              <span class="detail-download-label">
                <Transition name="action-label"><span :key="downloading ? 'pending' : downloadStatus">{{ downloadLabel || '下载文件' }}</span></Transition>
              </span>
            </ElButton>
            <button v-if="canCancelDownload" type="button" class="detail-download-cancel" @click="cancelDownload">
              取消
            </button>
            <ElButton round class="detail-copy-button" :disabled="copying" :aria-busy="copying" @click="copyLink">
              <span class="detail-copy-label"><Transition name="action-label"><span :key="copyLabel">{{ copyLabel }}</span></Transition></span>
            </ElButton>
            <ElButton v-if="record._series === 'desktop' && record.mediaType === 'image'" round @click="cropOpen = true">
              裁剪壁纸
            </ElButton>
          </div>
          <p v-if="downloadFeedback || copyFeedback" class="detail-action-feedback" role="status" aria-live="polite">
            {{ downloadFeedback || copyFeedback }}
          </p>
          <WallpaperCardActions
            :liked="liked"
            :collected="collected"
            :like-pending="likePending"
            :collect-pending="collectPending"
            :like-error="likeError"
            :collect-error="collectError"
            :is-authenticated="isAuthenticated"
            :show-counts="false"
            @toggle-like="handleLike"
            @toggle-collect="handleCollect"
          />
          <div class="detail-extensions">
            <WallpaperDesktopActions :wallpaper="record" />
          </div>
          <dl v-if="record.author || record.source || record.license" class="detail-attribution">
            <template v-if="record.author">
              <dt>作者</dt><dd>{{ record.author }}</dd>
            </template>
            <template v-if="record.source">
              <dt>来源</dt><dd>{{ record.source }}</dd>
            </template>
            <template v-if="record.license">
              <dt>授权</dt><dd>{{ record.license }}</dd>
            </template>
          </dl>
        </section>
      </div>
      <RelatedCollections :record="record" />
      <section v-if="related.length" class="detail-related">
        <div class="detail-related-heading">
          <h2>继续发现</h2><p>更多同系列壁纸</p>
        </div>
        <div class="detail-related-grid">
          <RouterLink v-for="item in related" :key="item.assetKey" :to="item.sharePath" @pointerenter="primeWallpaperDetail(item)" @pointerdown="primeWallpaperDetail(item)" @focus="primeWallpaperDetail(item)" @click="primeWallpaperDetail(item)">
            <img :key="item.thumbnailUrl" :src="item.thumbnailUrl" :alt="getWallpaperDisplayTitle(item)" :style="{ aspectRatio: getWallpaperCardAspectRatio(item).replace('/', ' / ') }" :width="item.resolution?.width || 800" :height="item.resolution?.height || 500" loading="lazy" decoding="async" @error="advanceRelatedImageFallback($event, item.thumbnailUrl)">
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

<style src="../assets/styles/wallpaper-detail.css"></style>

<style scoped>
.detail-info-enter {
  animation: detail-info-enter 160ms ease-out both;
}

.detail-info-enter--after-media {
  animation-delay: 100ms;
}
.detail-copy-button {
  min-width: 124px;
}
.detail-download-label,
.detail-copy-label {
  display: grid;
}
.detail-download-label > span,
.detail-copy-label > span {
  grid-area: 1 / 1;
}
.action-label-enter-active,
.action-label-leave-active {
  transition: opacity 160ms ease;
}
.action-label-enter-from,
.action-label-leave-to {
  opacity: 0;
}

.detail-media {
  animation: detail-media-enter 160ms ease-out both;
}

.detail-action-feedback {
  margin: 0 0 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

@keyframes detail-info-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes detail-media-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-info-enter,
  .detail-media {
    animation: none;
  }
  .action-label-enter-active,
  .action-label-leave-active {
    transition: none;
  }
}
</style>
