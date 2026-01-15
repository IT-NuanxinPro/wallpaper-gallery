<script setup>
/**
 * iPhone 真机预览组件
 */
import { computed, ref } from 'vue'

const props = defineProps({
  previewImage: { type: String, default: null },
  avatarShape: { type: String, default: 'circle', validator: v => ['circle', 'square'].includes(v) },
  avatarRadius: { type: Number, default: 45 },
  isLoading: { type: Boolean, default: false },
})

const isHovered = ref(false)

// 计算预览圆角（按比例缩放，预览尺寸140px）
const previewRadius = computed(() => {
  if (props.avatarShape === 'circle')
    return '50%'
  const scaledRadius = Math.round(props.avatarRadius * (140 / 450))
  return `${scaledRadius}px`
})
</script>

<template>
  <div class="phone-preview">
    <div class="iphone-frame" :class="{ 'is-hovered': isHovered }" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
      <div class="screen-container">
        <div class="screen-bg" />
        <div class="dynamic-island" />

        <div class="avatar-showcase">
          <div class="avatar-wrapper" :class="{ 'is-square': avatarShape === 'square' }" :style="avatarShape === 'square' ? { borderRadius: previewRadius } : {}">
            <div v-if="isLoading" class="avatar-loading">
              <span class="loading-spinner" />
            </div>
            <img v-else-if="previewImage" :src="previewImage" alt="头像预览" class="avatar-image" :style="avatarShape === 'square' ? { borderRadius: previewRadius } : {}">
            <svg v-else class="avatar-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div class="avatar-name">
            头像预览
          </div>
        </div>
      </div>

      <div class="home-indicator" />
      <div class="mute-btn" />
      <div class="volume-up-btn" />
      <div class="volume-down-btn" />
      <div class="power-btn" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.phone-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.iphone-frame {
  position: relative;
  width: 240px;
  height: 490px;
  background-color: #0e0e0e;
  border: 1px solid #959595;
  border-radius: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow:
    0 0 0 2px #1a1a1a,
    0 0 0 4px #2a2a2a,
    0 20px 40px rgba(0, 0, 0, 0.5);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-hovered {
    transform: scale(1.02) rotateY(-2deg) rotateX(1deg);
    box-shadow:
      0 0 0 2px #1a1a1a,
      0 0 0 4px #2a2a2a,
      0 30px 60px rgba(0, 0, 0, 0.6),
      0 0 50px rgba(102, 126, 234, 0.15);
  }
}

.screen-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 39px;
  overflow: hidden;
  z-index: 1;
  padding: 3px;
  box-sizing: border-box;
}

.screen-bg {
  position: absolute;
  inset: 3px;
  border-radius: 37px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.dynamic-island {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 26px;
  background: #000;
  border-radius: 22px;
  z-index: 10;
}

.avatar-showcase {
  position: absolute;
  inset: 3px;
  border-radius: 37px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  z-index: 2;
}

.avatar-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea, #764ba2);
  padding: 3px;
  box-shadow:
    0 10px 30px rgba(102, 126, 234, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-square {
    .avatar-loading {
      border-radius: inherit;
    }
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), transparent 60%);
    pointer-events: none;
    z-index: 2;
  }
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  transition: border-radius 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.avatar-loading {
  position: absolute;
  inset: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 46, 0.9);
  border-radius: 50%;
  z-index: 1;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.avatar-placeholder {
  width: 50%;
  height: 50%;
  color: rgba(255, 255, 255, 0.4);
}

.avatar-name {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.5px;
}

.home-indicator {
  position: absolute;
  bottom: 12px;
  width: 35%;
  height: 5px;
  background-color: #fff;
  border-radius: 2px;
  z-index: 3;
}

.mute-btn,
.volume-up-btn,
.volume-down-btn,
.power-btn {
  position: absolute;
  width: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, #ccc, #666, #222);
}

.mute-btn {
  left: -3px;
  top: 85px;
  height: 20px;
}
.volume-up-btn {
  left: -3px;
  top: 125px;
  height: 40px;
}
.volume-down-btn {
  left: -3px;
  top: 175px;
  height: 40px;
}
.power-btn {
  right: -3px;
  top: 145px;
  height: 65px;
}
</style>
