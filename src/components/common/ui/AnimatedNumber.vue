<script setup>
/**
 * 数字滚动动画组件
 * 使用 GSAP 实现丝滑的数字变化效果
 * 支持批量加载和渐进加载时的数字变化动画
 */
import { gsap } from 'gsap'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMotionPreference } from '@/composables/useMotionPreference'

const props = defineProps({
  value: {
    type: Number,
    default: 0,
  },
  // 动画持续时间（秒）
  duration: {
    type: Number,
    default: 0.6,
  },
  // 缓动函数
  ease: {
    type: String,
    default: 'power2.out',
  },
  // 是否在挂载时播放动画
  animateOnMount: {
    type: Boolean,
    default: true,
  },
  // 数字格式化函数
  formatter: {
    type: Function,
    default: null,
  },
})

// 显示的数值（用于动画）
const displayValue = ref(props.animateOnMount ? 0 : props.value)
const numberRef = ref(null)
const reducedMotion = useMotionPreference()

// 格式化数字
function formatNumber(num) {
  if (props.formatter) {
    return props.formatter(num)
  }
  return Math.round(num).toLocaleString()
}

// 动画到目标值
function animateTo(targetValue, fromValue = null) {
  gsap.killTweensOf(displayValue)
  if (reducedMotion.value || targetValue === 0) {
    displayValue.value = targetValue
    return
  }
  const startValue = fromValue !== null ? fromValue : displayValue.value

  // 如果值没变化，不播放动画
  if (startValue === targetValue) {
    return
  }

  // 计算动画时间：数值变化越大，时间稍长
  const diff = Math.abs(targetValue - startValue)
  let duration = props.duration

  // 小幅变化（如加载更多 +20 张）使用更短的动画
  if (diff <= 30) {
    duration = Math.min(duration, 0.3)
  }
  else if (diff <= 100) {
    duration = Math.min(duration, 0.4)
  }

  gsap.to(displayValue, {
    value: targetValue,
    duration,
    ease: props.ease,
  })
}

// 监听 value 变化
watch(() => props.value, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    animateTo(newValue)
  }
})

watch(reducedMotion, (reduced) => {
  if (reduced) {
    gsap.killTweensOf(displayValue)
    displayValue.value = props.value
  }
})

onBeforeUnmount(() => gsap.killTweensOf(displayValue))

// 挂载时播放初始动画
onMounted(() => {
  if (props.animateOnMount && props.value > 0) {
    animateTo(props.value, 0)
  }
  else {
    displayValue.value = props.value
  }
})
</script>

<template>
  <span ref="numberRef" class="animated-number">
    {{ formatNumber(displayValue) }}
  </span>
</template>

<style lang="scss" scoped>
.animated-number {
  display: inline-block;
  font-variant-numeric: tabular-nums;
  // 使用等宽数字，避免宽度跳动
  font-feature-settings: 'tnum';
}
</style>
