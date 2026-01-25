<script setup>
import { onMounted, ref } from 'vue'

const platform = ref('')

onMounted(() => {
  platform.value = window.electronAPI?.platform || ''
})

function minimize() {
  window.electronAPI?.minimize()
}

function maximize() {
  window.electronAPI?.maximize()
}

function close() {
  window.electronAPI?.close()
}
</script>

<template>
  <!-- macOS 不显示窗口控制按钮，使用系统原生的红绿灯 -->
  <div v-if="platform === 'win32'" class="window-controls">
    <div class="drag-region" />
    <div class="controls-buttons">
      <button
        class="control-btn minimize"
        aria-label="最小化"
        @click="minimize"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button
        class="control-btn maximize"
        aria-label="最大化"
        @click="maximize"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>
      <button
        class="control-btn close"
        aria-label="关闭"
        @click="close"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.window-controls {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.15) 0%, transparent 100%);
  -webkit-app-region: drag;
}

.drag-region {
  flex: 1;
  height: 100%;
}

.controls-buttons {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background-color 150ms ease;

  svg {
    width: 16px;
    height: 16px;
    opacity: 0.85;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.1);

    svg {
      opacity: 1;
    }
  }

  &:active {
    background: rgba(255, 255, 255, 0.05);
  }

  &.close:hover {
    background: #e81123;
    color: #fff;
  }
}

[data-theme='light'] .window-controls {
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.06) 0%, transparent 100%);
}

[data-theme='light'] .control-btn {
  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  &:active {
    background: rgba(0, 0, 0, 0.1);
  }

  &.close:hover {
    background: #e81123;
    color: #fff;
  }
}
</style>
