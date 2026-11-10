<script setup>
import { ElButton, ElPopover } from 'element-plus'
import { computed, ref } from 'vue'
import { useVersionCheck } from '@/composables/useVersionCheck'

const { isNativeClient, clientVersion, clientState, currentVersion, latestClientInfo, clientCheckResult, isChecking, checkForUpdates } = useVersionCheck()
const isOpen = ref(false)
const hasClientUpdate = computed(() => clientCheckResult.value === 'update' && latestClientInfo.value)
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
  <ElPopover
    v-if="isNativeClient"
    v-model:visible="isOpen"
    trigger="click"
    placement="bottom-start"
    popper-class="header-client-version-popover"
    transition="client-version-fade"
    :width="320"
    :offset="12"
    :popper-options="{ modifiers: [{ name: 'preventOverflow', options: { padding: 12 } }] }"
  >
    <template #reference>
      <button class="client-version-trigger" type="button" :aria-label="`${label}，查看版本和更新`">
        {{ label }}<span v-if="clientCheckResult === 'update'" class="client-version-dot" aria-label="有可用更新" />
      </button>
    </template>
    <div class="client-version-panel">
      <div class="client-version-heading">
        <strong>{{ label }}</strong>
        <span>网页 v{{ currentVersion }}</span>
      </div>
      <p v-if="clientState === 'legacy'" class="client-version-hint">
        旧版客户端无法读取安装版本，请升级客户端。
      </p>
      <p v-else-if="clientState === 'error'" class="client-version-hint">
        无法读取客户端版本，请重试；旧版客户端请升级。
      </p>
      <p class="client-version-status" role="status" aria-live="polite">
        {{ checkMessage }}
      </p>
      <div class="client-version-actions">
        <a v-if="hasClientUpdate" class="client-version-download" :href="latestClientInfo.downloadUrl" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M12 3v12m-4-4 4 4 4-4M5 16v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          下载安装 v{{ latestClientInfo.latest }}
        </a>
        <div class="client-version-secondary-actions">
          <ElButton class="client-version-check" :loading="isChecking" :disabled="isChecking" :aria-busy="isChecking" @click="checkForUpdates({ manual: true })">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 17.9 17" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
            {{ isChecking ? '正在检查…' : '检查更新' }}
          </ElButton>
          <a v-if="hasClientUpdate" class="client-version-notes" :href="latestClientInfo.notesUrl" target="_blank" rel="noopener noreferrer">查看说明</a>
        </div>
      </div>
      <div class="client-version-footer">
        <RouterLink to="/local-wallpapers" class="client-version-local-wallpapers" @click="isOpen = false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>管理本地壁纸</span>
          <svg class="client-version-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>
      </div>
    </div>
  </ElPopover>
</template>

<style>
.header-client-version-popover.el-popper {
  --client-panel-ink: #334155;
  --client-panel-muted: #64748b;
  --client-panel-hover: rgba(14, 165, 233, 0.1);
  --client-panel-line: rgba(148, 163, 184, 0.18);
  max-width: calc(100vw - 24px);
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 24px 54px rgba(15, 23, 42, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.header-client-version-popover.el-popper .el-popper__arrow::before {
  border-color: rgba(255, 255, 255, 0.6);
  background: #fff;
}
html[data-theme='dark'] .header-client-version-popover.el-popper {
  --client-panel-ink: #cbd5e1;
  --client-panel-muted: #94a3b8;
  --client-panel-hover: rgba(56, 189, 248, 0.14);
  --client-panel-line: rgba(148, 163, 184, 0.16);
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(8, 15, 28, 0.94);
  box-shadow:
    0 26px 62px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
html[data-theme='dark'] .header-client-version-popover.el-popper .el-popper__arrow::before {
  border-color: rgba(148, 163, 184, 0.18);
  background: #080f1c;
}
.client-version-fade-enter-active,
.client-version-fade-leave-active {
  transition: opacity 160ms ease;
}
.client-version-fade-enter-from,
.client-version-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .client-version-fade-enter-active,
  .client-version-fade-leave-active {
    transition: none;
  }
}
</style>

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
  max-height: min(560px, calc(100dvh - 120px));
  overflow-y: auto;
  padding: 22px 20px 12px;
  color: var(--client-panel-ink);
  font-size: 13px;
  line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: var(--client-panel-line) transparent;
}
.client-version-heading {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.client-version-heading strong {
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
}
.client-version-heading span,
.client-version-hint,
.client-version-status {
  color: var(--client-panel-muted);
}
.client-version-hint {
  margin: 16px 0 0;
}
.client-version-status {
  min-height: 42px;
  margin: 18px 0 12px;
}
.client-version-actions {
  display: grid;
  gap: 10px;
}
.client-version-secondary-actions {
  display: flex;
  gap: 10px;
}
.client-version-check.el-button,
.client-version-download,
.client-version-notes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--client-panel-line);
  border-radius: 12px;
  background: transparent;
  color: var(--color-accent);
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}
.client-version-check.el-button,
.client-version-notes {
  flex: 1;
}
.client-version-check.el-button:not(:disabled):hover,
.client-version-notes:hover {
  border-color: var(--accent-border-strong);
  background: var(--client-panel-hover);
}
.client-version-check.el-button:disabled {
  color: var(--client-panel-muted);
  cursor: wait;
}
.client-version-download {
  border-color: transparent;
  color: #fff;
  background: #2563eb;
}
.client-version-download:hover {
  background: #1d4ed8;
}
.client-version-footer {
  margin-top: 18px;
  padding-top: 10px;
  border-top: 1px solid var(--client-panel-line);
}
.client-version-local-wallpapers {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  margin: 0 -8px;
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--client-panel-ink);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}
.client-version-local-wallpapers:hover {
  background: var(--client-panel-hover);
  color: var(--color-accent);
}
.client-version-local-wallpapers span {
  flex: 1;
}
.client-version-panel svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.client-version-chevron {
  color: var(--client-panel-muted);
}
:is(button, a):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .client-version-check.el-button,
  .client-version-download,
  .client-version-notes,
  .client-version-local-wallpapers {
    transition: none;
  }
}
</style>
