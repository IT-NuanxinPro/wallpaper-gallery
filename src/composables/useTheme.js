// ========================================
// 全局主题 Composable
// 统一管理主题模式、实际生效主题、系统监听与首屏同步
// ========================================

import { computed, ref } from 'vue'
import { trackThemeChange } from '@/utils/common/analytics'
import { STORAGE_KEYS, THEME_MODES, THEMES } from '@/utils/config/constants'

const theme = ref(THEMES.LIGHT)
const themeMode = ref(THEME_MODES.SYSTEM)

const THEME_COLOR_MAP = {
  [THEMES.LIGHT]: '#6366f1',
  [THEMES.DARK]: '#0f0f1a',
}

let initialized = false
let mediaQueryList = null
let cleanupSystemListener = null
let autoThemeTimerId = 0
let documentListenersBound = false

function isClient() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function readStorage(key) {
  if (!isClient())
    return null

  try {
    return window.localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function writeStorage(key, value) {
  if (!isClient())
    return

  try {
    window.localStorage.setItem(key, value)
  }
  catch {
  }
}

function removeStorage(key) {
  if (!isClient())
    return

  try {
    window.localStorage.removeItem(key)
  }
  catch {
  }
}

function getThemeByTime(date = new Date()) {
  const hour = date.getHours()
  return hour >= 6 && hour < 18 ? THEMES.LIGHT : THEMES.DARK
}

function getThemeBySystem() {
  if (!isClient() || !window.matchMedia)
    return THEMES.LIGHT

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT
}

function computeTheme(mode) {
  switch (mode) {
    case THEME_MODES.LIGHT:
      return THEMES.LIGHT
    case THEME_MODES.DARK:
      return THEMES.DARK
    case THEME_MODES.AUTO:
      return getThemeByTime()
    case THEME_MODES.SYSTEM:
    default:
      return getThemeBySystem()
  }
}

function applyThemeToDom(resolvedTheme) {
  if (!isClient())
    return

  document.documentElement.setAttribute('data-theme', resolvedTheme)
  document.documentElement.style.colorScheme = resolvedTheme

  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', THEME_COLOR_MAP[resolvedTheme] || THEME_COLOR_MAP[THEMES.LIGHT])
  }
}

function persistThemeMode(mode) {
  writeStorage(STORAGE_KEYS.THEME_MODE, mode)

  if (mode === THEME_MODES.LIGHT || mode === THEME_MODES.DARK) {
    writeStorage(STORAGE_KEYS.THEME, mode)
  }
  else {
    removeStorage(STORAGE_KEYS.THEME)
  }
}

function syncResolvedTheme() {
  const resolvedTheme = computeTheme(themeMode.value)
  theme.value = resolvedTheme
  applyThemeToDom(resolvedTheme)
  return resolvedTheme
}

function clearAutoThemeTimer() {
  if (!isClient() || !autoThemeTimerId)
    return

  window.clearTimeout(autoThemeTimerId)
  autoThemeTimerId = 0
}

function scheduleAutoThemeRefresh() {
  clearAutoThemeTimer()

  if (!isClient() || themeMode.value !== THEME_MODES.AUTO)
    return

  const now = new Date()
  const nextBoundary = new Date(now)

  if (now.getHours() < 6) {
    nextBoundary.setHours(6, 0, 1, 0)
  }
  else if (now.getHours() < 18) {
    nextBoundary.setHours(18, 0, 1, 0)
  }
  else {
    nextBoundary.setDate(nextBoundary.getDate() + 1)
    nextBoundary.setHours(6, 0, 1, 0)
  }

  const delay = Math.max(nextBoundary.getTime() - now.getTime(), 1000)
  autoThemeTimerId = window.setTimeout(() => {
    syncResolvedTheme()
    scheduleAutoThemeRefresh()
  }, delay)
}

function handleSystemThemeChange() {
  if (themeMode.value === THEME_MODES.SYSTEM) {
    syncResolvedTheme()
  }
}

function bindSystemThemeListener() {
  if (!isClient() || !window.matchMedia)
    return

  cleanupSystemListener?.()

  mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => handleSystemThemeChange()

  if (mediaQueryList.addEventListener) {
    mediaQueryList.addEventListener('change', listener)
    cleanupSystemListener = () => mediaQueryList?.removeEventListener('change', listener)
  }
  else {
    mediaQueryList.addListener(listener)
    cleanupSystemListener = () => mediaQueryList?.removeListener(listener)
  }
}

function handleVisibilitySync() {
  if (document.visibilityState === 'hidden')
    return

  if (themeMode.value === THEME_MODES.SYSTEM || themeMode.value === THEME_MODES.AUTO) {
    syncResolvedTheme()
  }

  if (themeMode.value === THEME_MODES.AUTO) {
    scheduleAutoThemeRefresh()
  }
}

function bindDocumentListeners() {
  if (!isClient() || documentListenersBound)
    return

  document.addEventListener('visibilitychange', handleVisibilitySync)
  window.addEventListener('focus', handleVisibilitySync)
  documentListenersBound = true
}

function readInitialThemeMode() {
  const savedMode = readStorage(STORAGE_KEYS.THEME_MODE)
  if (savedMode && Object.values(THEME_MODES).includes(savedMode)) {
    return savedMode
  }

  const legacyTheme = readStorage(STORAGE_KEYS.THEME)
  if (legacyTheme && Object.values(THEMES).includes(legacyTheme)) {
    return legacyTheme
  }

  return THEME_MODES.SYSTEM
}

function updateThemeMode(nextMode, { track = true } = {}) {
  if (!Object.values(THEME_MODES).includes(nextMode))
    return

  const previousResolvedTheme = theme.value
  themeMode.value = nextMode
  persistThemeMode(nextMode)
  const resolvedTheme = syncResolvedTheme()
  scheduleAutoThemeRefresh()

  if (track && previousResolvedTheme !== resolvedTheme) {
    trackThemeChange(resolvedTheme)
  }
}

function initTheme() {
  if (!initialized) {
    bindSystemThemeListener()
    bindDocumentListeners()
    initialized = true
  }

  themeMode.value = readInitialThemeMode()
  syncResolvedTheme()
  scheduleAutoThemeRefresh()
}

export function useTheme() {
  const toggleTheme = () => {
    const nextTheme = theme.value === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK
    updateThemeMode(nextTheme)
  }

  const setTheme = (newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      updateThemeMode(newTheme)
    }
  }

  const setThemeMode = (newMode) => {
    updateThemeMode(newMode)
  }

  const isDark = computed(() => theme.value === THEMES.DARK)

  const themeOptions = [
    { value: THEME_MODES.SYSTEM, label: '跟随系统', description: '根据设备当前主题自动切换' },
    { value: THEME_MODES.LIGHT, label: '浅色模式', description: '始终使用明亮界面' },
    { value: THEME_MODES.DARK, label: '深色模式', description: '始终使用深色界面' },
    { value: THEME_MODES.AUTO, label: '昼夜自动', description: '白天浅色，夜间深色' },
  ]

  return {
    theme,
    themeMode,
    isDark,
    themeOptions,
    toggleTheme,
    setTheme,
    setThemeMode,
    initTheme,
  }
}
