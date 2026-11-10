<script setup>
import { ElPopover } from 'element-plus'
import { computed } from 'vue'
import { useVersionCheck } from '@/composables/useVersionCheck'

const { isNativeClient, clientVersion, clientState, currentVersion, latestClientInfo, clientCheckResult, isChecking, checkForUpdates } = useVersionCheck()
const label = computed(() => clientVersion.value ? `客户端 v${clientVersion.value}` : clientState.value === 'legacy' ? '旧版客户端' : clientState.value === 'checking' ? '读取客户端版本…' : '客户端版本未知')
const checkMessage = computed(() => ({
  idle: '可手动检查客户端更新。',
  checking: '正在检查更新…',
  update: '有可用客户端更新，请下载安装。',
  current: '当前客户端已是最新版本。',
  unavailable: '暂未提供可下载安装的新版本，请稍后再试。',
  error: '检查未完成，请检查网络后重试。',
}[clientCheckResult.value]))
</script>

<template>
  <ElPopover v-if="isNativeClient" trigger="click" placement="bottom-start" :width="280">
    <template #reference>
      <button class="client-version-trigger" type="button" :aria-label="`${label}，查看版本和更新`">
        {{ label }}<span v-if="clientCheckResult === 'update'" class="client-version-dot" aria-label="有可用更新" />
      </button>
    </template>
    <div class="client-version-panel">
      <strong>{{ label }}</strong>
      <p>网页 v{{ currentVersion }}</p>
      <p v-if="clientState === 'legacy'">
        旧版客户端无法读取安装版本，请升级客户端。
      </p>
      <p v-else-if="clientState === 'error'">
        无法读取客户端版本，请重试；旧版客户端请升级。
      </p>
      <p role="status">
        {{ checkMessage }}
      </p>
      <button class="client-version-check" type="button" :disabled="isChecking" :aria-busy="isChecking" @click="checkForUpdates({ manual: true })">
        {{ isChecking ? '正在检查…' : '检查更新' }}
      </button>
      <div v-if="clientCheckResult === 'update' && latestClientInfo" class="client-version-links">
        <a :href="latestClientInfo.downloadUrl" target="_blank" rel="noopener noreferrer">下载安装 v{{ latestClientInfo.latest }}</a>
        <a :href="latestClientInfo.notesUrl" target="_blank" rel="noopener noreferrer">查看说明</a>
      </div>
    </div>
  </ElPopover>
</template>

<style scoped>
.client-version-trigger {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 5px;
  min-height: 24px;
  max-width: 190px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
}
.client-version-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
}
.client-version-panel {
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.7;
}
.client-version-panel p {
  margin: 6px 0;
  color: var(--color-text-secondary);
}
.client-version-check,
.client-version-links a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-accent);
}
.client-version-check {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 6px 12px;
  background: var(--color-bg-card);
  cursor: pointer;
}
.client-version-check:disabled {
  opacity: 0.6;
  cursor: wait;
}
.client-version-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0 12px;
}
:is(button, a):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
</style>
