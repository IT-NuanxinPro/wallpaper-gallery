<script setup>
import { onMounted, ref } from 'vue'
import { isMobileOrTabletDevice } from '@/composables/useDevice'

const appInfo = ref({
  version: '',
  versionCode: 0,
  downloadUrl: '',
  changelog: '',
  releaseDate: '',
})
const loading = ref(true)
const downloading = ref(false)
const error = ref(null)

// 获取版本信息
async function fetchAppInfo() {
  try {
    const response = await fetch('/app-version.json')
    if (!response.ok)
      throw new Error('获取版本信息失败')
    appInfo.value = await response.json()
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    loading.value = false
  }
}

// 下载 APK
async function handleDownload() {
  if (!appInfo.value.downloadUrl || downloading.value)
    return

  downloading.value = true
  try {
    // 移动端直接使用 window.location.href，不通过 blob
    // 因为移动浏览器不支持通过 JavaScript 触发的 download 属性
    if (isMobileOrTabletDevice()) {
      // 移动端：直接打开下载链接
      // 使用 location.href 而不是 window.open，确保在 PWA 中也能正常工作
      window.location.href = appInfo.value.downloadUrl

      // 延迟重置状态，给浏览器时间处理下载
      setTimeout(() => {
        downloading.value = false
      }, 1000)
      return
    }

    // 桌面端：使用 blob 方式下载（支持自定义文件名）
    const response = await fetch(appInfo.value.downloadUrl)
    if (!response.ok)
      throw new Error('下载失败')

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Wallpaper-Gallery-v${appInfo.value.version}.apk`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    downloading.value = false
  }
  catch (error) {
    console.error('下载失败:', error)
    // 降级：直接跳转下载
    window.location.href = appInfo.value.downloadUrl
    downloading.value = false
  }
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr)
    return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(() => {
  fetchAppInfo()
})
</script>

<template>
  <div class="download-page">
    <div class="download-container">
      <!-- App 图标和名称 -->
      <div class="app-header">
        <div class="app-icon">
          <img src="/icon-192.png" alt="Wallpaper Gallery">
        </div>
        <h1 class="app-name">
          Wallpaper Gallery
        </h1>
        <p class="app-desc">
          精选高清4K壁纸
        </p>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner" />
        <p>加载中...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button class="retry-btn" @click="fetchAppInfo">
          重试
        </button>
      </div>

      <!-- 版本信息 -->
      <div v-else class="version-info">
        <div class="version-badge">
          <span class="version-label">最新版本</span>
          <span class="version-number">v{{ appInfo.version }}</span>
        </div>

        <div v-if="appInfo.releaseDate" class="release-date">
          发布于 {{ formatDate(appInfo.releaseDate) }}
        </div>

        <!-- 下载按钮 -->
        <button
          class="download-btn"
          :class="{ 'is-downloading': downloading }"
          :disabled="!appInfo.downloadUrl || downloading"
          @click="handleDownload"
        >
          <svg v-if="!downloading" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <div v-else class="btn-spinner" />
          <span>{{ downloading ? '下载中...' : '下载 APK' }}</span>
        </button>

        <!-- 更新日志 -->
        <div v-if="appInfo.changelog" class="changelog">
          <h3>更新内容</h3>
          <p>{{ appInfo.changelog }}</p>
        </div>
      </div>

      <!-- 功能特性 -->
      <div class="features">
        <h3>功能特性</h3>
        <ul>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>海量高清壁纸</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>支持电脑、手机、头像</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>一键下载保存</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>真机预览效果</span>
          </li>
        </ul>
      </div>

      <!-- 安装说明 -->
      <div class="install-tips">
        <h3>安装说明</h3>
        <ol>
          <li>点击下载按钮获取 APK 文件</li>
          <li>打开下载的文件进行安装</li>
          <li>如提示风险，请选择「仍要安装」</li>
          <li>首次使用需授予存储权限</li>
        </ol>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.download-page {
  height: 100vh;
  height: 100dvh; // 动态视口高度，适配移动端
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.download-container {
  max-width: 380px;
  width: 100%;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  background: #ffffff;
  border-radius: 20px;
  padding: 24px 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow-y: auto;

  // 隐藏滚动条但保留滚动功能
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.app-header {
  text-align: center;
  margin-bottom: 16px;
}

.app-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 10px;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.3);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.app-name {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.app-desc {
  font-size: 13px;
  color: #6c757d;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 24px 0;
  color: #6c757d;
}

.spinner,
.btn-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e9ecef;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 10px;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  margin: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 20px;
  background: #6366f1;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: #4f46e5;
  }
}

.version-info {
  text-align: center;
  margin-bottom: 16px;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0f1ff;
  padding: 6px 12px;
  border-radius: 16px;
  margin-bottom: 8px;
}

.version-label {
  font-size: 11px;
  color: #6c757d;
}

.version-number {
  font-size: 13px;
  font-weight: 600;
  color: #6366f1;
}

.release-date {
  font-size: 12px;
  color: #adb5bd;
  margin-bottom: 16px;
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 20px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);

  .icon {
    width: 20px;
    height: 20px;
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(99, 102, 241, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &.is-downloading {
    background: #8b5cf6;
  }
}

.changelog {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 10px;
  text-align: left;

  h3 {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a2e;
    margin-bottom: 6px;
  }

  p {
    font-size: 12px;
    color: #6c757d;
    line-height: 1.5;
  }
}

.features,
.install-tips {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #e9ecef;

  h3 {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a2e;
    margin-bottom: 10px;
  }
}

.features ul {
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #495057;

    svg {
      width: 14px;
      height: 14px;
      color: #10b981;
      flex-shrink: 0;
    }
  }
}

.install-tips ol {
  list-style: none;
  counter-reset: step;

  li {
    position: relative;
    padding-left: 28px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #495057;
    line-height: 1.4;

    &::before {
      content: counter(step);
      counter-increment: step;
      position: absolute;
      left: 0;
      top: 0;
      width: 20px;
      height: 20px;
      background: #f0f1ff;
      color: #6366f1;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
