<script setup>
/**
 * 图片来源面板 - 本地上传/在线链接
 */
import { computed, ref } from 'vue'
import { SUPPORTED_IMAGE_EXTENSIONS, validateImageFile, validateImageUrl } from '@/utils/avatar-maker'

defineProps({
  currentSource: { type: String, default: null },
  isLoading: { type: Boolean, default: false },
  error: { type: String, default: null },
})

const emit = defineEmits(['selectFile', 'submitUrl', 'clear'])

const activeTab = ref('upload')
const urlInput = ref('')
const urlError = ref('')
const isDragging = ref(false)
const fileInputRef = ref(null)

const acceptedTypes = computed(() =>
  SUPPORTED_IMAGE_EXTENSIONS.map(ext => `.${ext}`).join(','),
)

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (file)
    processFile(file)
  event.target.value = ''
}

function handleDragEnter(event) {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = true
}

function handleDragLeave(event) {
  event.preventDefault()
  event.stopPropagation()
  if (!event.currentTarget.contains(event.relatedTarget)) {
    isDragging.value = false
  }
}

function handleDragOver(event) {
  event.preventDefault()
  event.stopPropagation()
}

function handleDrop(event) {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file)
    processFile(file)
}

function processFile(file) {
  const result = validateImageFile(file)
  if (!result.valid) {
    urlError.value = result.error
    return
  }
  urlError.value = ''
  emit('selectFile', file)
}

function handleUrlSubmit() {
  const url = urlInput.value.trim()
  if (!url) {
    urlError.value = '请输入图片链接'
    return
  }
  if (!validateImageUrl(url)) {
    urlError.value = '请输入有效的图片链接（http:// 或 https://）'
    return
  }
  urlError.value = ''
  emit('submitUrl', url)
}

function handleUrlInput() {
  if (urlError.value)
    urlError.value = ''
}

function handleUrlKeydown(event) {
  if (event.key === 'Enter')
    handleUrlSubmit()
}

function switchTab(tab) {
  activeTab.value = tab
  urlError.value = ''
}
</script>

<template>
  <div class="image-source-panel">
    <div class="source-tabs">
      <button class="source-tab" :class="{ active: activeTab === 'upload' }" @click="switchTab('upload')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <span>本地上传</span>
      </button>
      <button class="source-tab" :class="{ active: activeTab === 'url' }" @click="switchTab('url')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
        <span>在线链接</span>
      </button>
    </div>

    <div class="source-content">
      <div v-show="activeTab === 'upload'" class="upload-panel">
        <div
          class="upload-dropzone"
          :class="{ 'is-dragging': isDragging, 'is-loading': isLoading }"
          @click="triggerFileSelect"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
          @dragover="handleDragOver"
          @drop="handleDrop"
        >
          <input ref="fileInputRef" type="file" :accept="acceptedTypes" class="upload-input" @change="handleFileChange">

          <div v-if="isLoading" class="upload-loading">
            <span class="loading-spinner" />
            <span>正在加载图片...</span>
          </div>

          <template v-else>
            <div class="upload-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="upload-title">
              {{ isDragging ? '松开鼠标上传' : '点击或拖拽图片到此处' }}
            </p>
            <p class="upload-hint">
              支持 JPG、PNG、GIF、WebP 格式，最大 10MB
            </p>
          </template>
        </div>
      </div>

      <div v-show="activeTab === 'url'" class="url-panel">
        <div class="url-input-wrapper">
          <div class="url-input-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <input
            v-model="urlInput"
            type="url"
            class="url-input"
            placeholder="请输入图片链接..."
            :disabled="isLoading"
            @input="handleUrlInput"
            @keydown="handleUrlKeydown"
          >
          <button class="url-submit-btn" :disabled="isLoading || !urlInput.trim()" @click="handleUrlSubmit">
            <span v-if="isLoading" class="loading-spinner loading-spinner--small" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p class="url-hint">
          粘贴图片的网络地址，支持 http:// 或 https:// 链接
        </p>
      </div>

      <Transition name="error-fade">
        <div v-if="error || urlError" class="source-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{{ error || urlError }}</span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.image-source-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 450px;
  margin: 0 auto;
}

.source-tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 32px;
}

.source-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover:not(.active) {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    color: #fff;
    background: linear-gradient(135deg, #667eea, #764ba2);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
}

.source-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-panel {
  width: 100%;
}

.upload-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px 24px;
  min-height: 200px;
  background: rgba(255, 255, 255, 0.02);
  border: 2px dashed rgba(102, 126, 234, 0.3);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(102, 126, 234, 0.05);
    border-color: rgba(102, 126, 234, 0.5);
  }

  &.is-dragging {
    background: rgba(102, 126, 234, 0.1);
    border-color: #667eea;
    border-style: solid;
    transform: scale(1.02);
    box-shadow: 0 0 30px rgba(102, 126, 234, 0.3);
  }

  &.is-loading {
    pointer-events: none;
    opacity: 0.7;
  }
}

.upload-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.upload-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
  border-radius: 16px;
  color: #667eea;

  svg {
    width: 32px;
    height: 32px;
  }
}

.upload-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0;
  text-align: center;
}

.upload-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
  text-align: center;
}

.upload-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.url-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.url-input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:focus-within {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  }
}

.url-input-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
  }
}

.url-input {
  flex: 1;
  height: 48px;
  padding: 0 12px 0 0;
  font-size: 14px;
  color: #fff;
  background: transparent;
  border: none;
  outline: none;

  &::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }
  &:disabled {
    opacity: 0.5;
  }
}

.url-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.url-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
  padding-left: 4px;
}

.source-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: #f87171;
  font-size: 13px;

  svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  &--small {
    width: 18px;
    height: 18px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.error-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
