<script setup>
import { ElMessage } from 'element-plus'
import { useElectronUpdate } from '@/composables/useElectronUpdate'

const {
  hasAppUpdate,
  hasDataUpdate,
  appUpdateInfo,
  dataUpdateInfo,
  updateWallpaperData,
  openDownloadPage,
  dismissAppUpdate,
  dismissDataUpdate,
} = useElectronUpdate()

// 更新壁纸数据
async function handleDataUpdate() {
  const result = await updateWallpaperData()

  if (result.success) {
    ElMessage({
      message: result.message,
      type: 'success',
      duration: 5000,
      offset: 100,
    })
  }
  else {
    ElMessage({
      message: `更新失败: ${result.message}`,
      type: 'error',
      duration: 5000,
      offset: 100,
    })
  }
}
</script>

<template>
  <!-- 应用版本更新通知 -->
  <Transition name="slide-down">
    <div v-if="hasAppUpdate" class="update-notification app-update">
      <div class="update-content">
        <div class="update-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div class="update-info">
          <p class="update-title">
            <span class="sparkle">✨</span>
            发现新版本
            <span class="version-badge">{{ appUpdateInfo?.latest }}</span>
          </p>
          <p class="update-desc">
            {{ appUpdateInfo?.changelog || '新版本已发布，建议更新以获得更好的体验' }}
          </p>
        </div>
        <div class="update-actions">
          <button class="btn-update" @click="openDownloadPage">
            下载更新
          </button>
          <button class="btn-dismiss" @click="dismissAppUpdate">
            稍后提醒
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- 壁纸数据更新通知 -->
  <Transition name="slide-down">
    <div v-if="hasDataUpdate" class="update-notification data-update">
      <div class="update-content">
        <div class="update-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <div class="update-info">
          <p class="update-title">
            <span class="sparkle">🎨</span>
            壁纸数据已更新
            <span class="version-badge">{{ dataUpdateInfo?.latest }}</span>
          </p>
          <p class="update-desc">
            {{ dataUpdateInfo?.changelog || '发现新的壁纸内容，立即更新查看最新壁纸' }}
          </p>
        </div>
        <div class="update-actions">
          <button class="btn-update" @click="handleDataUpdate">
            立即更新
          </button>
          <button class="btn-dismiss" @click="dismissDataUpdate">
            稍后提醒
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.update-notification {
  position: fixed;
  top: calc(var(--titlebar-height) + var(--header-height) + 20px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: 600px;
  width: calc(100% - 40px);
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.98);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  }

  &.app-update {
    border-left: 4px solid #667eea;
  }

  &.data-update {
    border-left: 4px solid #10b981;
  }
}

.update-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.update-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;

  .data-update & {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }

  svg {
    width: 24px;
    height: 24px;
  }
}

.update-info {
  flex: 1;
  min-width: 0;
}

.update-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;

  .sparkle {
    font-size: 18px;
  }
}

.version-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;

  .data-update & {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }
}

.update-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.update-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.btn-update,
.btn-dismiss {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 200ms;
  white-space: nowrap;
}

.btn-update {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;

  .data-update & {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);

    .data-update & {
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }
  }

  &:active {
    transform: translateY(0);
  }
}

.btn-dismiss {
  background: transparent;
  color: var(--color-text-secondary);

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }
}

// 动画
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

// 移动端适配
@include mobile-only {
  .update-notification {
    top: calc(var(--titlebar-height) + 60px);
    width: calc(100% - 20px);
  }

  .update-content {
    flex-direction: column;
    text-align: center;
  }

  .update-actions {
    width: 100%;

    button {
      width: 100%;
    }
  }
}
</style>
