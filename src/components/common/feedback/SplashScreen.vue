<script setup>
import { onMounted, ref } from 'vue'

const emit = defineEmits(['ready'])

const isVisible = ref(true)
const progress = ref(0)
const loadingText = ref('正在加载...')

const loadingSteps = [
  { text: '初始化应用...', duration: 300 },
  { text: '加载资源...', duration: 400 },
  { text: '准备就绪...', duration: 300 },
]

onMounted(async () => {
  let currentProgress = 0

  for (const step of loadingSteps) {
    loadingText.value = step.text
    const targetProgress = currentProgress + (100 / loadingSteps.length)

    // 平滑进度条动画
    await animateProgress(currentProgress, targetProgress, step.duration)
    currentProgress = targetProgress
  }

  // 完成后延迟一下再隐藏
  await new Promise(resolve => setTimeout(resolve, 200))

  isVisible.value = false

  // 动画结束后通知父组件
  setTimeout(() => {
    emit('ready')
  }, 500)
})

function animateProgress(from, to, duration) {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const diff = to - from

    const animate = () => {
      const elapsed = Date.now() - startTime
      const percent = Math.min(elapsed / duration, 1)

      // 使用缓动函数
      const eased = easeOutCubic(percent)
      progress.value = from + diff * eased

      if (percent < 1) {
        requestAnimationFrame(animate)
      }
      else {
        resolve()
      }
    }

    animate()
  })
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}
</script>

<template>
  <Transition name="splash">
    <div v-if="isVisible" class="splash-screen">
      <div class="splash-content">
        <!-- Logo 动画 -->
        <div class="splash-logo">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <h1 class="app-title">
            Wallpaper Gallery
          </h1>
          <p class="app-subtitle">
            精选4K高清壁纸
          </p>
        </div>

        <!-- 加载进度 -->
        <div class="splash-loading">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
          <p class="loading-text">
            {{ loadingText }}
          </p>
        </div>
      </div>

      <!-- 背景装饰 -->
      <div class="splash-bg">
        <div class="bg-circle bg-circle-1" />
        <div class="bg-circle bg-circle-2" />
        <div class="bg-circle bg-circle-3" />
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.splash-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

.splash-content {
  position: relative;
  z-index: 2;
  text-align: center;
  color: white;
}

.splash-logo {
  margin-bottom: 60px;
  animation: fadeInUp 0.8s ease-out;
}

.logo-icon {
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);

  svg {
    width: 64px;
    height: 64px;
    color: white;
  }
}

.app-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.app-subtitle {
  font-size: 16px;
  font-weight: 400;
  margin: 0;
  opacity: 0.9;
  letter-spacing: 2px;
}

.splash-loading {
  animation: fadeInUp 0.8s ease-out 0.2s both;
}

.progress-bar {
  width: 300px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin: 0 auto 16px;
}

.progress-fill {
  height: 100%;
  background: white;
  border-radius: 2px;
  transition: width 0.3s ease-out;
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
}

.loading-text {
  font-size: 14px;
  margin: 0;
  opacity: 0.8;
  font-weight: 500;
}

// 背景装饰
.splash-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  overflow: hidden;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 20s infinite ease-in-out;
}

.bg-circle-1 {
  width: 400px;
  height: 400px;
  top: -200px;
  left: -200px;
  animation-delay: 0s;
}

.bg-circle-2 {
  width: 300px;
  height: 300px;
  bottom: -150px;
  right: -150px;
  animation-delay: -7s;
}

.bg-circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  right: 10%;
  animation-delay: -14s;
}

// 动画
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(-10deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

// 过渡动画
.splash-enter-active {
  transition: opacity 0.3s ease;
}

.splash-leave-active {
  transition: opacity 0.5s ease;
}

.splash-enter-from,
.splash-leave-to {
  opacity: 0;
}
</style>
