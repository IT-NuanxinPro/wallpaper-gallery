<script setup>
/**
 * 更新通知组件
 * - 底部弹出的优雅通知条
 * - 支持点击刷新或忽略
 * - 带有流畅的进入/退出动画
 */

import { computed } from 'vue'
import { useVersionCheck } from '@/composables/useVersionCheck'

const { hasNewVersion, newVersionInfo, forceRefresh, dismissUpdate } = useVersionCheck()

// 格式化版本号显示
const versionDisplay = computed(() => {
  if (!newVersionInfo.value)
    return ''
  return `v${newVersionInfo.value.latest}`
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="hasNewVersion" class="update-notification">
      <div class="update-card">
        <!-- 背景装饰 -->
        <div class="card-bg">
          <div class="bg-gradient" />
          <div class="bg-glow" />
        </div>

        <!-- 内容区域 -->
        <div class="card-content">
          <!-- 图标 -->
          <!-- <div class="update-icon">
            <div class="icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L12 12M12 12L8 8M12 12L16 8" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M4 14V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V14" stroke-linecap="round" />
              </svg>
            </div>
            <div class="icon-pulse" />
          </div> -->

          <!-- 文字信息 -->
          <div class="update-info">
            <p class="update-title">
              <span class="sparkle">✨</span>
              发现新版本
              <span class="version-badge">{{ versionDisplay }}</span>
            </p>
            <p class="update-desc">
              新内容已就绪，刷新页面即可获取
            </p>
          </div>

          <!-- 操作按钮 -->
          <div class="update-actions">
            <button class="btn-refresh" @click="forceRefresh">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4V10H7" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M3.51 15C4.16 17.96 6.74 20.5 10 21C14.42 21.67 18.5 18.5 19.5 14" stroke-linecap="round" />
                <path d="M23 20V14H17" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M20.49 9C19.84 6.04 17.26 3.5 14 3C9.58 2.33 5.5 5.5 4.5 10" stroke-linecap="round" />
              </svg>
              <span>立即刷新</span>
            </button>
            <button class="btn-dismiss" aria-label="稍后再说" @click="dismissUpdate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.update-notification {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: calc(100% - 32px);
  max-width: 480px;

  @media (max-width: 768px) {
    bottom: 16px;
    width: calc(100% - 24px);
    max-width: none;
  }
}

.update-card {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  @media (max-width: 768px) {
    border-radius: 14px;
  }
}

// 背景装饰
.card-bg {
  position: absolute;
  inset: 0;
  z-index: 0;

  .bg-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.95) 0%,
      rgba(139, 92, 246, 0.95) 50%,
      rgba(168, 85, 247, 0.95) 100%
    );

    // 深色模式适配
    [data-theme='dark'] & {
      background: linear-gradient(
        135deg,
        rgba(79, 70, 229, 0.95) 0%,
        rgba(109, 40, 217, 0.95) 50%,
        rgba(139, 92, 246, 0.95) 100%
      );
    }
  }

  .bg-glow {
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
    animation: glow-move 8s ease-in-out infinite;
  }
}

@keyframes glow-move {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(10%, 10%);
  }
}

// 内容区域
.card-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;

  @media (max-width: 768px) {
    padding: 14px 16px;
    gap: 12px;
  }
}

// 图标
.update-icon {
  position: relative;
  flex-shrink: 0;

  .icon-circle {
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;

    @media (max-width: 768px) {
      width: 40px;
      height: 40px;
      border-radius: 10px;
    }

    svg {
      width: 22px;
      height: 22px;
      animation: bounce-gentle 2s ease-in-out infinite;

      @media (max-width: 768px) {
        width: 20px;
        height: 20px;
      }
    }
  }

  .icon-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.3);
    animation: pulse-ring 2s ease-out infinite;

    @media (max-width: 768px) {
      border-radius: 12px;
    }
  }
}

@keyframes bounce-gentle {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.3);
    opacity: 0;
  }
}

// 文字信息
.update-info {
  flex: 1;
  min-width: 0;
}

.update-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    font-size: 14px;
    gap: 5px;
  }

  .sparkle {
    font-size: 14px;
    animation: sparkle 1.5s ease-in-out infinite;

    @media (max-width: 768px) {
      font-size: 13px;
    }
  }

  .version-badge {
    display: inline-flex;
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;

    @media (max-width: 768px) {
      padding: 2px 6px;
      font-size: 11px;
    }
  }
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.update-desc {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;

  @media (max-width: 768px) {
    font-size: 12px;
  }
}

// 操作按钮
.update-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    gap: 6px;
  }
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #6366f1;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  @media (max-width: 768px) {
    padding: 8px 12px;
    font-size: 13px;
    border-radius: 8px;
    gap: 5px;
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
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
  }
}

.btn-dismiss {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 0.2s ease;

  @media (max-width: 768px) {
    width: 32px;
    height: 32px;
    border-radius: 6px;
  }

  svg {
    width: 18px;
    height: 18px;

    @media (max-width: 768px) {
      width: 16px;
      height: 16px;
    }
  }

  &:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}

// 进入/退出动画
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(100%);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px) scale(0.95);
}
</style>
