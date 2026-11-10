<script setup>
import { ElButton } from 'element-plus'
import { computed } from 'vue'
import SoftLoading from '@/components/common/feedback/SoftLoading.vue'
import { deleteProtectionReason, formatLocalBytes, formatLocalDate } from '@/composables/useLocalWallpapers'

const props = defineProps({
  entry: { type: Object, required: true },
  thumbnail: { type: Object, default: () => ({ loading: true }) },
  readOnly: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  revealLabel: { type: String, default: '在文件夹中显示' },
})
defineEmits(['apply', 'reveal', 'remove', 'retryThumbnail', 'thumbnailError'])
const protection = computed(() => deleteProtectionReason(props.entry, props.readOnly))
const applyReason = computed(() => props.readOnly ? '当前为只读模式' : props.entry.canApply ? '' : '这张本地图片暂时无法应用')
</script>

<template>
  <article class="local-wallpaper-card" :aria-label="entry.title">
    <div class="local-wallpaper-card__preview">
      <img v-if="thumbnail.url" :src="thumbnail.url" :alt="entry.title" decoding="async" @error="$emit('thumbnailError')">
      <SoftLoading v-else-if="thumbnail.loading" :size="40" label="正在读取预览" />
      <div v-else class="local-wallpaper-card__preview-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3" /><path d="m3 16 5-5 4 4 3-3 6 6M15.5 7.5h.01" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>预览暂时不可用</span>
        <ElButton text :aria-label="`重新读取${entry.title}的预览`" @click="$emit('retryThumbnail')">
          重新加载
        </ElButton>
      </div>
      <div v-if="entry.isCurrent || entry.isPrevious || entry.inRotation" class="local-wallpaper-card__badges">
        <span v-if="entry.isCurrent" class="local-wallpaper-card__badge">
          最近应用
        </span>
        <span v-if="entry.isPrevious" class="local-wallpaper-card__badge is-previous">
          上一张
        </span>
        <span v-if="entry.inRotation" class="local-wallpaper-card__badge is-rotation">
          轮换中
        </span>
      </div>
    </div>
    <div class="local-wallpaper-card__body">
      <h2 :title="entry.titleKnown ? entry.title : `${entry.title}（历史缓存，原始标题未知）`">
        {{ entry.title }}
      </h2>
      <p class="local-wallpaper-card__metadata">
        <span>{{ formatLocalBytes(entry.bytes) }}</span>
        <span :title="entry.lastAppliedAt ? `最近应用于 ${formatLocalDate(entry.lastAppliedAt)}` : undefined">保存于 {{ formatLocalDate(entry.modifiedAt) }}</span>
      </p>
      <div class="local-wallpaper-card__actions">
        <ElButton type="primary" :disabled="busy || readOnly || !entry.canApply" :title="applyReason || undefined" :aria-label="`将${entry.title}设为壁纸`" @click="$emit('apply')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 21h8m-4-5v5m-4-11 3 3 5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          设为壁纸
        </ElButton>
        <div class="local-wallpaper-card__secondary-actions">
          <ElButton :disabled="busy" :aria-label="`${revealLabel}${entry.title}`" @click="$emit('reveal')">
            {{ revealLabel }}
          </ElButton>
          <span class="local-wallpaper-card__delete" :title="protection || undefined" :aria-label="protection || undefined" :tabindex="protection ? 0 : undefined">
            <ElButton :disabled="busy || Boolean(protection)" :aria-label="`删除${entry.title}`" @click="$emit('remove')">
              删除
            </ElButton>
          </span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.local-wallpaper-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg-card);
}
.local-wallpaper-card__preview {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: var(--color-bg-hover);
}
.local-wallpaper-card__preview > img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.local-wallpaper-card__preview-error {
  display: grid;
  justify-items: center;
  gap: 5px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.local-wallpaper-card__preview-error > svg {
  width: 30px;
  height: 30px;
  margin-bottom: 4px;
}
.local-wallpaper-card__badges {
  position: absolute;
  inset: 12px 12px auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.local-wallpaper-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 9px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 20px;
  background: #235bd7;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}
.local-wallpaper-card__badge.is-previous {
  background: #475569;
}
.local-wallpaper-card__badge.is-rotation {
  background: #14734e;
}
.local-wallpaper-card__body {
  padding: 18px;
}
.local-wallpaper-card h2 {
  display: -webkit-box;
  min-height: 44px;
  margin: 0 0 8px;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.local-wallpaper-card__metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
}
.local-wallpaper-card__actions {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}
.local-wallpaper-card__secondary-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}
.local-wallpaper-card__secondary-actions :deep(.el-button) {
  min-width: 0;
  padding-right: 10px;
  padding-left: 10px;
  font-size: 12px;
}
.local-wallpaper-card__secondary-actions :deep(.el-button > span) {
  white-space: normal;
  line-height: 1.4;
}
.local-wallpaper-card__delete {
  display: inline-flex;
  border-radius: 9px;
}
.local-wallpaper-card :deep(.el-button) {
  min-height: 38px;
  margin: 0;
  border-radius: 9px;
  font-family: inherit;
}
.local-wallpaper-card :deep(.el-button:not(.el-button--primary):not(.is-text)) {
  border-color: var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
}
.local-wallpaper-card :deep(.el-button:not(.el-button--primary):not(.is-disabled):hover) {
  border-color: var(--accent-border-strong);
  background: var(--color-bg-hover);
  color: var(--color-accent);
}
.local-wallpaper-card :deep(.el-button.is-disabled) {
  opacity: 0.55;
  cursor: not-allowed;
}
.local-wallpaper-card :deep(.el-button svg) {
  width: 17px;
  height: 17px;
  margin-right: 7px;
}
.local-wallpaper-card :deep(button:focus-visible),
.local-wallpaper-card__delete:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
@media (max-width: 575px) {
  .local-wallpaper-card :deep(.el-button) {
    min-height: 44px;
  }
}
</style>
