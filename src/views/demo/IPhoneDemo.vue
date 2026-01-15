<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const wallpaperUrl = ref('https://images.unsplash.com/photo-1557683316-973673baf926?w=400&h=800&fit=crop')
const customUrl = ref('')
const timeDigits = ref(['0', '0', '0', '0'])
const fileInput = ref(null)

// 灵动岛自动展示状态
const islandExpanded = ref(false)

let timer = null
let islandTimer = null
// 追踪所有 setTimeout，防止内存泄漏
const pendingTimeouts = new Set()

function updateTime() {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  timeDigits.value = [hours[0], hours[1], minutes[0], minutes[1]]
}

// 自动展示灵动岛动画
function autoExpandIsland() {
  islandExpanded.value = true
  const collapseTimer = setTimeout(() => {
    pendingTimeouts.delete(collapseTimer)
    islandExpanded.value = false
  }, 3500)
  pendingTimeouts.add(collapseTimer)
}

function applyCustomUrl() {
  if (customUrl.value) {
    wallpaperUrl.value = customUrl.value
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file)
    return
  if (!file.type.startsWith('image/'))
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result) {
      wallpaperUrl.value = e.target.result
    }
  }
  reader.readAsDataURL(file)
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
  const initTimer = setTimeout(() => {
    pendingTimeouts.delete(initTimer)
    autoExpandIsland()
  }, 2000)
  pendingTimeouts.add(initTimer)
  islandTimer = setInterval(autoExpandIsland, 8000)
})

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
  if (islandTimer)
    clearInterval(islandTimer)
  // 清理所有待执行的 setTimeout
  pendingTimeouts.forEach(t => clearTimeout(t))
  pendingTimeouts.clear()
})
</script>

<template>
  <div class="iphone-demo-page">
    <div class="main-layout">
      <!-- 左侧：手机预览 -->
      <div class="phone-section">
        <div class="iPhone-14-pro light-theme">
          <div class="screen-container">
            <img :src="wallpaperUrl" alt="壁纸">
          </div>

          <div class="dynamic-island" :class="{ expanded: islandExpanded }">
            <div class="caller">
              <div class="avatar" />
              <div class="info">
                <span>iPhone</span>
                <p>库克</p>
              </div>
            </div>
            <div class="actions">
              <div class="refuse">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="14" height="14">
                  <path fill="currentColor" d="M199.232 125.568 90.624 379.008a32 32 0 0 0 6.784 35.2l512.384 512.384a32 32 0 0 0 35.2 6.784l253.44-108.608a32 32 0 0 0 10.048-52.032L769.6 633.92a32 32 0 0 0-36.928-5.952l-130.176 65.088-271.488-271.552 65.024-130.176a32 32 0 0 0-5.952-36.928L251.2 115.52a32 32 0 0 0-51.968 10.048" />
                </svg>
              </div>
              <div class="answer">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="14" height="14">
                  <path fill="currentColor" d="M199.232 125.568 90.624 379.008a32 32 0 0 0 6.784 35.2l512.384 512.384a32 32 0 0 0 35.2 6.784l253.44-108.608a32 32 0 0 0 10.048-52.032L769.6 633.92a32 32 0 0 0-36.928-5.952l-130.176 65.088-271.488-271.552 65.024-130.176a32 32 0 0 0-5.952-36.928L251.2 115.52a32 32 0 0 0-51.968 10.048" />
                </svg>
              </div>
            </div>
          </div>

          <div class="mute-btn" />
          <div class="volume-up-btn" />
          <div class="volume-down-btn" />
          <div class="power-btn" />

          <div class="clock">
            <div>{{ timeDigits[0] }}</div>
            <div>{{ timeDigits[1] }}</div>
            <div class="colon">
              :
            </div>
            <div>{{ timeDigits[2] }}</div>
            <div>{{ timeDigits[3] }}</div>
          </div>

          <div class="home-indicator" />
        </div>
      </div>

      <!-- 右侧：控制面板 -->
      <div class="control-section">
        <h1 class="page-title">
          iPhone 14 Pro 真机预览
        </h1>
        <p class="subtitle">
          带有灵动岛的真实设备效果
        </p>

        <div class="custom-wallpaper-section">
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
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.iphone-demo-page {
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
  gap: 80px;
  max-width: 1200px;
  width: 100%;
}

.phone-section {
  flex-shrink: 0;
}

.control-section {
  flex: 1;
  max-width: 500px;
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

/* iPhone 14 Pro */
.iPhone-14-pro {
  position: relative;
  width: 280px;
  height: 580px;
  background-color: #0e0e0e;
  border: 1px solid #959595;
  border-radius: 45px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow:
    0 0 0 2px #1a1a1a,
    0 0 0 4px #2a2a2a,
    0 25px 50px rgba(0, 0, 0, 0.5);
}

.screen-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 44px;
  overflow: hidden;
  z-index: 1;
  padding: 3px;
  box-sizing: border-box;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 42px;
    display: block;
  }
}

/* 灵动岛 */
.dynamic-island {
  position: absolute;
  top: 18px;
  width: 90px;
  height: 28px;
  background: #000;
  border-radius: 20px;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.expanded {
    width: 180px;
    height: 45px;
    border-radius: 25px;

    .caller {
      opacity: 1;
      visibility: visible;

      .avatar {
        width: 30px;
        height: 30px;
      }

      .info span {
        opacity: 1;
        visibility: visible;
        line-height: 10px;
      }
    }

    .actions {
      opacity: 1;
      visibility: visible;

      .refuse {
        background-color: #ff4438;
        color: #fff;
      }

      .answer {
        background-color: #30d258;
        color: #fff;
      }
    }
  }
}

.caller {
  display: flex;
  align-items: center;
  color: #fff;
  opacity: 0;
  visibility: hidden;
  transition: 0.4s;

  .avatar {
    width: 0;
    height: 0;
    border-radius: 50%;
    background: url('https://photos5.appleinsider.com/gallery/50657-99800-Tim-Cook-xl.jpg') center/cover;
    margin-right: 8px;
    transition: 0.4s;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 3px;

    span {
      font-size: 9px;
      color: #cdcdcd;
      font-weight: 500;
      line-height: 0;
      opacity: 0;
      visibility: hidden;
      transition: 0.4s;
    }

    p {
      font-size: 11px;
      color: #f0f8ff;
      margin: 0;
    }
  }
}

.actions {
  display: flex;
  gap: 10px;
  opacity: 0;
  visibility: hidden;
  transition: 0.4s 0.2s;

  .refuse,
  .answer {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .refuse {
    color: #ff4438;
    transform: rotate(135deg);
  }

  .answer {
    color: #30d258;
  }
}

/* 物理按键 */
.mute-btn,
.volume-up-btn,
.volume-down-btn,
.power-btn {
  position: absolute;
  width: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, #ccc, #666, #222);
}

.mute-btn {
  left: -3px;
  top: 100px;
  height: 22px;
}

.volume-up-btn {
  left: -3px;
  top: 150px;
  height: 45px;
}

.volume-down-btn {
  left: -3px;
  top: 205px;
  height: 45px;
}

.power-btn {
  right: -3px;
  top: 165px;
  height: 75px;
}

/* 时钟 */
.clock {
  position: absolute;
  top: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;

  div {
    font-size: 58px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
    line-height: 1;
    margin: 0 2px;
  }

  .colon {
    position: relative;
    top: -5px;
    margin: 0 4px;
  }
}

.home-indicator {
  position: absolute;
  bottom: 12px;
  width: 40%;
  height: 5px;
  border-radius: 3px;
  z-index: 2;
}

.light-theme {
  .clock {
    color: #333;
  }

  .home-indicator {
    background-color: #333;
  }
}

/* 自定义壁纸区域 */
.custom-wallpaper-section {
  h3 {
    color: #fff;
    margin-bottom: 20px;
    font-size: 18px;
    font-weight: 500;
  }
}

.upload-methods {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.upload-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 20px;
  width: 180px;
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

@media (max-width: 900px) {
  .main-layout {
    flex-direction: column;
    gap: 40px;
  }

  .control-section {
    text-align: center;
  }

  .upload-methods {
    justify-content: center;
  }
}
</style>
