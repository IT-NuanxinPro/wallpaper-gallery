<script setup>
import SoftLoading from './SoftLoading.vue'

defineProps({ label: { type: String, default: '正在加载' } })
</script>

<template>
  <div class="content-loading" aria-busy="true">
    <SoftLoading :label="label" />
  </div>
</template>

<style scoped>
.content-loading {
  display: grid;
  place-items: center;
  min-height: clamp(280px, 40vh, 420px);
  width: 100%;
  padding: 24px 16px;
}
</style>
