<script setup>
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import SoftLoading from '@/components/common/feedback/SoftLoading.vue'
import { useLoadingSurface } from '@/components/common/feedback/useLoadingSurface'
import LocalWallpaperCard from '@/components/wallpaper/local/LocalWallpaperCard.vue'
import { deleteProtectionReason, formatLocalBytes, useLocalWallpapers } from '@/composables/useLocalWallpapers'
import { DESKTOP_CLIENT_URL } from '@/services/desktopWallpaperService'

const { phase, library, loading, busy, operation, canChangeLocation, fileManagerLabels, error, thumbnails, initialize, refresh, apply, remove, clearUnused, reveal, stopRotation, changeLocation, retryThumbnail, thumbnailFailed } = useLocalWallpapers()
const unusedCount = computed(() => library.value?.entries.filter(entry => !deleteProtectionReason(entry, library.value.readOnly)).length || 0)
const progressBusy = computed(() => ['apply', 'storage'].includes(operation.value?.kind))
const progressLabel = ref('正在设置壁纸')
watch(() => operation.value?.kind, (kind) => {
  if (kind === 'apply' || kind === 'storage')
    progressLabel.value = kind === 'storage' ? '正在选择并整理保存位置' : '正在设置壁纸'
}, { flush: 'sync' })
const showProgress = useLoadingSurface(progressBusy)
const storageReason = computed(() => !canChangeLocation.value ? '请升级桌面客户端后更改保存位置。' : library.value?.readOnly ? '当前为只读模式，暂时不能更改保存位置。' : '')
const progressElement = ref(null)
let disposed = false
let previousFocus

watch(showProgress, async (visible) => {
  if (visible) {
    previousFocus = document.activeElement
    await nextTick()
    if (showProgress.value)
      progressElement.value?.focus({ preventScroll: true })
  }
  else if (previousFocus?.isConnected) {
    previousFocus.focus({ preventScroll: true })
  }
})
onBeforeUnmount(() => {
  disposed = true
  if (previousFocus?.isConnected)
    previousFocus.focus({ preventScroll: true })
})

async function confirm(message, title, confirmButtonText) {
  await ElMessageBox.confirm(message, title, { confirmButtonText, cancelButtonText: '取消', type: 'warning', autofocus: false, distinguishCancelAndClose: true })
  return true
}
async function handleApply(entry) {
  const result = await apply(entry.cacheId)
  if (disposed)
    return
  if (result)
    ElMessage.success('壁纸已设置')
  else if (error.value)
    ElMessage.error(error.value)
}
async function handleRemove(entry) {
  const result = await remove(entry.cacheId, () => confirm(`删除“${entry.title}”的本地文件？删除后需要重新下载才能再次使用。`, '删除本地壁纸', '删除图片'))
  if (!disposed && result)
    ElMessage.success('本地图片已删除')
}
async function handleClear() {
  const result = await clearUnused(() => confirm(`清理 ${unusedCount.value} 张未使用的本地图片？最近应用、上一张及其他受保护图片会保留。`, '清理未使用图片', '确认清理'))
  if (!disposed && result)
    ElMessage.success(`已清理 ${result.removedCount} 张图片，释放 ${formatLocalBytes(result.freedBytes)}`)
}
async function handleStopRotation() {
  const result = await stopRotation()
  if (!disposed && result)
    ElMessage.success('壁纸轮换已停止')
}
async function handleChangeLocation() {
  const result = await changeLocation()
  if (disposed)
    return
  if (result && !result.cancelled)
    ElMessage.success('保存位置已更新，原位置的图片副本会保留')
}
</script>

<template>
  <div class="local-wallpapers-page">
    <header class="local-wallpapers-heading">
      <div>
        <h1>本地壁纸</h1>
        <p>查看保存在这台设备上的图片，随时切换和整理。</p>
      </div>
      <div v-if="phase === 'ready' && library" class="local-wallpapers-heading__actions">
        <ElButton :disabled="busy || loading" :loading="loading" @click="refresh">
          刷新列表
        </ElButton>
        <ElButton :disabled="busy || loading || library.readOnly || !unusedCount" @click="handleClear">
          清理未使用
        </ElButton>
      </div>
    </header>

    <div v-if="phase === 'idle' || phase === 'checking' || (loading && !library)" class="local-wallpapers-state" aria-live="polite">
      <SoftLoading :size="64" label="正在读取本地壁纸" />
    </div>

    <template v-else-if="phase === 'ready' && library">
      <section class="local-wallpapers-storage" aria-label="本地存储">
        <svg class="local-wallpapers-storage__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" transform="translate(0 -1)" stroke-linejoin="round" /></svg>
        <div class="local-wallpapers-storage__content">
          <p class="local-wallpapers-storage__summary">
            <strong>{{ library.totalCount }} 张图片</strong><span>{{ formatLocalBytes(library.totalBytes) }}</span>
          </p>
          <p class="local-wallpapers-storage__path-label">
            <span>保存位置</span>
            <span class="local-wallpapers-storage__change" :title="storageReason || '选择文件夹后，图片将保存至其中的 Wallpaper Gallery 子目录，原位置副本会保留。'" :aria-label="storageReason || undefined" :tabindex="storageReason ? 0 : undefined">
              <ElButton text :disabled="busy || loading || Boolean(storageReason)" @click="handleChangeLocation">
                更改位置
              </ElButton>
            </span>
          </p>
          <code class="local-wallpapers-storage__path">{{ library.storagePath }}</code>
        </div>
        <ElButton :disabled="busy || loading" @click="reveal(null)">
          {{ fileManagerLabels.open }}
        </ElButton>
      </section>

      <p class="local-wallpapers-note">
        图片保存在本机，清理仅删除未使用图片；与云端收藏独立。
      </p>
      <div v-if="library.readOnly" class="local-wallpapers-notice" role="alert">
        <strong>本地记录需要修复，已进入只读模式。</strong>
        <p>图片会保留，可预览或{{ fileManagerLabels.view }}。请重启或升级客户端后重试。</p>
      </div>
      <div v-else-if="library.status.enabled" class="local-wallpapers-rotation">
        <div>
          <strong>壁纸轮换已开启</strong>
          <p>每 {{ library.status.intervalMinutes }} 分钟切换，轮换中的图片会受保护。</p>
        </div>
        <ElButton :disabled="busy || loading" :loading="operation?.kind === 'stop'" @click="handleStopRotation">
          停止轮换
        </ElButton>
      </div>

      <div v-if="error" class="local-wallpapers-error" role="alert">
        <span>{{ error }}</span>
        <ElButton text :disabled="busy || loading" @click="refresh">
          重新读取
        </ElButton>
      </div>

      <template v-if="library.entries.length">
        <p class="local-wallpapers-record-note">
          “最近应用”按本站的设置记录标记，可能与系统当前壁纸不同。
        </p>
        <section class="local-wallpapers-grid" aria-label="本地壁纸列表" :aria-busy="loading">
          <LocalWallpaperCard
            v-for="entry in library.entries"
            :key="entry.cacheId"
            :entry="entry"
            :thumbnail="thumbnails[entry.cacheId]"
            :read-only="library.readOnly"
            :busy="busy || loading"
            :reveal-label="fileManagerLabels.show"
            @apply="handleApply(entry)"
            @reveal="reveal(entry.cacheId)"
            @remove="handleRemove(entry)"
            @retry-thumbnail="retryThumbnail(entry.cacheId)"
            @thumbnail-error="thumbnailFailed(entry.cacheId)"
          />
        </section>
      </template>
      <div v-else class="local-wallpapers-state local-wallpapers-empty">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="10" y="12" width="44" height="36" rx="5" /><circle cx="24" cy="25" r="4" /><path d="m10 41 14-11 10 8 8-6 12 10M24 55h16m-8-7v7" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <h2>这里还没有本地壁纸</h2>
        <p>在图库中将图片设为桌面壁纸后，它会出现在这里。无需登录。</p>
        <RouterLink to="/desktop" class="local-wallpapers-link">
          去挑选壁纸
        </RouterLink>
      </div>
    </template>

    <section v-else class="local-wallpapers-state local-wallpapers-unavailable" aria-live="polite">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="7" width="38" height="27" rx="4" /><path d="M16 42h16m-8-8v8m0-27v8m0 4h.01" stroke-linecap="round" /></svg>
      <h2>{{ phase === 'browser' ? '在桌面客户端管理本地壁纸' : phase === 'upgrade' ? '升级客户端，查看本地壁纸' : '暂时无法读取本地壁纸' }}</h2>
      <p>{{ phase === 'browser' ? '普通浏览器无法读取本机图片。请在桌面客户端打开此页面。' : error }}</p>
      <div class="local-wallpapers-unavailable__actions">
        <a v-if="phase === 'browser' || phase === 'upgrade'" :href="DESKTOP_CLIENT_URL" target="_blank" rel="noopener noreferrer" class="local-wallpapers-link">
          {{ phase === 'browser' ? '下载桌面客户端' : '下载新版客户端' }}
        </a>
        <ElButton v-if="phase !== 'browser'" @click="initialize(true)">
          重新检查
        </ElButton>
      </div>
    </section>
  </div>

  <Teleport to="body">
    <Transition name="local-wallpaper-progress">
      <div
        v-if="showProgress"
        ref="progressElement"
        class="local-wallpaper-progress"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="progressLabel"
        :aria-busy="progressBusy"
        @keydown.stop
        @keydown.tab.prevent
        @keydown.esc.stop.prevent
        @wheel.prevent
        @touchmove.prevent
      >
        <div class="local-wallpaper-progress__card">
          <SoftLoading :size="72" :label="progressLabel" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.local-wallpapers-page {
  max-width: 1440px;
  margin: 0 auto;
  padding: 40px 40px 64px;
  color: var(--color-text-primary);
  --el-color-primary: var(--color-accent);
  --el-bg-color: var(--color-bg-card);
  --el-fill-color-blank: var(--color-bg-card);
  --el-text-color-primary: var(--color-text-primary);
  --el-text-color-regular: var(--color-text-secondary);
  --el-border-color: var(--color-border);
}
.local-wallpapers-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}
.local-wallpapers-heading h1 {
  margin: 0 0 10px;
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.25;
}
.local-wallpapers-heading p,
.local-wallpapers-note,
.local-wallpapers-record-note {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.8;
}
.local-wallpapers-heading__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: none;
}
.local-wallpapers-page :deep(.el-button) {
  min-height: 40px;
  margin: 0;
  border-radius: 10px;
  font-family: inherit;
}
.local-wallpapers-storage {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg-card);
}
.local-wallpapers-storage__icon {
  flex: none;
  width: 32px;
  height: 32px;
  color: var(--color-accent);
}
.local-wallpapers-storage__content {
  flex: 1;
  min-width: 0;
}
.local-wallpapers-storage__summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0 0 14px;
  font-variant-numeric: tabular-nums;
}
.local-wallpapers-storage__summary strong {
  font-size: 16px;
  font-weight: 600;
}
.local-wallpapers-storage__summary span {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.local-wallpapers-storage__path-label {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.local-wallpapers-storage__change {
  display: inline-flex;
  border-radius: 6px;
}
.local-wallpapers-storage__change :deep(.el-button) {
  min-height: 30px;
  padding: 4px 6px;
  color: var(--color-accent);
  font-size: 12px;
}
.local-wallpapers-storage__change:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
.local-wallpapers-storage__path {
  display: block;
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  user-select: text;
}
.local-wallpapers-note {
  max-width: 90ch;
  margin: 14px 0 28px;
  font-size: 12px;
}
.local-wallpapers-notice,
.local-wallpapers-rotation {
  margin-bottom: 24px;
  padding: 18px 20px;
  border: 1px solid var(--accent-border-strong);
  border-radius: 12px;
  background: var(--accent-surface);
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.7;
}
.local-wallpapers-notice p,
.local-wallpapers-rotation p {
  margin: 3px 0 0;
  color: var(--color-text-secondary);
}
.local-wallpapers-rotation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.local-wallpapers-error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0 0 20px;
  color: var(--color-text-primary);
  font-size: 13px;
}
.local-wallpapers-record-note {
  margin-bottom: 16px;
  font-size: 12px;
}
.local-wallpapers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 270px), 1fr));
  gap: 24px;
}
.local-wallpapers-state {
  display: flex;
  min-height: 380px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}
.local-wallpapers-state > svg {
  width: 58px;
  height: 58px;
  margin-bottom: 24px;
  color: var(--color-accent);
}
.local-wallpapers-state h2 {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.5;
  text-wrap: balance;
}
.local-wallpapers-state p {
  max-width: 46ch;
  margin: 0 0 24px;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.8;
}
.local-wallpapers-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  color: var(--color-accent);
  font-size: 14px;
  font-weight: 550;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.local-wallpapers-unavailable__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
}
.local-wallpapers-page :deep(:is(button, a):focus-visible) {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
.local-wallpaper-progress {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 12, 26, 0.45);
  backdrop-filter: blur(5px);
  outline: none;
}
.local-wallpaper-progress__card {
  display: grid;
  min-width: 188px;
  min-height: 166px;
  place-items: center;
  padding: 28px 32px;
  border: 1px solid rgba(147, 197, 253, 0.2);
  border-radius: 24px;
  background: linear-gradient(145deg, #22334f, #15223a);
  box-shadow: 0 20px 60px rgba(2, 8, 23, 0.3);
  --color-text-secondary: #dbeafe;
}
.local-wallpaper-progress-enter-active,
.local-wallpaper-progress-leave-active {
  transition: opacity 180ms ease;
}
.local-wallpaper-progress-enter-from,
.local-wallpaper-progress-leave-to {
  opacity: 0;
}
@media (max-width: 767px) {
  .local-wallpapers-page {
    padding: 28px 20px 48px;
  }
  .local-wallpapers-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 18px;
    margin-bottom: 22px;
  }
  .local-wallpapers-heading h1 {
    font-size: 26px;
  }
  .local-wallpapers-storage {
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px;
  }
  .local-wallpapers-storage__content {
    flex-basis: calc(100% - 50px);
  }
  .local-wallpapers-storage > :deep(.el-button) {
    width: 100%;
  }
  .local-wallpapers-page :deep(.el-button) {
    min-height: 44px;
  }
  .local-wallpapers-grid {
    gap: 20px;
  }
  .local-wallpapers-rotation {
    align-items: flex-start;
    flex-direction: column;
  }
  .local-wallpapers-state {
    min-height: 360px;
    padding-right: 0;
    padding-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .local-wallpaper-progress-enter-active,
  .local-wallpaper-progress-leave-active {
    transition: none;
  }
}
</style>
