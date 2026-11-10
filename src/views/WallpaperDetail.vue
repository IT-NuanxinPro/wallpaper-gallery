<script setup>
import { ElButton, ElMessage } from 'element-plus'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import SoftLoading from '@/components/common/feedback/SoftLoading.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import WallpaperDesktopActions from '@/components/wallpaper/desktop/WallpaperDesktopActions.vue'
import WallpaperImageStage from '@/components/wallpaper/shared/WallpaperImageStage.vue'
import VideoWallpaperPlayer from '@/components/wallpaper/VideoWallpaperPlayer.vue'
import { useImageFallback } from '@/composables/useImageFallback'
import { useInteraction } from '@/composables/useInteraction'
import { useInteractionPrefetch } from '@/composables/useInteractionPrefetch'
import { isCurrentMediaEvent, usePreviewTracking } from '@/composables/usePreviewTracking'
import { useWallpaperDownload } from '@/composables/useWallpaperDownload'
import { createWallpaperDetailLoader, loadWallpaperCatalog, readInitialWallpaperDetail } from '@/services/wallpaperDetailService'
import { copyText } from '@/utils/common/clipboard'
import { formatFileSize } from '@/utils/common/format'
import { createInteractionFeedback } from '@/utils/interaction/feedback'
import { applyWallpaperDetailSeo } from '@/utils/seo/wallpaperDetail'
import { getBrowseReturn, isBrowseReturnPath } from '@/utils/wallpaper/browseReturn'
import { getRelatedWallpapers, getWallpaperDetailSeo, isTrustedWallpaperDetailUrl } from '@/utils/wallpaper/detailRecords'
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
const mediaStyle = computed(() => ({ aspectRatio: record.value?.resolution ? `${record.value.resolution.width} / ${record.value.resolution.height}` : '16 / 10' }))
const primarySource = computed(() => record.value?.mediaType === 'video' ? record.value?.thumbnailUrl : record.value?.previewUrl || '')
const { displayUrl, advance, reset } = useImageFallback(primarySource)
const hasServerPreview = computed(() => Boolean(initialImageSource && record.value?.assetKey === initialDetail?.record.assetKey
  && new URL(displayUrl.value, globalThis.location?.href || 'https://wallpaper.061129.xyz').href === initialImageSource))
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
  cancelDownload()
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
usePreviewTracking({ wallpaper: record, series, isOpen: () => Boolean(record.value), ready })

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
        <section class="detail-media" :class="{ 'is-video': record.mediaType === 'video' }" :aria-label="seo.name">
          <VideoWallpaperPlayer
            v-if="record.mediaType === 'video'"
            :key="record.assetKey"
            class="detail-video-player"
            :src="record.previewUrl || record.url"
            :poster="record.thumbnailUrl"
            :style="mediaStyle"
            :autoplay="true"
            :controls="false"
            @canplay="videoReady"
            @error="mediaFailed = true"
          />
          <WallpaperImageStage
            v-else
            :key="`${record.assetKey}:${displayUrl}:${mediaAttempt}`"
            :src="displayUrl"
            :class="{ 'has-server-preview': hasServerPreview }"
            :alt="seo.name"
            :resolution="record.resolution"
            @load="imageReady"
            @error="imageError"
          />
          <ElButton v-if="mediaFailed && record.mediaType !== 'video'" round class="detail-media-retry" @click="retryMedia">
            重新加载图片
          </ElButton>
          <p v-if="mediaFailed && record.mediaType === 'video'" role="status">
            视频暂时无法播放，请稍后重试或下载原文件。
          </p>
        </section>
        <section class="detail-info">
          <p class="detail-category">
            {{ seo.seriesName }}<span v-if="record.category"> · {{ record.category }}</span><span v-if="record.subcategory"> / {{ record.subcategory }}</span>
          </p>
          <h1>{{ seo.name }}</h1>
          <p class="detail-description">
            {{ record.description || seo.description }}
          </p>
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
            <ElButton type="primary" round :loading="downloading" :disabled="downloading" @click="handleDownload">
              <svg v-if="!downloading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5" /></svg>
              {{ downloading ? '正在下载…' : '下载原文件' }}
            </ElButton>
            <ElButton round @click="copyLink">
              复制分享链接
            </ElButton>
            <ElButton v-if="record._series === 'desktop' && record.mediaType === 'image'" round @click="cropOpen = true">
              裁剪壁纸
            </ElButton>
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
      <section v-if="related.length" class="detail-related">
        <div class="detail-related-heading">
          <h2>继续发现</h2><p>更多同系列壁纸</p>
        </div>
        <div class="detail-related-grid">
          <RouterLink v-for="item in related" :key="item.assetKey" :to="item.sharePath">
            <img :src="item.thumbnailUrl" :alt="item.title" :width="item.resolution?.width || 800" :height="item.resolution?.height || 500" loading="lazy" decoding="async">
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

<style src="../assets/styles/wallpaper-detail.css"></style>
