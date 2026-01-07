// ========================================
// 主题切换 Composable
// 简化版：仅支持浅色/暗色手动切换
// ========================================

import { computed, onMounted, ref, watch } from 'vue'
import { trackThemeChange } from '@/utils/analytics'
import { STORAGE_KEYS, THEMES } from '@/utils/constants'

// 当前主题（默认浅色）
const theme = ref(THEMES.LIGHT)

// 应用主题到 DOM
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value)
}

export function useTheme() {
  // 初始化主题
  const initTheme = () => {
    // 读取用户保存的主题
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME)
    if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
      theme.value = savedTheme
    }
    else {
      // 默认浅色
      theme.value = THEMES.LIGHT
    }
    applyTheme()
  }

  // 切换主题
  const toggleTheme = () => {
    theme.value = theme.value === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT
    trackThemeChange(theme.value)
  }

  // 设置指定主题
  const setTheme = (newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      theme.value = newTheme
    }
  }

  // 监听主题变化，保存到 localStorage 并应用
  watch(theme, (newTheme) => {
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme)
    applyTheme()
  })

  // 组件挂载时初始化
  onMounted(() => {
    initTheme()
  })

  // 计算属性
  const isDark = computed(() => theme.value === THEMES.DARK)

  // 主题选项（用于UI选择器）
  const themeOptions = [
    { value: THEMES.LIGHT, label: '浅色', icon: '☀️' },
    { value: THEMES.DARK, label: '深色', icon: '🌙' },
  ]

  return {
    theme,
    isDark,
    themeOptions,
    toggleTheme,
    setTheme,
    initTheme,
  }
}
