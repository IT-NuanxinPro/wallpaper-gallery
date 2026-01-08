<script setup>
import { onMounted, ref } from 'vue'

let deferredPrompt = null
const showInstallPrompt = ref(false)
const isInstallable = ref(false)

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    isInstallable.value = true
    showInstallPrompt.value = true
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    showInstallPrompt.value = false
    isInstallable.value = false
  })
})

async function installPWA() {
  if (!deferredPrompt)
    return

  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice

  if (outcome === 'accepted') {
    showInstallPrompt.value = false
    isInstallable.value = false
  }

  deferredPrompt = null
}

function dismissPrompt() {
  showInstallPrompt.value = false
}

defineExpose({
  isInstallable,
  installPWA,
})
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="showInstallPrompt"
      class="pwa-install-prompt"
    >
      <div class="pwa-content">
        <div class="pwa-icon">
          <span class="icon">📱</span>
        </div>
        <div class="pwa-text">
          <h3>安装 Wallpaper Gallery</h3>
          <p>将应用添加到主屏幕，获得更好的体验</p>
        </div>
        <div class="pwa-actions">
          <button
            class="btn-dismiss"
            @click="dismissPrompt"
          >
            稍后
          </button>
          <button
            class="btn-install"
            @click="installPWA"
          >
            安装
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;

.pwa-install-prompt {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: 90%;
  max-width: 400px;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--color-border);
  padding: 16px;

  @media (min-width: 1024px) {
    bottom: 24px;
    right: 24px;
    left: auto;
    transform: none;
  }
}

.pwa-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pwa-icon {
  .icon {
    font-size: 32px;
    display: block;
  }
}

.pwa-text {
  flex: 1;

  h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 4px 0;
  }

  p {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin: 0;
  }
}

.pwa-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-dismiss,
.btn-install {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  border: none;
}

.btn-dismiss {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);

  &:hover {
    background: var(--color-border);
  }
}

.btn-install {
  background: var(--color-accent);
  color: white;

  &:hover {
    background: var(--color-accent-hover);
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 350ms ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
