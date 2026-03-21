<script setup>
/**
 * 控制面板 - 形状切换、尺寸设置、下载按钮
 */
import { computed } from 'vue'

const props = defineProps({
  avatarShape: { type: String, default: 'circle', validator: v => ['circle', 'square'].includes(v) },
  avatarWidth: { type: Number, default: 450 },
  avatarHeight: { type: Number, default: 450 },
  avatarRadius: { type: Number, default: 45 },
  canDownload: { type: Boolean, default: false },
  isDownloading: { type: Boolean, default: false },
})

const emit = defineEmits(['shapeChange', 'download', 'update:avatarWidth', 'update:avatarHeight', 'update:avatarRadius'])

// 圆角最大值（取宽高较小值的一半）
const maxRadius = computed(() => Math.floor(Math.min(props.avatarWidth, props.avatarHeight) / 2))

function handleShapeChange(shape) {
  if (shape !== props.avatarShape)
    emit('shapeChange', shape)
}

function handleDownload() {
  if (props.canDownload && !props.isDownloading)
    emit('download')
}

function updateWidth(e) {
  const val = Math.max(100, Math.min(1000, Number(e.target.value) || 450))
  emit('update:avatarWidth', val)
}

function updateHeight(e) {
  const val = Math.max(100, Math.min(1000, Number(e.target.value) || 450))
  emit('update:avatarHeight', val)
}

function updateRadius(e) {
  const val = Math.max(0, Math.min(maxRadius.value, Number(e.target.value) || 0))
  emit('update:avatarRadius', val)
}
</script>

<template>
  <div class="control-panel">
    <div class="panel-header">
      <h2 class="panel-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        头像自制
      </h2>
      <p class="panel-desc">
        上传图片，裁剪并下载自定义头像
      </p>
    </div>

    <!-- 形状切换 -->
    <div class="panel-section">
      <span class="section-label">头像形状</span>
      <div class="shape-toggle">
        <button class="shape-btn" :class="{ active: avatarShape === 'circle' }" @click="handleShapeChange('circle')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span>圆形</span>
        </button>
        <button class="shape-btn" :class="{ active: avatarShape === 'square' }" @click="handleShapeChange('square')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
          </svg>
          <span>方形</span>
        </button>
        <div class="shape-indicator" :class="{ 'is-square': avatarShape === 'square' }" />
      </div>
    </div>

    <!-- 尺寸设置 -->
    <div class="panel-section">
      <span class="section-label">输出尺寸</span>
      <div class="size-inputs">
        <div class="size-input-group">
          <label>宽度</label>
          <div class="input-wrapper">
            <input type="number" :value="avatarWidth" min="100" max="1000" step="10" @change="updateWidth">
            <span class="input-unit">px</span>
          </div>
        </div>
        <div class="size-input-group">
          <label>高度</label>
          <div class="input-wrapper">
            <input type="number" :value="avatarHeight" min="100" max="1000" step="10" @change="updateHeight">
            <span class="input-unit">px</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 圆角设置（仅方形时显示） -->
    <div v-if="avatarShape === 'square'" class="panel-section">
      <span class="section-label">圆角大小</span>
      <div class="radius-control">
        <input type="range" :value="avatarRadius" :max="maxRadius" min="0" step="1" class="radius-slider" @input="updateRadius">
        <div class="radius-value">
          <input type="number" :value="avatarRadius" :max="maxRadius" min="0" @change="updateRadius">
          <span>px</span>
        </div>
      </div>
    </div>

    <!-- 下载按钮 -->
    <div class="panel-actions">
      <button class="download-btn" :disabled="!canDownload || isDownloading" @click="handleDownload">
        <svg v-if="!isDownloading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        <span v-if="isDownloading" class="loading-spinner" />
        <span>{{ isDownloading ? '生成中...' : '下载头像' }}</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin: 0;

  svg {
    width: 24px;
    height: 24px;
    color: #667eea;
  }
}

.panel-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.shape-toggle {
  position: relative;
  display: flex;
  padding: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.shape-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  min-height: 40px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 16px;
    height: 16px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.active {
    color: white;
    svg {
      transform: scale(1.1);
    }
  }

  &:not(.active):hover {
    color: rgba(255, 255, 255, 0.8);
  }
}

.shape-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;

  &.is-square {
    transform: translateX(100%);
  }
}

// 尺寸输入
.size-inputs {
  display: flex;
  gap: 12px;
}

.size-input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;

  &:focus-within {
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }

  input {
    flex: 1;
    width: 100%;
    padding: 8px 10px;
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    background: transparent;
    border: none;
    outline: none;
    -moz-appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }

  .input-unit {
    padding: 0 10px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.05);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    height: 100%;
    display: flex;
    align-items: center;
  }
}

// 圆角控制
.radius-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.radius-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(102, 126, 234, 0.4);
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.1);
    }
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(102, 126, 234, 0.4);
  }
}

.radius-value {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 70px;

  input {
    width: 45px;
    padding: 6px 8px;
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    outline: none;
    text-align: center;
    -moz-appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    &:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }
  }

  span {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
}

.panel-actions {
  margin-top: auto;
  padding-top: 12px;
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  min-height: 48px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);

  svg {
    width: 18px;
    height: 18px;
    transition: transform 0.3s ease;
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(102, 126, 234, 0.5);
    svg {
      transform: translateY(2px);
    }
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
