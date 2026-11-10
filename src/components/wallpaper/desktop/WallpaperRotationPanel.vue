<script setup>
import { computed, ref, useId, watch } from 'vue'
import { useDesktopWallpaper } from '@/composables/useDesktopWallpaper'
import { DESKTOP_CLIENT_URL, ROTATION_INTERVALS } from '@/services/desktopWallpaperService'

const props = defineProps({
  wallpapers: { type: Array, default: () => [] },
  totalCount: { type: Number, default: 0 },
})
const expanded = ref(false)
const intervalId = useId()
const intervalMinutes = ref(60)
const selected = ref([])
let selectionInitialized = false
const { phase, status, busy, error, message, initialize, eligibility, configure, restore } = useDesktopWallpaper({ visible: expanded, poll: true })
const eligible = computed(() => {
  const byKey = new Map()
  props.wallpapers.forEach((wallpaper) => {
    const result = eligibility(wallpaper)
    if (result.item)
      byKey.set(result.item.assetKey, { wallpaper, item: result.item })
  })
  return [...byKey.values()]
})
const unavailableCount = computed(() => Math.max(0, props.totalCount - eligible.value.length))
watch(eligible, (items) => {
  const keys = items.map(({ item }) => item.assetKey)
  if (!selectionInitialized && keys.length) {
    selected.value = keys.slice(0, 50)
    selectionInitialized = true
  }
  else {
    selected.value = selected.value.filter(key => keys.includes(key))
  }
}, { immediate: true })
function enableRotation() {
  return configure({
    enabled: true,
    intervalMinutes: intervalMinutes.value,
    items: eligible.value.filter(({ item }) => selected.value.includes(item.assetKey)).map(({ wallpaper }) => wallpaper),
  })
}
function stopRotation() {
  return configure({ enabled: false, intervalMinutes: status.value?.intervalMinutes || 60, items: [] })
}
</script>

<template>
  <details class="wallpaper-rotation" @toggle="expanded = $event.target.open">
    <summary>桌面壁纸轮换<span v-if="status?.enabled"> · 已开启</span></summary>
    <div v-if="expanded" class="wallpaper-rotation__body">
      <p v-if="phase === 'idle' || phase === 'checking'" role="status">
        正在检查客户端…
      </p>
      <p v-else-if="phase === 'browser'">
        使用桌面客户端，将收藏中的静态壁纸加入轮换。
        <a :href="DESKTOP_CLIENT_URL" target="_blank" rel="noopener noreferrer">下载客户端</a>
      </p>
      <template v-else-if="phase === 'ready'">
        <p>选择当前收藏筛选中的壁纸：已选 {{ selected.length }} 张，可用 {{ eligible.length }} 张，暂不可用 {{ unavailableCount }} 张（仅支持 JPG/JPEG/PNG）。</p>
        <div class="wallpaper-rotation__selection" role="group" aria-label="选择轮换壁纸">
          <label v-for="entry in eligible" :key="entry.item.assetKey">
            <input v-model="selected" type="checkbox" :value="entry.item.assetKey" :disabled="busy || (!selected.includes(entry.item.assetKey) && selected.length >= 50)">
            <span>{{ entry.item.title }}</span>
          </label>
        </div>
        <label class="wallpaper-rotation__interval" :for="intervalId">
          轮换间隔
          <select :id="intervalId" v-model.number="intervalMinutes" :disabled="busy">
            <option v-for="minutes in ROTATION_INTERVALS" :key="minutes" :value="minutes">{{ minutes < 60 ? `${minutes} 分钟` : `${minutes / 60} 小时` }}</option>
          </select>
        </label>
        <div class="wallpaper-rotation__buttons">
          <button type="button" :disabled="busy || !selected.length" @click="enableRotation">
            {{ status?.enabled ? '更新轮换列表并启用' : '开启轮换' }}
          </button>
          <button type="button" :disabled="busy" @click="stopRotation">
            停止轮换
          </button>
          <button type="button" :disabled="busy || !status?.previous" @click="restore">
            恢复上次应用的壁纸
          </button>
        </div>
        <p v-if="status" role="status">
          {{ status.enabled ? '轮换已开启' : '轮换已停止' }} · 当前间隔 {{ status.intervalMinutes }} 分钟 · 已缓存 {{ status.cacheCount }} 张
        </p>
        <p v-if="status?.current">
          当前应用：{{ status.current.title }}
        </p>
        <p v-if="status?.lastError" role="alert">
          客户端上次更换未完成，请检查网络或系统权限后重试。
        </p>
        <p>轮换列表以点击开启时的快照保存，删除收藏或退出登录不会自动修改它，可随时在此停止。</p>
        <p>已缓存图片可离线使用；首次使用未缓存图片需要联网。缓存上限 256 MiB，不保证所有图片同时离线可用；退出客户端会停止轮换。</p>
      </template>
      <template v-else>
        <p role="status">
          {{ error }}
        </p>
        <a v-if="phase === 'upgrade'" :href="DESKTOP_CLIENT_URL" target="_blank" rel="noopener noreferrer">升级桌面客户端</a>
        <button v-else type="button" @click="initialize(true)">
          重新检查客户端
        </button>
      </template>
      <p v-if="message && phase === 'ready'" role="status">
        {{ message }}
      </p>
      <p v-if="error && phase === 'ready'" role="alert">
        {{ error }}
      </p>
    </div>
  </details>
</template>

<style scoped>
.wallpaper-rotation {
  margin-bottom: 16px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.7;
}
.wallpaper-rotation summary {
  min-height: 44px;
  align-content: center;
  cursor: pointer;
}
.wallpaper-rotation__body {
  padding-bottom: 12px;
}
.wallpaper-rotation__body p {
  margin: 8px 0;
  color: var(--color-text-secondary);
}
.wallpaper-rotation__selection {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  max-height: 220px;
  overflow: auto;
  gap: 4px 12px;
}
.wallpaper-rotation label,
.wallpaper-rotation__buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.wallpaper-rotation label {
  min-height: 44px;
}
.wallpaper-rotation__selection label {
  flex-wrap: nowrap;
  overflow-wrap: anywhere;
}
.wallpaper-rotation button,
.wallpaper-rotation select {
  min-height: 44px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}
.wallpaper-rotation a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-accent);
}
.wallpaper-rotation :is(button, select, input, summary, a):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.wallpaper-rotation button:disabled {
  opacity: 0.6;
}
</style>
