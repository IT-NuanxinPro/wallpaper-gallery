<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const STORAGE_KEY = 'announcement_banner_closed_v1'
const isVisible = ref(false)
const isClosing = ref(false)
let closeTimer = null // 关闭动画定时器

onMounted(() => {
  // 检查用户是否之前关闭过横幅
  const closed = localStorage.getItem(STORAGE_KEY)
  if (closed !== 'true') {
    isVisible.value = true
  }
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
})

function closeBanner() {
  // 先播放关闭动画
  isClosing.value = true
  // 动画结束后隐藏并保存状态
  closeTimer = setTimeout(() => {
    closeTimer = null
    isVisible.value = false
    localStorage.setItem(STORAGE_KEY, 'true')
  }, 300)
}
</script>

<template>
  <div
    v-if="isVisible"
    class="announcement-wrapper"
    :class="{ 'is-closing': isClosing }"
  >
    <div class="announcement-banner">
      <!-- 左侧图标 -->
      <div class="banner-icon">
        <span class="icon-emoji">📢</span>
      </div>

      <!-- 文案内容 -->
      <div class="banner-content">
        <!-- PC端文案 -->
        <p class="banner-text desktop-text">
          <strong>欢迎来到壁纸画廊！</strong>
          目前收录博主精选高质量壁纸，<span class="highlight">持续更新</span>中。
          PC/手机均可访问，记得收藏哦~
        </p>
        <!-- 移动端文案（更简洁） -->
        <p class="banner-text mobile-text">
          <strong>欢迎！</strong>
          精选壁纸<span class="highlight">定期更新</span>，记得收藏~
          <span class="tag">表情包即将上线</span>
        </p>
      </div>

      <!-- 关闭按钮 -->
      <button class="close-btn" aria-label="关闭通知" @click="closeBanner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.announcement-wrapper {
  overflow: hidden;
  transition: all 0.3s ease-out;
  max-height: 200px;
  opacity: 1;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    margin-bottom: 16px;
  }

  &.is-closing {
    max-height: 0;
    opacity: 0;
    margin-bottom: 0;
  }
}

.announcement-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;

  @media (max-width: 768px) {
    padding: 12px 14px;
    gap: 10px;
    border-radius: var(--radius-md);
  }

  &:hover {
    box-shadow: var(--shadow-md);
  }
}

.banner-icon {
  flex-shrink: 0;

  .icon-emoji {
    font-size: 24px;
    display: block;
    animation: shake 2s ease-in-out infinite;

    @media (max-width: 768px) {
      font-size: 20px;
    }
  }
}

@keyframes shake {
  0%,
  100% {
    transform: rotate(0deg);
  }
  5%,
  15% {
    transform: rotate(-8deg);
  }
  10%,
  20% {
    transform: rotate(8deg);
  }
  25% {
    transform: rotate(0deg);
  }
}

.banner-content {
  flex: 1;
  min-width: 0;
}

.banner-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary);

  @media (max-width: 768px) {
    font-size: 13px;
    line-height: 1.5;
  }

  strong {
    color: var(--color-accent);
    font-weight: 600;
  }

  .highlight {
    color: var(--color-accent);
    font-weight: 500;
  }

  .tag {
    display: inline-block;
    background: linear-gradient(135deg, var(--color-accent) 0%, #8b5cf6 100%);
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    margin-left: 4px;

    @media (max-width: 768px) {
      font-size: 11px;
      padding: 1px 6px;
      margin-left: 2px;
    }
  }
}

// PC端显示完整文案，移动端隐藏
.desktop-text {
  display: block;

  @media (max-width: 768px) {
    display: none;
  }
}

// 移动端显示简洁文案，PC端隐藏
.mobile-text {
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
}

.close-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  background: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  @media (max-width: 768px) {
    width: 24px;
    height: 24px;
  }

  svg {
    width: 16px;
    height: 16px;

    @media (max-width: 768px) {
      width: 14px;
      height: 14px;
    }
  }

  &:hover {
    background: var(--color-accent);
    color: white;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>
