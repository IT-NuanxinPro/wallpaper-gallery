<script setup>
import { computed, ref } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import { useYimenApp } from '@/composables/useYimenApp'
import { downloadFile } from '@/utils/format'
import { checkStoragePermission, downloadImageToAppDir, openAppSettings, requestPermissions, saveImageToAlbum, showToast } from '@/utils/yimenBridge'

const props = defineProps({
  wallpaper: {
    type: Object,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  size: {
    type: String,
    default: 'md', // sm, md, lg
    validator: value => ['sm', 'md', 'lg'].includes(value),
  },
  variant: {
    type: String,
    default: 'primary', // primary, secondary
    validator: value => ['primary', 'secondary'].includes(value),
  },
  downloadMode: {
    type: String,
    default: 'album', // album, app, both
    validator: value => ['album', 'app', 'both'].includes(value),
  },
})

const emit = defineEmits(['downloadStart', 'downloadSuccess', 'downloadError'])

const { inApp } = useYimenApp()
const downloading = ref(false)

// 按钮文本
const buttonText = computed(() => {
  if (downloading.value) {
    return inApp.value ? '保存中...' : '下载中...'
  }

  if (inApp.value) {
    switch (props.downloadMode) {
      case 'album':
        return '保存到相册'
      case 'app':
        return '下载到应用'
      case 'both':
        return '保存壁纸'
      default:
        return '保存到相册'
    }
  }

  return '下载壁纸'
})

// 按钮图标
const buttonIcon = computed(() => {
  if (inApp.value) {
    switch (props.downloadMode) {
      case 'album':
        return 'album' // 相册图标
      case 'app':
        return 'folder' // 文件夹图标
      case 'both':
        return 'download' // 下载图标
      default:
        return 'album'
    }
  }
  return 'download' // 下载图标
})

// 处理下载
async function handleDownload() {
  if (!props.wallpaper || downloading.value || props.disabled) {
    return
  }

  downloading.value = true
  emit('downloadStart')

  try {
    // 如果在 App 环境中，先检查权限
    if (inApp.value) {
      const hasPermission = await checkStoragePermission()

      if (!hasPermission) {
        // 请求权限
        const permissionResult = await requestPermissions(['WRITE_EXTERNAL_STORAGE'])

        if (!permissionResult.granted) {
          showToast('需要存储权限才能保存图片')

          // 询问用户是否打开设置
          // eslint-disable-next-line no-alert
          const shouldOpenSettings = confirm('需要存储权限才能保存图片，是否前往设置页面开启权限？')
          if (shouldOpenSettings) {
            await openAppSettings()
          }

          downloading.value = false
          emit('downloadError', new Error('权限被拒绝'))
          return
        }
      }

      // 根据下载模式执行不同的操作
      let albumResult = null
      let appResult = null

      if (props.downloadMode === 'album' || props.downloadMode === 'both') {
        albumResult = await saveImageToAlbum(props.wallpaper.url, props.wallpaper.filename)
      }

      if (props.downloadMode === 'app' || props.downloadMode === 'both') {
        appResult = await downloadImageToAppDir(props.wallpaper.url, props.wallpaper.filename)
      }

      // 处理结果
      if (props.downloadMode === 'both') {
        const albumSuccess = albumResult?.success || false
        const appSuccess = appResult?.success || false

        if (albumSuccess && appSuccess) {
          showToast('图片已保存到相册和应用目录')
        }
        else if (albumSuccess) {
          showToast('图片已保存到相册，应用目录保存失败')
        }
        else if (appSuccess) {
          showToast('图片已保存到应用目录，相册保存失败')
        }
        else {
          showToast('保存失败，请重试')
          throw new Error('保存失败')
        }
      }
      else if (props.downloadMode === 'album') {
        if (albumResult?.success) {
          showToast(albumResult.message)
        }
        else {
          showToast(albumResult?.message || '保存到相册失败')
          throw new Error(albumResult?.message || '保存失败')
        }
      }
      else if (props.downloadMode === 'app') {
        if (appResult?.success) {
          showToast(appResult.message)
        }
        else {
          showToast(appResult?.message || '保存到应用目录失败')
          throw new Error(appResult?.message || '保存失败')
        }
      }
    }
    else {
      // 浏览器环境，使用传统下载
      await downloadFile(props.wallpaper.url, props.wallpaper.filename)
    }

    emit('downloadSuccess', props.wallpaper)
  }
  catch (error) {
    console.error('下载失败:', error)
    emit('downloadError', error)

    if (inApp.value) {
      showToast('下载失败，请重试')
    }
  }
  finally {
    downloading.value = false
  }
}
</script>

<template>
  <button
    class="download-btn"
    :class="[
      `download-btn--${size}`,
      `download-btn--${variant}`,
      { 'download-btn--downloading': downloading },
    ]"
    :disabled="disabled || downloading"
    @click="handleDownload"
  >
    <!-- 加载状态 -->
    <LoadingSpinner v-if="downloading" :size="size === 'sm' ? 'xs' : 'sm'" />

    <!-- 相册图标 (App 环境 - 相册模式) -->
    <svg
      v-else-if="buttonIcon === 'album'"
      class="download-btn__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>

    <!-- 文件夹图标 (App 环境 - 应用目录模式) -->
    <svg
      v-else-if="buttonIcon === 'folder'"
      class="download-btn__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>

    <!-- 下载图标 (浏览器环境或混合模式) -->
    <svg
      v-else
      class="download-btn__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>

    <span class="download-btn__text">{{ buttonText }}</span>

    <!-- 按钮光效 -->
    <div class="download-btn__shine" />
  </button>
</template>

<style lang="scss" scoped>
.download-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  overflow: hidden;

  &__icon {
    flex-shrink: 0;
  }

  &__text {
    white-space: nowrap;
  }

  &__shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    animation: shine 3s infinite;
  }

  // 尺寸变体
  &--sm {
    padding: 8px 12px;
    font-size: 13px;

    .download-btn__icon {
      width: 16px;
      height: 16px;
    }
  }

  &--md {
    padding: 12px 16px;
    font-size: 14px;

    .download-btn__icon {
      width: 18px;
      height: 18px;
    }
  }

  &--lg {
    padding: 16px 20px;
    font-size: 16px;

    .download-btn__icon {
      width: 20px;
      height: 20px;
    }
  }

  // 样式变体
  &--primary {
    background: linear-gradient(135deg, var(--color-accent) 0%, #8b5cf6 100%);
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  }

  &--secondary {
    background: var(--color-bg-card);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);

    &:hover:not(:disabled) {
      background: var(--color-bg-hover);
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
  }

  // 下载状态
  &--downloading {
    opacity: 0.8;
    cursor: not-allowed;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
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

// 移动端适配
@media (max-width: 480px) {
  .download-btn {
    &--md {
      padding: 14px 18px;
      font-size: 15px;
    }

    &--lg {
      padding: 18px 24px;
      font-size: 17px;
    }
  }
}
</style>
