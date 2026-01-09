<script setup>
import { Capacitor } from '@capacitor/core'
import { computed } from 'vue'
import { useAppUpdate } from '@/composables/useAppUpdate'

const { hasUpdate, latestVersion, changelog, currentVersion, goToDownload } = useAppUpdate()

const isNative = Capacitor.isNativePlatform()

const versionDisplay = computed(() => {
  if (!latestVersion.value)
    return ''
  return `v${latestVersion.value}`
})

const changelogLines = computed(() => {
  if (!changelog.value)
    return []
  return changelog.value.split('\n').filter(line => line.trim())
})

function handleUpdate() {
  goToDownload()
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="hasUpdate && isNative" class="app-update-dialog">
      <div class="update-card">
        <div class="card-bg">
          <div class="bg-gradient" />
          <div class="bg-glow" />
        </div>

        <div class="card-content">
          <div class="update-icon">
            <div class="icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L12 12M12 12L8 8M12 12L16 8" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M4 14V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V14" stroke-linecap="round" />
              </svg>
            </div>
            <div class="icon-pulse" />
          </div>

          <div class="update-info">
            <p class="update-title">
              <span class="sparkle">✨</span>
              发现新版本
              <span class="version-badge">{{ versionDisplay }}</span>
            </p>
            <p class="update-desc">
              当前版本 v{{ currentVersion }}，请更新到最新版本
            </p>
            <div v-if="changelogLines.length > 0" class="changelog">
              <p v-for="(line, index) in changelogLines" :key="index" class="changelog-line">
                {{ line }}
              </p>
            </div>
          </div>

          <div class="update-actions">
            <button class="btn-update" @click="handleUpdate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round" />
                <polyline points="7 10 12 15 17 10" stroke-linecap="round" stroke-linejoin="round" />
                <line x1="12" y1="15" x2="12" y2="3" stroke-linecap="round" />
              </svg>
              <span>立即更新</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.app-update-dialog {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: calc(100% - 32px);
  max-width: 520px;

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

.card-bg {
  position: absolute;
  inset: 0;
  z-index: 0;

  .bg-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.95) 0%,
      rgba(249, 115, 22, 0.95) 50%,
      rgba(239, 68, 68, 0.95) 100%
    );

    [data-theme='dark'] & {
      background: linear-gradient(
        135deg,
        rgba(217, 119, 6, 0.95) 0%,
        rgba(234, 88, 12, 0.95) 50%,
        rgba(220, 38, 38, 0.95) 100%
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

.card-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;

  @media (max-width: 768px) {
    padding: 16px 18px;
    gap: 12px;
  }
}

.update-icon {
  position: relative;
  flex-shrink: 0;

  .icon-circle {
    width: 48px;
    height: 48px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;

    @media (max-width: 768px) {
      width: 42px;
      height: 42px;
      border-radius: 10px;
    }

    svg {
      width: 24px;
      height: 24px;
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

.update-info {
  flex: 1;
  min-width: 0;
}

.update-title {
  margin: 0 0 6px 0;
  font-size: 16px;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    font-size: 15px;
    gap: 5px;
  }

  .sparkle {
    font-size: 15px;
    animation: sparkle 1.5s ease-in-out infinite;

    @media (max-width: 768px) {
      font-size: 14px;
    }
  }

  .version-badge {
    display: inline-flex;
    padding: 2px 10px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;

    @media (max-width: 768px) {
      padding: 2px 8px;
      font-size: 12px;
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
  margin: 0 0 8px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;

  @media (max-width: 768px) {
    font-size: 12px;
  }
}

.changelog {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 8px 12px;

  @media (max-width: 768px) {
    padding: 6px 10px;
  }
}

.changelog-line {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.6;

  @media (max-width: 768px) {
    font-size: 11px;
  }

  &:not(:last-child) {
    margin-bottom: 4px;
  }
}

.update-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    gap: 6px;
  }
}

.btn-update {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #f59e0b;
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
