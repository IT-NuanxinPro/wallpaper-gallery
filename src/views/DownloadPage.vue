<script setup>
import QRCode from 'qrcode'
import { onMounted, ref } from 'vue'
import { isMobileOrTabletDevice } from '@/composables/useDevice'

const isMobile = ref(false)

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
const qrCodeUrl = ref('')
const showContent = ref(false)

// 生成带 logo 的二维码
async function generateQRCode() {
  let canvas = null
  let logo = null

  try {
    // 使用当前页面 URL，扫码后打开浏览器访问下载页
    const pageUrl = window.location.href

    canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, pageUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })

    const ctx = canvas.getContext('2d')
    logo = new Image()
    logo.crossOrigin = 'anonymous'
    logo.src = '/icon-192.png'

    await new Promise((resolve, reject) => {
      logo.onload = resolve
      logo.onerror = reject
    })

    const logoSize = canvas.width * 0.22
    const logoX = (canvas.width - logoSize) / 2
    const logoY = (canvas.height - logoSize) / 2

    const padding = 4
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, logoX - padding, logoY - padding, logoSize + padding * 2, logoSize + padding * 2, 8)
    ctx.fill()

    ctx.save()
    roundRect(ctx, logoX, logoY, logoSize, logoSize, 6)
    ctx.clip()
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
    ctx.restore()

    qrCodeUrl.value = canvas.toDataURL('image/png')
  }
  catch (e) {
    console.error('生成二维码失败:', e)
  }
  finally {
    // 清理资源
    if (logo) {
      logo.onload = null
      logo.onerror = null
      logo.src = ''
      logo = null
    }
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
      canvas.width = 0
      canvas.height = 0
      canvas = null
    }
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

async function fetchAppInfo() {
  try {
    const response = await fetch('/app-version.json')
    if (!response.ok)
      throw new Error('获取版本信息失败')
    appInfo.value = await response.json()

    // 生成当前页面的二维码
    await generateQRCode()
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    loading.value = false
    setTimeout(() => {
      showContent.value = true
    }, 100)
  }
}

async function handleDownload() {
  if (!appInfo.value.downloadUrl || downloading.value)
    return

  downloading.value = true
  try {
    if (isMobileOrTabletDevice()) {
      window.location.href = appInfo.value.downloadUrl
      setTimeout(() => {
        downloading.value = false
      }, 1000)
      return
    }

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
  catch (err) {
    console.error('下载失败:', err)
    window.location.href = appInfo.value.downloadUrl
    downloading.value = false
  }
}

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
  isMobile.value = isMobileOrTabletDevice()
  fetchAppInfo()
})
</script>

<template>
  <div class="download-page">
    <!-- 背景动画 -->
    <div class="bg-shapes">
      <div class="shape shape-1" />
      <div class="shape shape-2" />
      <div class="shape shape-3" />
    </div>

    <div class="download-container" :class="{ show: showContent }">
      <!-- App 图标和名称 -->
      <div class="app-header">
        <div class="app-icon">
          <img src="/icon-192.png" alt="Wallpaper Gallery">
          <div class="icon-glow" />
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

      <!-- 版本信息和下载 -->
      <div v-else class="version-info">
        <div class="version-row">
          <div class="version-badge">
            <span class="pulse-dot" />
            <span class="version-label">最新版本</span>
            <span class="version-number">v{{ appInfo.version }}</span>
          </div>
          <span v-if="appInfo.releaseDate" class="release-date">
            {{ formatDate(appInfo.releaseDate) }}
          </span>
        </div>

        <!-- 二维码 - 仅桌面端显示 -->
        <div v-if="qrCodeUrl && !isMobile" class="qrcode-section">
          <div class="qrcode-wrapper">
            <img :src="qrCodeUrl" alt="下载二维码" class="qrcode-img">
            <div class="scan-line" />
          </div>
          <p class="qrcode-tip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            扫码下载 APK
          </p>
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
          <span>{{ downloading ? '下载中...' : '直接下载' }}</span>
          <div class="btn-shine" />
        </button>

        <!-- 更新日志 -->
        <p v-if="appInfo.changelog" class="changelog">
          {{ appInfo.changelog }}
        </p>
      </div>

      <!-- 功能特性 -->
      <div class="features">
        <ul>
          <li v-for="(feature, index) in ['海量高清壁纸', '电脑/手机/头像', '一键下载保存', '真机预览效果']" :key="index" :style="{ animationDelay: `${index * 0.1}s` }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{{ feature }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.download-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 480px) {
    padding: 16px;
    padding-top: env(safe-area-inset-top, 16px);
    padding-bottom: env(safe-area-inset-bottom, 16px);
  }
}

// 背景动画形状
.bg-shapes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.shape {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 20s infinite ease-in-out;

  &.shape-1 {
    width: 300px;
    height: 300px;
    top: -100px;
    right: -100px;
    animation-delay: 0s;

    @media (max-width: 480px) {
      width: 200px;
      height: 200px;
      top: -60px;
      right: -60px;
    }
  }

  &.shape-2 {
    width: 200px;
    height: 200px;
    bottom: -50px;
    left: -50px;
    animation-delay: -5s;

    @media (max-width: 480px) {
      width: 150px;
      height: 150px;
      bottom: -40px;
      left: -40px;
    }
  }

  &.shape-3 {
    width: 150px;
    height: 150px;
    top: 50%;
    left: 10%;
    animation-delay: -10s;

    @media (max-width: 480px) {
      width: 100px;
      height: 100px;
    }
  }
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(20px, -30px) scale(1.1);
  }
  50% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  75% {
    transform: translate(30px, 10px) scale(1.05);
  }
}

.download-container {
  max-width: 400px;
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 28px 24px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transform: translateY(30px) scale(0.95);
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);

  @media (max-width: 480px) {
    max-width: 100%;
    border-radius: 20px;
    padding: 24px 20px;
  }

  &.show {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.app-header {
  text-align: center;
  margin-bottom: 20px;

  @media (max-width: 480px) {
    margin-bottom: 24px;
  }
}

.app-icon {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto 14px;

  @media (max-width: 480px) {
    width: 88px;
    height: 88px;
    margin-bottom: 16px;
  }

  img {
    width: 100%;
    height: 100%;
    border-radius: 20px;
    object-fit: cover;
    position: relative;
    z-index: 1;
    animation: iconPulse 3s infinite ease-in-out;

    @media (max-width: 480px) {
      border-radius: 22px;
    }
  }

  .icon-glow {
    position: absolute;
    inset: -8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 24px;
    filter: blur(20px);
    opacity: 0.5;
    animation: glowPulse 3s infinite ease-in-out;

    @media (max-width: 480px) {
      inset: -10px;
      border-radius: 28px;
      filter: blur(24px);
    }
  }
}

@keyframes iconPulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

@keyframes glowPulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.app-name {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 4px;

  @media (max-width: 480px) {
    font-size: 26px;
    margin-bottom: 6px;
  }
}

.app-desc {
  font-size: 14px;
  color: #6c757d;

  @media (max-width: 480px) {
    font-size: 15px;
  }
}

.loading-state,
.error-state {
  text-align: center;
  padding: 24px 0;
  color: #6c757d;

  @media (max-width: 480px) {
    padding: 32px 0;
  }
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
  margin-top: 10px;
  padding: 8px 20px;
  background: #6366f1;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    background: #4f46e5;
    transform: scale(1.05);
  }

  @media (max-width: 480px) {
    padding: 12px 28px;
    font-size: 15px;
    border-radius: 10px;
  }
}

.version-info {
  margin-bottom: 16px;

  @media (max-width: 480px) {
    margin-bottom: 20px;
  }
}

.version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  @media (max-width: 480px) {
    margin-bottom: 20px;
  }
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #f0f1ff 0%, #e8e9ff 100%);
  padding: 6px 14px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);

  @media (max-width: 480px) {
    padding: 8px 16px;
  }
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.version-label {
  font-size: 11px;
  color: #6c757d;

  @media (max-width: 480px) {
    font-size: 12px;
  }
}

.version-number {
  font-size: 14px;
  font-weight: 600;
  color: #6366f1;

  @media (max-width: 480px) {
    font-size: 15px;
  }
}

.release-date {
  font-size: 12px;
  color: #adb5bd;

  @media (max-width: 480px) {
    font-size: 13px;
  }
}

.qrcode-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f1ff 100%);
  border-radius: 16px;
}

.qrcode-wrapper {
  position: relative;
  padding: 12px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
}

.qrcode-img {
  display: block;
  width: 160px;
  height: 160px;
  border-radius: 8px;
}

.scan-line {
  position: absolute;
  left: 12px;
  right: 12px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #6366f1, transparent);
  animation: scan 2s infinite ease-in-out;
}

@keyframes scan {
  0%,
  100% {
    top: 12px;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: calc(100% - 14px);
    opacity: 0;
  }
}

.qrcode-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  font-size: 13px;
  color: #6c757d;

  svg {
    width: 16px;
    height: 16px;
    color: #6366f1;
  }
}

.download-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 18px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #ffffff;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  overflow: hidden;

  @media (max-width: 480px) {
    padding: 16px 20px;
    font-size: 17px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(99, 102, 241, 0.45);
  }

  .icon {
    width: 20px;
    height: 20px;

    @media (max-width: 480px) {
      width: 22px;
      height: 22px;
    }
  }

  .btn-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    animation: shine 3s infinite;
  }

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(99, 102, 241, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);

    @media (max-width: 480px) {
      transform: scale(0.98);
    }
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &.is-downloading {
    background: #8b5cf6;
  }
}

@keyframes shine {
  0% {
    left: -100%;
  }
  20%,
  100% {
    left: 100%;
  }
}

.changelog {
  margin-top: 12px;
  padding: 10px 14px;
  background: #f8f9fa;
  border-radius: 10px;
  font-size: 12px;
  color: #6c757d;
  line-height: 1.5;

  @media (max-width: 480px) {
    margin-top: 16px;
    padding: 12px 16px;
    font-size: 13px;
    border-radius: 12px;
  }
}

.features {
  padding-top: 16px;
  border-top: 1px solid #e9ecef;

  @media (max-width: 480px) {
    padding-top: 20px;
  }

  ul {
    list-style: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;

    @media (max-width: 480px) {
      gap: 14px;
    }

    li {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #495057;
      opacity: 0;
      animation: fadeInUp 0.5s forwards;

      @media (max-width: 480px) {
        font-size: 14px;
        gap: 8px;
      }

      svg {
        width: 16px;
        height: 16px;
        color: #10b981;
        flex-shrink: 0;

        @media (max-width: 480px) {
          width: 18px;
          height: 18px;
        }
      }
    }
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
