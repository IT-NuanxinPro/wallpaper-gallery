<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useDevice } from '@/composables/useDevice'

const props = defineProps({
  visible: { type: Boolean, default: false },
  imageSrc: { type: String, required: true },
  imageAlt: { type: String, default: '' },
})

const emit = defineEmits(['exit', 'afterEnter', 'afterLeave'])

const { isMobile } = useDevice()

const timeDigits = ref(['0', '0', '0', '0'])
const islandExpanded = ref(false)
const imageLoaded = ref(false)

let timeTimer = null
let islandTimer = null

function updateTime() {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  timeDigits.value = [hours[0], hours[1], minutes[0], minutes[1]]
}

function autoExpandIsland() {
  if (!props.visible) {
    return
  }
  islandExpanded.value = true
  setTimeout(() => {
    islandExpanded.value = false
  }, 3500)
}

function handleImageLoad() {
  imageLoaded.value = true
}

const frameSize = computed(() => {
  if (!isMobile.value)
    return { width: 280, height: 580 }
  const vh = window.innerHeight
  const vw = window.innerWidth
  const availableHeight = vh - 80
  const availableWidth = vw - 40
  const aspectRatio = 280 / 580
  let height = Math.min(availableHeight * 0.9, 580)
  let width = height * aspectRatio
  if (width > availableWidth * 0.85) {
    width = availableWidth * 0.85
    height = width / aspectRatio
  }
  return { width: Math.floor(width), height: Math.floor(height) }
})

function onAfterEnter() {
  emit('afterEnter')
  // 启动时钟更新（仅在可见时运行）
  updateTime()
  if (timeTimer)
    clearInterval(timeTimer)
  timeTimer = setInterval(updateTime, 1000)
  // 启动灵动岛动画
  setTimeout(autoExpandIsland, 1500)
  islandTimer = setInterval(autoExpandIsland, 8000)
}

function onAfterLeave() {
  emit('afterLeave')
  // 清理所有定时器
  if (timeTimer) {
    clearInterval(timeTimer)
    timeTimer = null
  }
  if (islandTimer) {
    clearInterval(islandTimer)
    islandTimer = null
  }
  imageLoaded.value = false
}

onMounted(() => {
  // 注意：时钟定时器在 visible 变为 true 时启动，避免组件挂载但不可见时浪费资源
})

onUnmounted(() => {
  if (timeTimer) {
    clearInterval(timeTimer)
    timeTimer = null
  }
  if (islandTimer) {
    clearInterval(islandTimer)
    islandTimer = null
  }
})
</script>

<template>
  <Transition
    name="device-mode"
    @after-enter="onAfterEnter"
    @after-leave="onAfterLeave"
  >
    <div
      v-if="visible"
      class="device-mode"
      :class="{ 'is-mobile': isMobile }"
    >
      <!-- 退出按钮 -->
      <button
        class="device-mode__exit"
        aria-label="退出真机显示"
        @click="emit('exit')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
        <span>退出真机</span>
      </button>

      <!-- iPhone 14 Pro 真机框架 -->
      <div class="device-mode__frame">
        <div
          class="iphone-frame"
          :style="{
            width: `${frameSize.width}px`,
            height: `${frameSize.height}px`,
          }"
        >
          <!-- 屏幕容器 -->
          <div class="screen-container">
            <img
              :src="imageSrc"
              :alt="imageAlt"
              :class="{ loaded: imageLoaded }"
              @load="handleImageLoad"
            >
          </div>

          <!-- 灵动岛 -->
          <div class="dynamic-island" :class="{ expanded: islandExpanded }">
            <div class="caller">
              <div class="avatar" />
              <div class="info">
                <span>iPhone</span>
                <p>来电中...</p>
              </div>
            </div>
            <div class="actions">
              <div class="refuse">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="14" height="14">
                  <path fill="currentColor" d="M199.232 125.568 90.624 379.008a32 32 0 0 0 6.784 35.2l512.384 512.384a32 32 0 0 0 35.2 6.784l253.44-108.608a32 32 0 0 0 10.048-52.032L769.6 633.92a32 32 0 0 0-36.928-5.952l-130.176 65.088-271.488-271.552 65.024-130.176a32 32 0 0 0-5.952-36.928L251.2 115.52a32 32 0 0 0-51.968 10.048" />
                </svg>
              </div>
              <div class="answer">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="14" height="14">
                  <path fill="currentColor" d="M199.232 125.568 90.624 379.008a32 32 0 0 0 6.784 35.2l512.384 512.384a32 32 0 0 0 35.2 6.784l253.44-108.608a32 32 0 0 0 10.048-52.032L769.6 633.92a32 32 0 0 0-36.928-5.952l-130.176 65.088-271.488-271.552 65.024-130.176a32 32 0 0 0-5.952-36.928L251.2 115.52a32 32 0 0 0-51.968 10.048" />
                </svg>
              </div>
            </div>
          </div>

          <!-- 时钟 -->
          <div class="clock">
            <span>{{ timeDigits[0] }}</span>
            <span>{{ timeDigits[1] }}</span>
            <span class="colon">:</span>
            <span>{{ timeDigits[2] }}</span>
            <span>{{ timeDigits[3] }}</span>
          </div>

          <!-- 底部指示器 -->
          <div class="home-indicator" />

          <!-- 物理按键 -->
          <div class="mute-btn" />
          <div class="volume-up-btn" />
          <div class="volume-down-btn" />
          <div class="power-btn" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.device-mode {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.98) 0%,
    rgba(22, 33, 62, 0.98) 50%,
    rgba(15, 52, 96, 0.98) 100%
  );
  z-index: 2000;

  &.is-mobile {
    z-index: 2000;
  }

  // 退出按钮
  &__exit {
    position: fixed;
    top: 20px;
    left: 20px;
    height: 40px;
    padding: 0 16px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    z-index: 10001;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    transition: all 0.2s ease;

    svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }

    &:active {
      transform: scale(0.96);
    }

    @media (max-width: 768px) {
      top: 15px;
      left: 15px;
      height: 36px;
      padding: 0 12px;
      font-size: 13px;

      svg {
        width: 14px;
        height: 14px;
      }
    }
  }

  // 手机框架容器
  &__frame {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

// iPhone 14 Pro 真机框架
.iphone-frame {
  position: relative;
  background-color: #0e0e0e;
  border: 1px solid #959595;
  border-radius: 45px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow:
    0 0 0 2px #1a1a1a,
    0 0 0 4px #2a2a2a,
    0 25px 50px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    border-radius: 38px;
    box-shadow:
      0 0 0 2px #1a1a1a,
      0 0 0 3px #2a2a2a,
      0 15px 30px rgba(0, 0, 0, 0.4);
  }
}

.screen-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 44px;
  overflow: hidden;
  z-index: 1;
  padding: 3px;
  box-sizing: border-box;
  background: #000;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 42px;
    display: block;
    opacity: 0;
    transition: opacity 0.4s ease;

    &.loaded {
      opacity: 1;
    }
  }

  @media (max-width: 768px) {
    border-radius: 36px;
    padding: 2px;

    img {
      border-radius: 34px;
    }
  }
}

// 灵动岛
.dynamic-island {
  position: absolute;
  top: 18px;
  width: 90px;
  height: 28px;
  background: #000;
  border-radius: 20px;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 768px) {
    top: 14px;
    width: 75px;
    height: 24px;
    border-radius: 16px;
    padding: 0 8px;
  }

  &.expanded {
    width: 180px;
    height: 45px;
    border-radius: 25px;

    @media (max-width: 768px) {
      width: 150px;
      height: 38px;
      border-radius: 20px;
    }

    .caller {
      opacity: 1;
      visibility: visible;

      .avatar {
        width: 30px;
        height: 30px;

        @media (max-width: 768px) {
          width: 24px;
          height: 24px;
        }
      }

      .info span {
        opacity: 1;
        visibility: visible;
        line-height: 10px;
      }
    }

    .actions {
      opacity: 1;
      visibility: visible;

      .refuse {
        background-color: #ff4438;
        color: #fff;
      }

      .answer {
        background-color: #30d258;
        color: #fff;
      }
    }
  }
}

.caller {
  display: flex;
  align-items: center;
  color: #fff;
  opacity: 0;
  visibility: hidden;
  transition: 0.4s;

  .avatar {
    width: 0;
    height: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    margin-right: 8px;
    transition: 0.4s;

    @media (max-width: 768px) {
      margin-right: 6px;
    }
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 3px;

    span {
      font-size: 9px;
      color: #cdcdcd;
      font-weight: 500;
      line-height: 0;
      opacity: 0;
      visibility: hidden;
      transition: 0.4s;

      @media (max-width: 768px) {
        font-size: 8px;
      }
    }

    p {
      font-size: 11px;
      color: #f0f8ff;
      margin: 0;

      @media (max-width: 768px) {
        font-size: 10px;
      }
    }
  }
}

.actions {
  display: flex;
  gap: 10px;
  opacity: 0;
  visibility: hidden;
  transition: 0.4s 0.2s;

  @media (max-width: 768px) {
    gap: 8px;
  }

  .refuse,
  .answer {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;

    @media (max-width: 768px) {
      width: 24px;
      height: 24px;

      svg {
        width: 12px;
        height: 12px;
      }
    }
  }

  .refuse {
    color: #ff4438;
    transform: rotate(135deg);
  }

  .answer {
    color: #30d258;
  }
}

// 时钟
.clock {
  position: absolute;
  top: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    top: 55px;
  }

  span {
    font-size: 58px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
    line-height: 1;
    margin: 0 2px;

    @media (max-width: 768px) {
      font-size: 46px;
      margin: 0 1px;
    }
  }

  .colon {
    position: relative;
    top: -5px;
    margin: 0 4px;

    @media (max-width: 768px) {
      top: -4px;
      margin: 0 2px;
    }
  }
}

.home-indicator {
  position: absolute;
  bottom: 12px;
  width: 40%;
  height: 5px;
  background-color: #fff;
  border-radius: 3px;
  z-index: 2;

  @media (max-width: 768px) {
    bottom: 10px;
    height: 4px;
  }
}

// 物理按键
.mute-btn,
.volume-up-btn,
.volume-down-btn,
.power-btn {
  position: absolute;
  width: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, #ccc, #666, #222);

  @media (max-width: 768px) {
    width: 2px;
  }
}

.mute-btn {
  left: -3px;
  top: 100px;
  height: 22px;

  @media (max-width: 768px) {
    left: -2px;
    top: 80px;
    height: 18px;
  }
}

.volume-up-btn {
  left: -3px;
  top: 150px;
  height: 45px;

  @media (max-width: 768px) {
    left: -2px;
    top: 115px;
    height: 36px;
  }
}

.volume-down-btn {
  left: -3px;
  top: 205px;
  height: 45px;

  @media (max-width: 768px) {
    left: -2px;
    top: 160px;
    height: 36px;
  }
}

.power-btn {
  right: -3px;
  top: 165px;
  height: 75px;

  @media (max-width: 768px) {
    right: -2px;
    top: 130px;
    height: 60px;
  }
}

// Vue Transition 动画
.device-mode-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.device-mode-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(30px);
}

.device-mode-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.device-mode-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}
</style>
