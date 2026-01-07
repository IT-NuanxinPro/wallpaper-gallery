<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { trackDiyAvatarClick } from '@/utils/analytics'

const isVisible = ref(false)
const isHovered = ref(false)
let entranceTimer = null // 入场动画定时器

// 动画入场
onMounted(() => {
  entranceTimer = setTimeout(() => {
    isVisible.value = true
    entranceTimer = null
  }, 300)
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (entranceTimer) {
    clearTimeout(entranceTimer)
    entranceTimer = null
  }
})

function handleClick() {
  // 追踪点击事件
  trackDiyAvatarClick()
  window.open('http://diyavatar.061129.xyz/', '_blank')
}
</script>

<template>
  <div
    class="diy-avatar-banner"
    :class="{ 'is-visible': isVisible, 'is-hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="handleClick"
  >
    <!-- 背景装饰 -->
    <div class="banner-bg">
      <div class="bg-gradient" />
      <div class="bg-pattern" />
      <div class="floating-shapes">
        <div class="shape shape-1" />
        <div class="shape shape-2" />
        <div class="shape shape-3" />
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="banner-content">
      <!-- 左侧：头像预览动画 -->
      <div class="avatar-preview">
        <div class="avatar-showcase">
          <!-- 动态头像展示 -->
          <div class="avatar-item avatar-1">
            <svg viewBox="0 0 100 100" class="avatar-svg">
              <circle cx="50" cy="50" r="45" fill="#FFE0BD" />
              <circle cx="35" cy="40" r="5" fill="#333" />
              <circle cx="65" cy="40" r="5" fill="#333" />
              <path d="M 35 60 Q 50 75 65 60" stroke="#333" stroke-width="3" fill="none" />
              <path d="M 20 25 Q 50 5 80 25 Q 75 15 50 10 Q 25 15 20 25" fill="#8B4513" />
            </svg>
          </div>
          <div class="avatar-item avatar-2">
            <svg viewBox="0 0 100 100" class="avatar-svg">
              <circle cx="50" cy="50" r="45" fill="#F5D0C5" />
              <circle cx="35" cy="40" r="5" fill="#333" />
              <circle cx="65" cy="40" r="5" fill="#333" />
              <ellipse cx="50" cy="62" rx="8" ry="5" fill="#FF6B6B" />
              <path d="M 15 30 Q 30 10 50 15 Q 70 10 85 30 L 80 35 Q 65 20 50 22 Q 35 20 20 35 Z" fill="#2C3E50" />
            </svg>
          </div>
          <div class="avatar-item avatar-3">
            <svg viewBox="0 0 100 100" class="avatar-svg">
              <circle cx="50" cy="50" r="45" fill="#DEB887" />
              <path d="M 30 42 L 40 38 L 40 42" stroke="#333" stroke-width="2" fill="none" />
              <path d="M 70 42 L 60 38 L 60 42" stroke="#333" stroke-width="2" fill="none" />
              <circle cx="35" cy="42" r="4" fill="#333" />
              <circle cx="65" cy="42" r="4" fill="#333" />
              <path d="M 40 60 Q 50 68 60 60" stroke="#333" stroke-width="2" fill="none" />
              <ellipse cx="50" cy="20" rx="35" ry="15" fill="#FF69B4" />
            </svg>
          </div>
        </div>
        <!-- 装饰元素 -->
        <div class="sparkles">
          <span class="sparkle sparkle-1">✨</span>
          <span class="sparkle sparkle-2">⭐</span>
          <span class="sparkle sparkle-3">✨</span>
        </div>
      </div>

      <!-- 右侧：文字信息 -->
      <div class="banner-info">
        <div class="badge">
          <span class="badge-icon">🎨</span>
          <span class="badge-text">新功能</span>
        </div>
        <h3 class="banner-title">
          DIY 卡通头像生成器
        </h3>
        <p class="banner-desc">
          自定义五官、发型、配饰，打造专属个性头像
        </p>
        <div class="banner-features">
          <span class="feature">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            多种风格
          </span>
          <span class="feature">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            一键导出
          </span>
          <span class="feature">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            完全免费
          </span>
        </div>
        <button class="banner-btn">
          <span>立即体验</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.diy-avatar-banner {
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
    box-shadow: 0 20px 40px rgba(99, 102, 241, 0.25);

    .banner-btn {
      background: white;
      color: #6366f1;
      transform: scale(1.05);
    }
  }

  @include mobile-only {
    padding: $spacing-md $spacing-sm;
    margin-bottom: $spacing-md;
  }
}

// 背景
.banner-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
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

// 内容
.banner-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: $spacing-2xl;

  @include mobile-only {
    flex-direction: row;
    gap: $spacing-sm;
    align-items: center;
  }
}

// 头像预览
.avatar-preview {
  position: relative;
  flex-shrink: 0;
}

.avatar-showcase {
  display: flex;
  align-items: center;
  gap: -20px;

  .avatar-item {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: white;
    padding: 4px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    animation: bounce 3s ease-in-out infinite;

    &.avatar-1 {
      animation-delay: 0s;
      z-index: 3;
    }

    &.avatar-2 {
      animation-delay: 0.5s;
      z-index: 2;
      margin-left: -15px;
    }

    &.avatar-3 {
      animation-delay: 1s;
      z-index: 1;
      margin-left: -15px;
    }

    @include mobile-only {
      width: 44px;
      height: 44px;
      padding: 2px;

      &.avatar-2,
      &.avatar-3 {
        margin-left: -12px;
      }
    }
  }

  .avatar-svg {
    width: 100%;
    height: 100%;
    border-radius: 50%;
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

  @include mobile-only {
    display: none;
  }

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

// 文字信息
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

  @include mobile-only {
    padding: 4px 8px;
    gap: 4px;
    margin-bottom: $spacing-xs;

    .badge-icon {
      font-size: 12px;
    }
  }
}

.banner-title {
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  margin-bottom: $spacing-xs;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

  @include mobile-only {
    font-size: $font-size-md;
    margin-bottom: 2px;
  }
}

.banner-desc {
  font-size: $font-size-md;
  opacity: 0.9;
  margin-bottom: $spacing-md;

  @include mobile-only {
    font-size: $font-size-xs;
    margin-bottom: $spacing-xs;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
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

  @include mobile-only {
    display: none;
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

  @include mobile-only {
    padding: 6px 12px;
    font-size: $font-size-xs;
    gap: 4px;
    border-width: 1px;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}
</style>
