<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDesktopWallpaper } from '@/composables/useDesktopWallpaper'
import { DESKTOP_CLIENT_URL } from '@/services/desktopWallpaperService'

const props = defineProps({
  wallpaper: { type: Object, default: null },
  visible: { type: Boolean, default: true },
})
const { phase, status, busy, error, message, initialize, eligibility, apply, restore } = useDesktopWallpaper({ visible: () => props.visible })
const eligibilityResult = computed(() => eligibility(props.wallpaper))
</script>

<template>
  <section class="desktop-wallpaper-actions" aria-label="原生桌面壁纸">
    <template v-if="phase === 'ready'">
      <div class="desktop-wallpaper-actions__buttons">
        <button v-if="eligibilityResult.item" type="button" :disabled="busy" :aria-busy="busy" @click="apply(wallpaper)">
          {{ busy ? '客户端处理中…' : '设为桌面壁纸' }}
        </button>
        <span v-else>{{ eligibilityResult.reason }}</span>
        <button v-if="status?.previous" type="button" :disabled="busy" @click="restore">
          恢复上次应用的壁纸
        </button>
        <RouterLink to="/library">
          收藏轮换
        </RouterLink>
      </div>
      <p v-if="status?.current">
        当前应用：{{ status.current.title }}
      </p>
      <p v-if="message" role="status">
        {{ message }}
      </p>
      <p v-if="error" role="alert">
        {{ error }}
      </p>
    </template>
    <p v-else-if="phase === 'browser'">
      桌面客户端支持设置壁纸与收藏轮换。
      <a :href="DESKTOP_CLIENT_URL" target="_blank" rel="noopener noreferrer">下载客户端</a>
    </p>
    <p v-else-if="phase === 'checking' || phase === 'idle'" role="status">
      正在检查客户端壁纸能力…
    </p>
    <template v-else>
      <p role="status">
        {{ error }}
      </p>
      <a v-if="phase === 'upgrade'" :href="DESKTOP_CLIENT_URL" target="_blank" rel="noopener noreferrer">升级桌面客户端</a>
      <button v-else type="button" @click="initialize(true)">
        重新检查客户端
      </button>
    </template>
  </section>
</template>

<style scoped>
.desktop-wallpaper-actions {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.desktop-wallpaper-actions__buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.desktop-wallpaper-actions button,
.desktop-wallpaper-actions a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-accent);
}
.desktop-wallpaper-actions button {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-card);
  padding: 8px 12px;
  cursor: pointer;
}
.desktop-wallpaper-actions button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.desktop-wallpaper-actions button:focus-visible,
.desktop-wallpaper-actions a:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.desktop-wallpaper-actions p {
  margin: 6px 0;
}
</style>
