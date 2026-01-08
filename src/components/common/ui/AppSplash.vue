<script setup>
import { onMounted, ref } from 'vue'

const emit = defineEmits(['complete'])

const show = ref(true)
const logoAnimated = ref(false)
const textAnimated = ref(false)
const subtitleAnimated = ref(false)
const fadeOut = ref(false)

onMounted(() => {
  // 动画序列
  setTimeout(() => {
    logoAnimated.value = true
  }, 100)

  setTimeout(() => {
    textAnimated.value = true
  }, 400)

  setTimeout(() => {
    subtitleAnimated.value = true
  }, 700)

  // 开始淡出
  setTimeout(() => {
    fadeOut.value = true
  }, 2000)

  // 完成
  setTimeout(() => {
    show.value = false
    emit('complete')
  }, 2500)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="splash-fade">
      <div v-if="show" class="app-splash" :class="{ 'fade-out': fadeOut }">
        <!-- 背景动画粒子 -->
        <div class="splash-particles">
          <div v-for="i in 20" :key="i" class="particle" :style="{ '--delay': `${i * 0.1}s`, '--x': `${Math.random() * 100}%`, '--duration': `${3 + Math.random() * 2}s` }" />
        </div>

        <!-- 光晕效果 -->
        <div class="splash-glow" />

        <!-- 主内容 -->
        <div class="splash-content">
          <!-- Logo -->
          <div class="splash-logo" :class="{ animated: logoAnimated }">
            <div class="logo-ring" />
            <div class="logo-ring ring-2" />
            <img src="/icon-192.png" alt="Logo" class="logo-image">
          </div>

          <!-- 标题 -->
          <h1 class="splash-title" :class="{ animated: textAnimated }">
            <span v-for="(char, index) in 'Wallpaper Gallery'" :key="index" class="char" :style="{ '--char-delay': `${index * 0.03}s` }">
              {{ char === ' ' ? '\u00A0' : char }}
            </span>
          </h1>

          <!-- 副标题 -->
          <p class="splash-subtitle" :class="{ animated: subtitleAnimated }">
            精选高清壁纸 · 让美触手可及
          </p>

          <!-- 加载指示器 -->
          <div class="splash-loader" :class="{ animated: subtitleAnimated }">
            <div class="loader-dot" />
            <div class="loader-dot" />
            <div class="loader-dot" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.app-splash {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  background-size: 200% 200%;
  animation: gradientShift 4s ease infinite;
  overflow: hidden;

  &.fade-out {
    animation: splashFadeOut 0.5s ease forwards;
  }
}

@keyframes gradientShift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes splashFadeOut {
  to {
    opacity: 0;
    transform: scale(1.1);
  }
}

// 粒子背景
.splash-particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  left: var(--x);
  bottom: -10px;
  animation: particleFloat var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
}

@keyframes particleFloat {
  0% {
    transform: translateY(0) scale(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
    transform: scale(1);
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100vh) scale(0.5);
    opacity: 0;
  }
}

// 光晕
.splash-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  animation: glowPulse 2s ease-in-out infinite;
}

@keyframes glowPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

// 主内容
.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

// Logo
.splash-logo {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 32px;
  opacity: 0;
  transform: scale(0.5) rotate(-10deg);
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);

  &.animated {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.logo-ring {
  position: absolute;
  inset: -15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  animation: ringRotate 3s linear infinite;

  &.ring-2 {
    inset: -25px;
    border-color: rgba(255, 255, 255, 0.15);
    animation-direction: reverse;
    animation-duration: 4s;
  }
}

@keyframes ringRotate {
  to {
    transform: rotate(360deg);
  }
}

.logo-image {
  width: 100%;
  height: 100%;
  border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

// 标题
.splash-title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  display: flex;

  .char {
    opacity: 0;
    transform: translateY(20px);
    display: inline-block;
  }

  &.animated .char {
    animation: charReveal 0.4s ease forwards;
    animation-delay: var(--char-delay);
  }
}

@keyframes charReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 副标题
.splash-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 40px;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.5s ease;

  &.animated {
    opacity: 1;
    transform: translateY(0);
  }
}

// 加载指示器
.splash-loader {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.3s ease;

  &.animated {
    opacity: 1;
  }
}

.loader-dot {
  width: 8px;
  height: 8px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: dotBounce 1.4s ease-in-out infinite;

  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes dotBounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

// 淡出动画
.splash-fade-leave-active {
  transition: opacity 0.3s ease;
}

.splash-fade-leave-to {
  opacity: 0;
}
</style>
