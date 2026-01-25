<script setup>
import { useElectron } from '@/composables/useElectron'
import WindowControls from './WindowControls.vue'

const { isWindows } = useElectron()
</script>

<template>
  <div class="app-title-bar">
    <!-- 左侧：macOS 红绿灯占位区 -->
    <div class="title-bar-left">
      <!-- macOS 需要留出约 80px 空白避开红绿灯 -->
    </div>

    <!-- 中间：应用标题（可选） -->
    <div class="title-bar-center">
      <!-- 可以显示应用标题，目前留空 -->
    </div>

    <!-- 右侧：Windows 窗口控制按钮 -->
    <div class="title-bar-right">
      <WindowControls v-if="isWindows" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-bg-secondary); // 使用主题背景色
  z-index: 10000; // 确保在最上层
  -webkit-app-region: drag; // 让整个标题栏可拖拽
  user-select: none;
  border-bottom: 1px solid var(--color-border);
}

.title-bar-left {
  // macOS 红绿灯占位区
  width: 80px;
  flex-shrink: 0;
}

.title-bar-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.title-bar-right {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag; // 按钮区域不可拖拽，确保可点击
  padding-right: 8px;
}
</style>
