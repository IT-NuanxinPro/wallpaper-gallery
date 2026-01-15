<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const wallpaperUrl = ref('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80')
const customUrl = ref('')
const fileInput = ref(null)
const isLoaded = ref(false)
const shellLoaded = ref(false)
const currentTime = ref('')

let timeTimer = null
let loadTimer = null

function updateTime() {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekDay = weekDays[now.getDay()]
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${month}月${day}日 ${weekDay} ${hours}:${minutes}:${seconds}`
}

const presets = [
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80',
  'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1200&q=80',
]

function setWallpaper(url) {
  wallpaperUrl.value = url
}

function applyCustomUrl() {
  if (customUrl.value.trim())
    wallpaperUrl.value = customUrl.value.trim()
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file || !file.type.startsWith('image/'))
    return
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result)
      wallpaperUrl.value = e.target.result
  }
  reader.readAsDataURL(file)
}

function onShellLoad() {
  shellLoaded.value = true
}

onMounted(() => {
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
  loadTimer = setTimeout(() => {
    isLoaded.value = true
  }, 300)
})

onUnmounted(() => {
  if (timeTimer)
    clearInterval(timeTimer)
  if (loadTimer)
    clearTimeout(loadTimer)
})
</script>

<template>
  <div class="macbook-demo-page">
    <div class="main-layout">
      <div class="macbook-section" :class="{ loaded: isLoaded }">
        <div class="macbook-wrapper">
          <div class="screen-area">
            <img :src="wallpaperUrl" alt="壁纸" class="wallpaper-img">
            <div class="menu-bar">
              <div class="menu-left">
                <span class="apple-logo" />
                <span class="menu-item active">访达</span>
                <span class="menu-item">文件</span>
                <span class="menu-item">编辑</span>
                <span class="menu-item">显示</span>
                <span class="menu-item">前往</span>
                <span class="menu-item">窗口</span>
                <span class="menu-item">帮助</span>
              </div>
              <div class="menu-right">
                <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z" />
                </svg>
                <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                </svg>
                <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM4 6h4v2H4zm0 3h4v2H4zm0 3h4v2H4z" />
                </svg>
                <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 11h2v2H7v-2zm14-5v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h1V2h2v2h8V2h2v2h1c1.1 0 2 .9 2 2zM5 8h14V6H5v2zm14 12V10H5v10h14zm-4-7h2v-2h-2v2zm-4 0h2v-2h-2v2z" />
                </svg>
                <span class="time">{{ currentTime }}</span>
              </div>
            </div>
          </div>
          <img src="https://dynamicwallpaper.club/landing-vids/mb3.png" alt="MacBook Pro" class="macbook-shell" @load="onShellLoad">
        </div>
      </div>
      <div class="control-section">
        <h1 class="page-title">
          MacBook Pro 真机预览
        </h1>
        <p class="subtitle">
          带有 macOS 界面的真实设备效果
        </p>
        <div class="custom-section">
          <h3>自定义壁纸</h3>
          <div class="upload-methods">
            <div class="upload-card">
              <div class="upload-icon">
                +
              </div>
              <span>本地上传</span>
              <input ref="fileInput" type="file" accept="image/*" class="file-input" @change="handleFileUpload">
              <button class="upload-btn" @click="triggerFileInput">
                选择图片
              </button>
            </div>
            <div class="upload-card">
              <div class="upload-icon">
                @
              </div>
              <span>网络图片</span>
              <input v-model="customUrl" placeholder="输入图片URL" class="url-input" @keyup.enter="applyCustomUrl">
              <button class="upload-btn" @click="applyCustomUrl">
                应用
              </button>
            </div>
          </div>
          <div class="preset-wallpapers">
            <h4>预设壁纸</h4>
            <div class="preset-list">
              <div v-for="(preset, index) in presets" :key="index" class="preset-item" @click="setWallpaper(preset)">
                <img :src="preset.replace('w=1600', 'w=200')" :alt="`预设 ${index + 1}`">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.macbook-demo-page {
  min-height: 100vh;
  padding: 40px 20px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-layout {
  display: flex;
  align-items: center;
  gap: 60px;
  max-width: 1600px;
  width: 100%;
}

.macbook-section {
  flex-shrink: 0;
  opacity: 0;
  transform: scale(0.95);
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  &.loaded {
    opacity: 1;
    transform: scale(1);
  }
}

.control-section {
  flex: 1;
  max-width: 450px;
}

.page-title {
  color: #fff;
  font-size: 36px;
  margin: 0 0 10px 0;
  font-weight: 700;
}

.subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
  margin: 0 0 40px 0;
}

.macbook-wrapper {
  position: relative;
  width: 900px;
}

.macbook-shell {
  display: block;
  width: 100%;
  height: auto;
  position: relative;
  z-index: 1;
  pointer-events: none;
}

.screen-area {
  position: absolute;
  top: 3.1%;
  left: 11.3%;
  width: 77.4%;
  height: 85.5%;
  z-index: 10;
  overflow: hidden;
  border-radius: 3px;
}

.wallpaper-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.menu-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3.8%;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: saturate(180%) blur(20px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.2%;
  font-size: 9px;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  z-index: 20;
  text-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.3);
}

.menu-left {
  display: flex;
  gap: 10px;
  align-items: center;
  .apple-logo::before {
    content: '\f8ff';
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
  }
  .menu-item {
    opacity: 0.85;
    font-weight: 400;
    &.active {
      font-weight: 600;
    }
  }
}

.menu-right {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 9px;
  .menu-icon {
    width: 12px;
    height: 12px;
    opacity: 0.9;
  }
  .time {
    font-weight: 500;
    margin-left: 4px;
    font-variant-numeric: tabular-nums;
  }
}

.custom-section h3 {
  color: #fff;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 500;
}

.upload-methods {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.upload-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 20px;
  width: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
  &:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-3px);
  }
  .upload-icon {
    font-size: 28px;
    color: #667eea;
    font-weight: bold;
  }
  span {
    color: #fff;
    font-size: 14px;
    font-weight: 500;
  }
  .file-input {
    display: none;
  }
  .url-input {
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
    color: #fff;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
    &::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
  }
  .upload-btn {
    width: 100%;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    &:hover {
      transform: scale(1.02);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }
  }
}

.preset-wallpapers {
  margin-top: 25px;
  h4 {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    margin-bottom: 12px;
    font-weight: 400;
  }
}

.preset-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-item {
  width: 70px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  &:hover {
    transform: scale(1.1);
    border-color: #667eea;
  }
}

@media (max-width: 1100px) {
  .main-layout {
    flex-direction: column;
    gap: 40px;
  }
  .macbook-wrapper {
    width: 100%;
    max-width: 600px;
  }
  .control-section {
    text-align: center;
  }
  .upload-methods {
    justify-content: center;
  }
  .preset-list {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .macbook-wrapper {
    max-width: 100%;
  }
  .menu-bar {
    font-size: 8px;
  }
}
</style>
