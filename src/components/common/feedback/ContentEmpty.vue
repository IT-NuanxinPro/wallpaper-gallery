<script setup>
import { ElEmpty } from 'element-plus'
import 'element-plus/es/components/empty/style/css'

defineProps({ description: { type: String, default: '暂无内容' } })
</script>

<template>
  <div class="content-empty" role="status">
    <ElEmpty :description="description" :image-size="128">
      <slot />
    </ElEmpty>
  </div>
</template>

<style scoped>
.content-empty {
  display: grid;
  place-items: center;
  min-height: clamp(280px, 40vh, 420px);
  width: 100%;
  padding: 24px 16px;
}
.content-empty :deep(.el-empty) {
  padding: 0;
}
.content-empty :deep(.el-empty__description p) {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.8;
}
.content-empty :deep(.el-empty__bottom) {
  margin-top: 20px;
}
:global(html[data-theme='dark']) .content-empty {
  --el-empty-fill-color-0: #172030;
  --el-empty-fill-color-1: #253044;
  --el-empty-fill-color-2: #202b3e;
  --el-empty-fill-color-3: #243047;
  --el-empty-fill-color-4: #1e293b;
  --el-empty-fill-color-5: #2b3850;
  --el-empty-fill-color-6: #202a3c;
  --el-empty-fill-color-7: #29374c;
  --el-empty-fill-color-8: #1e293b;
  --el-empty-fill-color-9: #334155;
}
</style>
