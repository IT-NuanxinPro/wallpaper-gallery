<script setup>
/**
 * 头像自制入口卡片
 */
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits(['click'])

const isVisible = ref(false)
const isHovered = ref(false)
let entranceTimer = null

onMounted(() => {
  entranceTimer = setTimeout(() => {
    isVisible.value = true
    entranceTimer = null
  }, 400)
})

onUnmounted(() => {
  if (entranceTimer) {
    clearTimeout(entranceTimer)
    entranceTimer = null
  }
})

function handleClick() {
  emit('click')
}
</script>

<template>
  <div
    class="avatar-maker-banner"
    :class="{ 'is-visible': isVisible, 'is-hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="handleClick"
  >
    <div class="banner-bg">
      <div class="bg-gradient" />
      <div class="bg-pattern" />
      <div class="floating-shapes">
        <div class="shape shape-1" />
        <div class="shape shape-2" />
        <div class="shape shape-3" />
      </div>
    </div>

    <div class="banner-content">
      <div class="icon-preview">
        <div class="icon-showcase">
          <div class="icon-item icon-crop">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2v4h12v12h4" />
              <path d="M6 18H2v-4" />
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </div>
          <div class="icon-item icon-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </div>
          <div class="icon-item icon-download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
        </div>
        <div class="sparkles">
          <span class="sparkle sparkle-1">✂️</span>
          <span class="sparkle sparkle-2">📷</span>
          <span class="sparkle sparkle-3">💾</span>
        </div>
      </div>

      <div class="banner-info">
        <div class="badge">
          <span class="badge-icon">✨</span>
          <span class="badge-text">头像工具</span>
        </div>
        <h3 class="banner-title">
          头像自制工具
        </h3>
        <p class="banner-desc">
          上传图片，裁剪调整，一键生成专属头像
        </p>
        <div class="banner-features">
          <span class="feature">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            本地上传
          </span>
          <span class="feature">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            在线链接
          </span>
          <span class="feature">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            圆形/方形
          </span>
        </div>
        <button class="banner-btn">
          <span>开始制作</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.avatar-maker-banner {
  position: relative;
  margin-bottom: $spacing-xl;
  padding: $spacing-xl $spacing-2xl;
  border-radius: $radius-xl;
  overflow: hidden;
  cursor: pointer;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  &.is-hovered {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(16, 185, 129, 0.25);

    .banner-btn {
      background: white;
      color: #10b981;
      transform: scale(1.05);
    }
  }
}

.banner-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #10b981 0%, #059669 50%, #0d9488 100%);
}

.bg-pattern {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.15) 0%, transparent 40%);
}

.floating-shapes {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.shape {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
  background: white;

  &.shape-1 {
    width: 200px;
    height: 200px;
    top: -50px;
    right: -50px;
    animation: float 8s ease-in-out infinite;
  }
  &.shape-2 {
    width: 150px;
    height: 150px;
    bottom: -30px;
    left: 10%;
    animation: float 6s ease-in-out infinite reverse;
  }
  &.shape-3 {
    width: 100px;
    height: 100px;
    top: 50%;
    right: 20%;
    animation: float 10s ease-in-out infinite;
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(10deg);
  }
}

.banner-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: $spacing-2xl;
}

.icon-preview {
  position: relative;
  flex-shrink: 0;
}

.icon-showcase {
  display: flex;
  align-items: center;

  .icon-item {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: white;
    padding: 18px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    animation: bounce 3s ease-in-out infinite;
    color: #10b981;

    svg {
      width: 100%;
      height: 100%;
    }

    &.icon-crop {
      animation-delay: 0s;
      z-index: 3;
    }
    &.icon-avatar {
      animation-delay: 0.5s;
      z-index: 2;
      margin-left: -15px;
    }
    &.icon-download {
      animation-delay: 1s;
      z-index: 1;
      margin-left: -15px;
    }
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.sparkles {
  position: absolute;
  inset: -20px;
  pointer-events: none;

  .sparkle {
    position: absolute;
    font-size: 20px;
    animation: sparkle 2s ease-in-out infinite;

    &.sparkle-1 {
      top: 0;
      left: 10%;
      animation-delay: 0s;
    }
    &.sparkle-2 {
      top: 50%;
      right: -10px;
      animation-delay: 0.7s;
    }
    &.sparkle-3 {
      bottom: 0;
      left: 30%;
      animation-delay: 1.4s;
    }
  }
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.5) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(180deg);
  }
}

.banner-info {
  flex: 1;
  color: white;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $radius-full;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  margin-bottom: $spacing-sm;
  backdrop-filter: blur(10px);

  .badge-icon {
    font-size: 14px;
  }
}

.banner-title {
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  margin-bottom: $spacing-xs;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.banner-desc {
  font-size: $font-size-md;
  opacity: 0.9;
  margin-bottom: $spacing-md;
}

.banner-features {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;

  .feature {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: $font-size-sm;
    opacity: 0.9;

    svg {
      width: 16px;
      height: 16px;
    }
  }
}

.banner-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  border-radius: $radius-full;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  border: 2px solid rgba(255, 255, 255, 0.3);

  svg {
    width: 20px;
    height: 20px;
    transition: transform 0.3s ease;
  }

  &:hover svg {
    transform: translateX(4px);
  }
}
</style>
