<script setup>
import { ElDialog } from 'element-plus'
import { defineAsyncComponent, onBeforeUnmount, onErrorCaptured, onMounted, ref } from 'vue'
import { settleDownloadChallenge } from '@/services/downloadVerification'
import { loadTurnstileScript } from '@/services/turnstileScript'
import 'element-plus/es/components/dialog/style/css'

const props = defineProps({ challenge: { type: Object, required: true } })
const VueTurnstile = defineAsyncComponent(() => loadTurnstileScript().then(() => import('vue-turnstile')))
const error = ref('')
const attempt = ref(0)
let timeout
function clearDeadline() {
  clearTimeout(timeout)
}
function startDeadline() {
  clearDeadline()
  timeout = setTimeout(() => {
    error.value = '验证加载较慢，请重试或稍后下载。'
  }, 20000)
}
function verified(token) {
  if (token) {
    clearDeadline()
    settleDownloadChallenge(props.challenge.id, token)
  }
}
function failed() {
  clearDeadline()
  error.value = '暂时无法完成验证，请重试。'
}
function retry() {
  error.value = ''
  attempt.value++
  startDeadline()
}
onErrorCaptured(() => {
  failed()
  return false
})
onMounted(startDeadline)
onBeforeUnmount(() => {
  clearDeadline()
  settleDownloadChallenge(props.challenge.id)
})
</script>

<template>
  <ElDialog :model-value="true" title="完成验证后继续下载" width="min(92vw, 420px)" class="download-verification" align-center :close-on-click-modal="false" @close="settleDownloadChallenge(challenge.id)">
    <p class="download-verification__intro">
      近期下载较多，请完成一次验证。
    </p>
    <div class="download-verification__widget">
      <VueTurnstile :key="attempt" model-value="" :site-key="challenge.siteKey" action="wallpaper_download" language="zh-cn" theme="auto" @update:model-value="verified" @error="failed" @unsupported="failed" @expired="retry" @before-interactive="clearDeadline" />
    </div>
    <p v-if="error" class="download-verification__error" role="status">
      {{ error }}
    </p>
    <template #footer>
      <button type="button" class="download-verification__cancel" @click="settleDownloadChallenge(challenge.id)">
        取消下载
      </button>
      <button v-if="error" type="button" class="download-verification__retry" @click="retry">
        重新验证
      </button>
    </template>
  </ElDialog>
</template>

<style>
.download-verification.el-dialog {
  border-radius: 24px;
  padding: 24px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
.download-verification .el-dialog__title {
  color: var(--color-text-primary);
  font-size: 18px;
}
.download-verification__intro {
  margin: 0 0 20px;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.download-verification__widget {
  min-height: 90px;
  display: grid;
  place-items: center;
}
.download-verification__error {
  margin-top: 16px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.download-verification__cancel,
.download-verification__retry {
  border-radius: 999px;
  padding: 10px 18px;
  min-height: 40px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
}
.download-verification__retry {
  margin-left: 10px;
  background: var(--accent-gradient);
  color: #fff;
  border-color: transparent;
}
@media (max-width: 380px) {
  .download-verification.el-dialog {
    padding: 16px;
  }
}
</style>
