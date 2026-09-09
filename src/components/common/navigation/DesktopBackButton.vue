<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isPakeDesktop, navigateDesktopBack } from '@/utils/platform/pake'

const router = useRouter()
const route = useRoute()
const visible = ref(false)

onMounted(() => {
  // Only show inside Pake / Tauri desktop app, never on normal web
  visible.value = isPakeDesktop()
})

function handleBack() {
  // Auth pages already have their own back control
  if (['/login', '/signup', '/auth/callback'].includes(route.path)) {
    router.replace('/desktop')
    return
  }

  navigateDesktopBack(router)
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="desktop-back-btn"
    aria-label="返回上一页"
    title="返回"
    @click="handleBack"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
    <span>返回</span>
  </button>
</template>

<style lang="scss" scoped>
.desktop-back-btn {
  position: fixed;
  top: 72px;
  left: 16px;
  z-index: 1200;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: 9999px;
  background: color-mix(in srgb, var(--color-bg-card, #ffffff) 92%, transparent);
  color: var(--color-text-primary, #1a1a2e);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  transition:
    transform 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
    background: var(--color-bg-hover, #f1f3f4);
  }

  &:active {
    transform: translateY(0);
  }
}

@media (max-width: 767px) {
  .desktop-back-btn {
    display: none;
  }
}
</style>
