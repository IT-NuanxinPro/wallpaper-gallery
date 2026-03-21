<script setup>
defineProps({
  zoomLevel: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['reset', 'zoom'])
</script>

<template>
  <div class="panel-section panel-section--tools">
    <h3 class="section-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      缩放
    </h3>
    <div class="zoom-controls">
      <button class="zoom-btn" title="缩小 (-)" @click="emit('zoom', 'out')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M8 11h6" />
        </svg>
      </button>
      <div class="zoom-slider">
        <div class="zoom-track">
          <div class="zoom-fill" :style="{ width: `${Math.min(zoomLevel * 50, 100)}%` }" />
        </div>
        <span class="zoom-value">{{ Math.round(zoomLevel * 100) }}%</span>
      </div>
      <button class="zoom-btn" title="放大 (+)" @click="emit('zoom', 'in')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
        </svg>
      </button>
      <button class="zoom-reset-btn" @click="emit('reset')">
        重置
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;

  &--tools {
    padding: 12px 16px;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;

  svg {
    width: 13px;
    height: 13px;
    color: #667eea;
  }
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 15px;
    height: 15px;
  }

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  &:active {
    transform: scale(0.95);
  }
}

.zoom-slider {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.zoom-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
  transition: width 0.15s ease;
}

.zoom-value {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  font-family: 'SF Mono', Monaco, monospace;
  min-width: 38px;
  text-align: right;
}

.zoom-reset-btn {
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 5px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(102, 126, 234, 0.2);
    border-color: rgba(102, 126, 234, 0.3);
  }
}
</style>
