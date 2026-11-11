<script setup>
import { ElMessage } from 'element-plus'
import { gsap } from 'gsap'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import linuxdoIcon from '@/assets/svg/liunxdo.svg'
import AuthFlowPanel from '@/components/login/AuthFlowPanel.vue'
import LoginCharacterScene from '@/components/login/LoginCharacterScene.vue'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { formatSupabaseAuthError } from '@/utils/auth/errors'
import { getAuthRedirectTargetFromRoute } from '@/utils/auth/redirect'

const props = defineProps({
  mode: {
    type: String,
    default: 'login',
  },
})

const providers = [
  { id: 'github', label: 'GitHub', oauthProvider: 'github', available: true },
  { id: 'linuxdo', label: 'Linux.do', oauthProvider: 'custom:linuxdo', available: true },
  { id: 'google', label: 'Google', oauthProvider: 'google', available: true },
]

const router = useRouter()
const route = useRoute()
const { theme, toggleTheme } = useTheme()
const authStore = useAuthStore()
const {
  displayName,
  isAuthenticated,
  isConfigured,
  isInitialized,
  isInitializing,
} = storeToRefs(authStore)

const form = reactive({
  agree: false,
  confirmPassword: '',
  displayName: '',
  email: '',
  password: '',
})

const errors = reactive({
  agree: '',
  confirmPassword: '',
  displayName: '',
  email: '',
  password: '',
})

const activeField = ref('')
const authCardRef = ref(null)
const authContentRef = ref(null)
const authSceneRef = ref(null)
const authPanelRef = ref(null)
const feedback = reactive({
  message: '',
  type: 'info',
})
const isSubmitting = ref(false)
const loadingProvider = ref('')
const pendingEmailConfirmation = ref(null)
const showConfirmPassword = ref(false)
const showPassword = ref(false)
const swapDirection = ref(1)

let actionTimer = null
const AUTH_ROUTE_CLASS = 'auth-page-route'

const isSignup = computed(() => props.mode === 'signup')
const isTyping = computed(() => activeField.value === 'email')
const activeSecretLength = computed(() => (activeField.value === 'confirmPassword' ? form.confirmPassword.length : form.password.length))
const activeSecretVisible = computed(() => (activeField.value === 'confirmPassword' ? showConfirmPassword.value : showPassword.value))
const redirectTarget = computed(() => getAuthRedirectTargetFromRoute(route))
const isAuthUnavailable = computed(() => !isConfigured.value)
const isAuthBusy = computed(() => isSubmitting.value || isInitializing.value)
const isDarkTheme = computed(() => theme.value === 'dark')

const cardDescription = computed(() => (isSignup.value
  ? '创建账号后同步喜欢、收藏和下载记录。'
  : '登录后同步喜欢、收藏和下载记录。'))
const primaryLabel = computed(() => (isSignup.value ? '创建账号' : '登录'))
const submittingLabel = computed(() => (isSignup.value ? '创建中...' : '登录中...'))
const footerPrompt = computed(() => (isSignup.value ? '已经有账号了？' : '还没有账号？'))
const footerAction = computed(() => (isSignup.value ? '登录' : '注册'))
const footerRoute = computed(() => (isSignup.value ? '/login' : '/signup'))
const authConfigMessage = computed(() => (isAuthUnavailable.value
  ? '当前环境还没有配置 Supabase Auth，登录能力暂不可用。'
  : ''))
const themeToggleLabel = computed(() => (isDarkTheme.value ? '切换到浅色模式' : '切换到深色模式'))
const showSignupConfirmation = computed(() => isSignup.value && Boolean(pendingEmailConfirmation.value))
const authContentKey = computed(() => `${props.mode}-${showSignupConfirmation.value ? 'confirmation' : 'form'}`)
const currentLoadingProvider = computed(() =>
  providers.find(provider => provider.id === loadingProvider.value) || null,
)
const loadingOverlayTitle = computed(() =>
  currentLoadingProvider.value
    ? `正在跳转到 ${currentLoadingProvider.value.label}`
    : '正在发起授权登录',
)
const loadingOverlayText = computed(() =>
  currentLoadingProvider.value
    ? `即将打开 ${currentLoadingProvider.value.label} 授权页，授权完成后会自动返回并同步你的账号资料。`
    : '请稍候...',
)
const signupConfirmationBadge = computed(() => pendingEmailConfirmation.value?.email || '')
const signupConfirmationText = computed(() => {
  const email = pendingEmailConfirmation.value?.email || '你的邮箱'
  return `我们已向 ${email} 发送验证邮件。完成邮箱验证后，返回登录即可继续同步你的喜欢、收藏和下载记录。`
})

function formatAuthError(error) {
  return formatSupabaseAuthError(error, '登录请求失败，请稍后再试。')
}

function ensureAuthReady() {
  if (isAuthUnavailable.value) {
    feedback.type = 'warning'
    feedback.message = authConfigMessage.value
    ElMessage.warning('Supabase Auth 未配置')
    return false
  }

  return true
}

function redirectAuthenticatedUser() {
  if (!isInitialized.value || !isAuthenticated.value) {
    return
  }

  router.replace(redirectTarget.value)
}

function clearActionTimer() {
  if (actionTimer) {
    window.clearTimeout(actionTimer)
    actionTimer = null
  }
}

function clearFeedback() {
  feedback.message = ''
  feedback.type = 'info'
}

function resetSignupConfirmation() {
  pendingEmailConfirmation.value = null
}

function resetErrors() {
  errors.agree = ''
  errors.confirmPassword = ''
  errors.displayName = ''
  errors.email = ''
  errors.password = ''
}

function setFieldFocus(field) {
  activeField.value = field
}

function clearFieldFocus(field) {
  if (activeField.value === field) {
    activeField.value = ''
  }
}

async function handleBackNavigation() {
  await router.replace(redirectTarget.value)
}

function validateEmail(value) {
  const emailParts = value.split('@')
  const domainPart = emailParts[1] || ''
  return emailParts.length === 2 && emailParts[0] && domainPart.includes('.')
}

function validateForm() {
  resetErrors()

  if (isSignup.value && form.displayName.trim().length < 2) {
    errors.displayName = '请输入至少 2 个字的昵称。'
  }

  if (!form.email.trim()) {
    errors.email = '请输入邮箱地址。'
  }
  else if (!validateEmail(form.email.trim())) {
    errors.email = '请输入有效的邮箱地址。'
  }

  if (!form.password) {
    errors.password = '请输入密码。'
  }
  else if (form.password.length < 6) {
    errors.password = '密码长度至少需要 6 位。'
  }

  if (isSignup.value && !form.confirmPassword) {
    errors.confirmPassword = '请再次输入密码。'
  }
  else if (isSignup.value && form.confirmPassword !== form.password) {
    errors.confirmPassword = '两次输入的密码不一致。'
  }

  if (isSignup.value && !form.agree) {
    errors.agree = '请先同意账号服务条款。'
  }

  return !errors.displayName && !errors.email && !errors.password && !errors.confirmPassword && !errors.agree
}

async function handleSubmit() {
  clearActionTimer()
  clearFeedback()

  if (!ensureAuthReady()) {
    return
  }

  if (!validateForm()) {
    feedback.type = 'error'
    feedback.message = isSignup.value ? '请先补全注册信息。' : '请先补全登录信息。'
    return
  }

  isSubmitting.value = true

  try {
    if (isSignup.value) {
      const result = await authStore.signUpWithPassword({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        nextTarget: redirectTarget.value,
        password: form.password,
      })

      if (result.requiresEmailConfirmation) {
        swapDirection.value = 1
        pendingEmailConfirmation.value = {
          email: form.email.trim(),
        }
        ElMessage.success('验证邮件已发送')
        return
      }

      feedback.type = 'success'
      feedback.message = '账号创建成功，正在跳转到你的壁纸库...'
      ElMessage.success('账号创建成功')
      await router.replace(redirectTarget.value)
      return
    }

    await authStore.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    })

    feedback.type = 'success'
    feedback.message = `欢迎回来，${displayName.value}。正在进入壁纸库...`
    ElMessage.success('登录成功')
    await router.replace(redirectTarget.value)
  }
  catch (error) {
    const message = formatAuthError(error)
    feedback.type = 'error'
    feedback.message = message
    ElMessage.error(message)
  }
  finally {
    isSubmitting.value = false
  }
}

async function handleProvider(provider) {
  clearActionTimer()
  clearFeedback()

  if (!provider.available) {
    feedback.type = 'info'
    feedback.message = `${provider.label} 登录暂时不可用，请稍后再试。`
    ElMessage.info(`${provider.label} 登录暂不可用`)
    return
  }

  if (!ensureAuthReady()) {
    return
  }

  loadingProvider.value = provider.id

  try {
    await authStore.signInWithProvider(provider.oauthProvider || provider.id, redirectTarget.value)
  }
  catch (error) {
    const message = formatAuthError(error)
    feedback.type = 'error'
    feedback.message = message
    ElMessage.error(message)
    loadingProvider.value = ''
  }
}

function getProviderLabel(provider) {
  return loadingProvider.value === provider.id ? '连接中...' : provider.label
}

function isProviderDisabled(provider) {
  return (Boolean(loadingProvider.value) && loadingProvider.value !== provider.id) || isAuthBusy.value || isAuthUnavailable.value
}

function getAnimatedItems(root = authContentRef.value) {
  if (!root) {
    return []
  }

  return Array.from(
    root.querySelectorAll(
      '.auth-card__header, .auth-field, .auth-agreement, .auth-feedback, .auth-submit, .auth-social, .auth-card__footer, .auth-confirmation, .auth-confirmation__notes, .auth-confirmation__actions',
    ),
  )
}

function animateCardContent(direction = 1) {
  const items = getAnimatedItems()
  if (!items.length) {
    return
  }

  gsap.killTweensOf(items)
  gsap.fromTo(
    items,
    {
      autoAlpha: 0,
      x: direction > 0 ? 24 : -24,
      y: 8,
      filter: 'blur(8px)',
    },
    {
      autoAlpha: 1,
      clearProps: 'filter,opacity,transform',
      duration: 0.52,
      ease: 'power3.out',
      filter: 'blur(0px)',
      stagger: 0.06,
      x: 0,
      y: 0,
    },
  )
}

function handleContentBeforeEnter(element) {
  const items = getAnimatedItems(element)
  gsap.set(element, {
    autoAlpha: 0,
    rotate: swapDirection.value > 0 ? 0.45 : -0.45,
    scale: 0.968,
    x: swapDirection.value > 0 ? 38 : -38,
  })
  gsap.set(items, {
    autoAlpha: 0,
    x: swapDirection.value > 0 ? 26 : -26,
    y: 14,
  })
}

function handleContentEnter(element, done) {
  const items = getAnimatedItems(element)
  const timeline = gsap.timeline({
    defaults: {
      ease: 'power3.out',
    },
    onComplete: done,
  })

  timeline.to(element, {
    autoAlpha: 1,
    clearProps: 'opacity,transform',
    duration: 0.62,
    ease: 'expo.out',
    rotate: 0,
    scale: 1,
    x: 0,
  })

  timeline.to(
    items,
    {
      autoAlpha: 1,
      clearProps: 'opacity,transform',
      duration: 0.52,
      ease: 'power4.out',
      stagger: 0.065,
      x: 0,
      y: 0,
    },
    0.08,
  )
}

function handleContentLeave(element, done) {
  const items = getAnimatedItems(element)
  const timeline = gsap.timeline({
    defaults: {
      ease: 'power2.inOut',
    },
    onComplete: done,
  })

  timeline.to(items, {
    autoAlpha: 0,
    duration: 0.18,
    stagger: {
      amount: 0.14,
      from: 'end',
    },
    x: swapDirection.value > 0 ? -16 : 16,
    y: -8,
  })

  timeline.to(
    element,
    {
      autoAlpha: 0,
      duration: 0.24,
      ease: 'power2.inOut',
      rotate: swapDirection.value > 0 ? -0.35 : 0.35,
      scale: 0.98,
      x: swapDirection.value > 0 ? -24 : 24,
    },
    0,
  )
}

function runShellEntrance() {
  if (authPanelRef.value) {
    gsap.fromTo(
      authPanelRef.value,
      {
        autoAlpha: 0,
      },
      {
        autoAlpha: 1,
        duration: 0.18,
        ease: 'linear',
      },
    )
  }

  if (authSceneRef.value) {
    gsap.fromTo(
      authSceneRef.value,
      {
        autoAlpha: 0,
        filter: 'blur(10px)',
        rotation: -3.5,
        scale: 0.92,
        x: -54,
        y: 30,
      },
      {
        autoAlpha: 1,
        clearProps: 'filter,opacity,transform',
        duration: 0.96,
        ease: 'expo.out',
        filter: 'blur(0px)',
        rotation: 0,
        scale: 1,
        x: 0,
        y: 0,
      },
    )
  }

  if (authCardRef.value) {
    gsap.fromTo(
      authCardRef.value,
      {
        autoAlpha: 0,
        filter: 'blur(12px)',
        rotation: 1.6,
        scale: 0.86,
        x: 120,
        y: 22,
      },
      {
        autoAlpha: 1,
        clearProps: 'filter,opacity,transform',
        duration: 1.02,
        ease: 'expo.out',
        filter: 'blur(0px)',
        rotation: 0,
        scale: 1,
        x: 0,
        y: 0,
      },
    )
  }

  animateCardContent(1)
}

function toggleAuthPageRouteClass(enabled) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle(AUTH_ROUTE_CLASS, enabled)
  document.body.classList.toggle(AUTH_ROUTE_CLASS, enabled)
}

onMounted(() => {
  toggleAuthPageRouteClass(true)
  runShellEntrance()
  authStore.initialize()

  if (isAuthUnavailable.value) {
    feedback.type = 'warning'
    feedback.message = authConfigMessage.value
  }

  redirectAuthenticatedUser()
})

onUnmounted(() => {
  toggleAuthPageRouteClass(false)
  clearActionTimer()
})

watch(
  () => props.mode,
  (mode, previousMode) => {
    if (!previousMode || mode === previousMode) {
      return
    }

    swapDirection.value = mode === 'signup' ? 1 : -1
    resetSignupConfirmation()
  },
)

watch(isAuthenticated, () => {
  redirectAuthenticatedUser()
})

watch(isConfigured, (value) => {
  if (!value) {
    feedback.type = 'warning'
    feedback.message = authConfigMessage.value
  }
})
</script>

<template>
  <div class="auth-page" :class="{ 'auth-page--dark': isDarkTheme }">
    <button
      class="auth-theme-toggle"
      type="button"
      :aria-label="themeToggleLabel"
      @click="toggleTheme"
    >
      <svg v-if="isDarkTheme" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>

    <div class="auth-shell">
      <section class="auth-hero">
        <RouterLink to="/" class="auth-brand">
          <span class="auth-brand__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </span>
          <span class="auth-brand__copy">
            <strong>Wallpaper Gallery</strong>
          </span>
        </RouterLink>

        <div ref="authSceneRef" class="auth-scene">
          <div class="auth-scene__stage">
            <LoginCharacterScene
              :is-typing="isTyping"
              :password-length="activeSecretLength"
              :show-password="activeSecretVisible"
            />
          </div>
        </div>

        <div class="auth-hero__footer">
          <RouterLink to="/">
            返回壁纸库
          </RouterLink>
        </div>
      </section>

      <section ref="authPanelRef" class="auth-panel">
        <div ref="authCardRef" class="auth-card">
          <Transition
            :css="false"
            mode="out-in"
            @before-enter="handleContentBeforeEnter"
            @enter="handleContentEnter"
            @leave="handleContentLeave"
          >
            <div :key="authContentKey" ref="authContentRef" class="auth-card__content">
              <button
                type="button"
                class="auth-mobile-back"
                :disabled="isAuthBusy"
                @click="handleBackNavigation"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span>返回</span>
              </button>

              <div class="auth-card__brandline">
                <span>Wallpaper Gallery</span>
              </div>

              <div class="auth-card__header">
                <p>{{ cardDescription }}</p>
                <p v-if="authConfigMessage" class="auth-card__hint">
                  {{ authConfigMessage }}
                </p>
              </div>

              <div v-if="showSignupConfirmation" class="auth-confirmation">
                <AuthFlowPanel
                  badge="邮箱验证"
                  :eyebrow="isSignup ? '注册已完成' : '状态更新'"
                  state="success"
                  :text="signupConfirmationText"
                  title="验证邮件已发送"
                />

                <div class="auth-confirmation__notes">
                  <p>验证邮箱：{{ signupConfirmationBadge }}</p>
                  <p>如果暂时没看到邮件，也可以检查垃圾邮箱或广告邮件分类。</p>
                </div>

                <div class="auth-confirmation__actions">
                  <RouterLink class="auth-action-button auth-action-button--primary" :to="footerRoute">
                    前往登录
                  </RouterLink>
                  <button type="button" class="auth-action-button auth-action-button--ghost" @click="resetSignupConfirmation">
                    修改邮箱
                  </button>
                </div>
              </div>

              <form v-else class="auth-form" @submit.prevent="handleSubmit">
                <div v-if="isSignup" class="auth-field">
                  <label for="auth-display-name">昵称</label>
                  <input
                    id="auth-display-name"
                    v-model.trim="form.displayName"
                    autocomplete="nickname"
                    class="auth-input"
                    :disabled="isAuthBusy || isAuthUnavailable"
                    placeholder="给你的账号起个名字"
                    type="text"
                    @focus="setFieldFocus('displayName')"
                    @blur="clearFieldFocus('displayName')"
                  >
                  <p v-if="errors.displayName" class="auth-field__error">
                    {{ errors.displayName }}
                  </p>
                </div>

                <div class="auth-field">
                  <label for="auth-email">邮箱</label>
                  <input
                    id="auth-email"
                    v-model.trim="form.email"
                    autocomplete="email"
                    class="auth-input"
                    :disabled="isAuthBusy || isAuthUnavailable"
                    placeholder="请输入常用邮箱"
                    type="email"
                    @focus="setFieldFocus('email')"
                    @blur="clearFieldFocus('email')"
                  >
                  <p v-if="errors.email" class="auth-field__error">
                    {{ errors.email }}
                  </p>
                </div>

                <div class="auth-field">
                  <label for="auth-password">密码</label>
                  <div class="auth-input-wrap">
                    <input
                      id="auth-password"
                      v-model="form.password"
                      :type="showPassword ? 'text' : 'password'"
                      autocomplete="current-password"
                      class="auth-input auth-input--password"
                      :disabled="isAuthBusy || isAuthUnavailable"
                      placeholder="请输入密码"
                      @focus="setFieldFocus('password')"
                      @blur="clearFieldFocus('password')"
                    >
                    <button
                      type="button"
                      class="auth-password-toggle"
                      :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                      @click="showPassword = !showPassword"
                    >
                      <svg v-if="showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.88 2.96-5.08 5.4-6.32" />
                        <path d="M1 1l22 22" />
                        <path d="M9.9 4.24A10.93 10.93 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-4.08 5.16" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      </svg>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  <p v-if="errors.password" class="auth-field__error">
                    {{ errors.password }}
                  </p>
                </div>

                <div v-if="isSignup" class="auth-field">
                  <label for="auth-confirm-password">确认密码</label>
                  <div class="auth-input-wrap">
                    <input
                      id="auth-confirm-password"
                      v-model="form.confirmPassword"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      autocomplete="new-password"
                      class="auth-input auth-input--password"
                      :disabled="isAuthBusy || isAuthUnavailable"
                      placeholder="请再次输入密码"
                      @focus="setFieldFocus('confirmPassword')"
                      @blur="clearFieldFocus('confirmPassword')"
                    >
                    <button
                      type="button"
                      class="auth-password-toggle"
                      :aria-label="showConfirmPassword ? '隐藏确认密码' : '显示确认密码'"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <svg v-if="showConfirmPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.88 2.96-5.08 5.4-6.32" />
                        <path d="M1 1l22 22" />
                        <path d="M9.9 4.24A10.93 10.93 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-4.08 5.16" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      </svg>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  <p v-if="errors.confirmPassword" class="auth-field__error">
                    {{ errors.confirmPassword }}
                  </p>
                </div>

                <div v-if="isSignup" class="auth-agreement">
                  <label class="auth-check auth-check--agreement">
                    <input v-model="form.agree" :disabled="isAuthBusy || isAuthUnavailable" type="checkbox">
                    <span class="auth-check__mark" />
                    <span>我已阅读并同意账号服务条款与隐私政策</span>
                  </label>
                  <p v-if="errors.agree" class="auth-field__error auth-field__error--agreement">
                    {{ errors.agree }}
                  </p>
                </div>

                <div
                  v-if="feedback.message"
                  class="auth-feedback"
                  :class="`auth-feedback--${feedback.type}`"
                >
                  {{ feedback.message }}
                </div>

                <button class="auth-submit" type="submit" :disabled="isAuthBusy || isAuthUnavailable">
                  <span class="auth-submit__text">{{ isAuthBusy ? submittingLabel : primaryLabel }}</span>
                  <svg class="auth-submit__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </button>
              </form>
            </div>
          </Transition>

          <div v-if="!showSignupConfirmation" class="auth-social">
            <div class="auth-social__divider">
              <span>第三方登录</span>
            </div>

            <div class="auth-social__row">
              <button
                v-for="provider in providers"
                :key="provider.id"
                class="auth-social__button"
                :class="{ 'auth-social__button--unavailable': !provider.available }"
                :disabled="isProviderDisabled(provider)"
                type="button"
                @click="handleProvider(provider)"
              >
                <span class="auth-social__icon" :class="`auth-social__icon--${provider.id}`">
                  <svg v-if="provider.id === 'github'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.52v-1.84c-2.94.64-3.56-1.25-3.56-1.25-.48-1.21-1.18-1.53-1.18-1.53-.97-.66.07-.65.07-.65 1.07.08 1.64 1.1 1.64 1.1.95 1.63 2.5 1.16 3.11.89.1-.69.37-1.16.67-1.43-2.35-.27-4.82-1.18-4.82-5.27 0-1.16.41-2.12 1.09-2.87-.11-.27-.47-1.37.1-2.86 0 0 .89-.29 2.92 1.1a10.1 10.1 0 0 1 5.31 0c2.03-1.39 2.92-1.1 2.92-1.1.57 1.49.21 2.59.1 2.86.68.75 1.09 1.71 1.09 2.87 0 4.1-2.48 4.99-4.84 5.25.38.33.72.98.72 1.98v2.94c0 .29.19.63.73.52A10.5 10.5 0 0 0 12 1.5Z" />
                  </svg>
                  <img
                    v-else-if="provider.id === 'google'"
                    src="https://www.google.com/favicon.ico"
                    alt=""
                  >
                  <img
                    v-else-if="provider.id === 'linuxdo'"
                    :src="linuxdoIcon"
                    alt=""
                  >
                </span>
                <span>{{ getProviderLabel(provider) }}</span>
              </button>
            </div>
            <p class="auth-social__hint">
              支持 GitHub、Google、Linux.do 与邮箱登录，登录后会自动同步你的账号资料。
            </p>
          </div>

          <div v-if="!showSignupConfirmation" class="auth-card__footer">
            <span>{{ footerPrompt }}</span>
            <RouterLink :to="footerRoute">
              {{ footerAction }}
            </RouterLink>
          </div>
        </div>
      </section>
    </div>

    <Transition name="auth-overlay">
      <div
        v-if="loadingProvider"
        class="auth-redirect-overlay"
        role="status"
        aria-live="assertive"
        aria-label="正在等待第三方授权"
        aria-busy="true"
      >
        <div class="auth-redirect-overlay__panel">
          <AuthFlowPanel
            badge="第三方授权"
            :eyebrow="currentLoadingProvider?.label || '登录中'"
            state="loading"
            :text="loadingOverlayText"
            :title="loadingOverlayTitle"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;

:global(html.auth-page-route) {
  scrollbar-gutter: stable both-edges;
  overflow-y: scroll;
}

:global(body.auth-page-route) {
  scrollbar-gutter: stable both-edges;
  overflow-y: scroll;
}

.auth-page {
  --auth-bg: #eef5ff;
  --auth-bg-accent: #dbeafe;
  --auth-hero-start: #1a3664;
  --auth-hero-mid: #2f5ea1;
  --auth-hero-end: #60a5fa;
  --auth-hero-glow: rgba(255, 255, 255, 0.28);
  --auth-hero-glow-strong: rgba(191, 219, 254, 0.62);
  --auth-hero-surface: rgba(255, 255, 255, 0.12);
  --auth-hero-surface-border: rgba(255, 255, 255, 0.14);
  --auth-hero-text: rgba(255, 255, 255, 0.94);
  --auth-hero-muted: rgba(255, 255, 255, 0.78);
  --auth-card-bg:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.82)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.1), rgba(14, 165, 233, 0.06) 54%, rgba(255, 255, 255, 0));
  --auth-card-border: rgba(255, 255, 255, 0.38);
  --auth-card-shadow: 0 28px 72px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.42);
  --auth-input-bg: rgba(248, 251, 255, 0.84);
  --auth-input-border: rgba(96, 165, 250, 0.18);
  --auth-input-focus: rgba(37, 99, 235, 0.12);
  --auth-heading: #0f172a;
  --auth-text: #526277;
  --auth-muted: #64748b;
  --auth-line: rgba(148, 163, 184, 0.18);
  --auth-accent-start: #2563eb;
  --auth-accent-end: #0ea5e9;
  --auth-button-start: #3b82f6;
  --auth-button-end: #1d4ed8;
  --auth-button-hover-start: #2563eb;
  --auth-button-hover-end: #1e40af;
  --auth-accent-warm: rgba(96, 165, 250, 0.2);
  --auth-accent-shadow: rgba(37, 99, 235, 0.22);
  --auth-link-bg: rgba(37, 99, 235, 0.08);
  --auth-link-border: rgba(37, 99, 235, 0.14);
  --auth-link-text: #1d4ed8;
  --auth-soft-surface: rgba(248, 251, 255, 0.82);
  --auth-soft-surface-hover: rgba(255, 255, 255, 0.94);
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--page-gradient);
}

.auth-theme-toggle {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 999px;
  color: var(--auth-heading);
  background: rgba(248, 251, 255, 0.82);
  box-shadow:
    0 12px 32px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.48);
  backdrop-filter: blur(18px);
  transition:
    transform 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    color 180ms ease;

  @include tablet-up {
    top: 18px;
    right: 18px;
  }

  @include desktop-up {
    top: 28px;
    right: 28px;
  }
}

.auth-theme-toggle:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
}

.auth-theme-toggle svg {
  width: 18px;
  height: 18px;
}

.auth-shell {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;

  @include desktop-up {
    grid-template-columns: minmax(0, 1fr) minmax(420px, 0.88fr);
  }
}

.auth-hero {
  display: none;

  @include desktop-up {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 28px;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 40px 42px 28px;
    background:
      radial-gradient(circle at 16% 14%, var(--auth-hero-glow), transparent 26%),
      radial-gradient(circle at 80% 18%, rgba(125, 211, 252, 0.18), transparent 30%),
      radial-gradient(circle at 72% 78%, rgba(14, 165, 233, 0.14), transparent 34%),
      linear-gradient(145deg, var(--auth-hero-start) 0%, var(--auth-hero-mid) 48%, var(--auth-hero-end) 100%);
  }
}

.auth-hero::before {
  content: '';
  position: absolute;
  inset: 24px;
  border-radius: 32px;
  border: 1px solid var(--auth-hero-surface-border);
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.14), transparent 24%),
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.08),
      transparent 34%,
      rgba(255, 255, 255, 0.03) 66%,
      transparent 100%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -80px 120px rgba(15, 23, 42, 0.1);
  opacity: 0.72;
  pointer-events: none;
  z-index: 0;
}

.auth-hero::after {
  content: '';
  position: absolute;
  right: -12%;
  bottom: -18%;
  width: 440px;
  height: 440px;
  border-radius: 999px;
  background: radial-gradient(circle, var(--auth-hero-glow-strong), transparent 68%);
  filter: blur(12px);
  opacity: 0.9;
  pointer-events: none;
  z-index: 0;
}

.auth-hero > * {
  position: relative;
  z-index: 1;
}

.auth-brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: var(--auth-hero-text);
}

.auth-brand:hover {
  color: white;
}

.auth-brand__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: var(--accent-gradient);
  backdrop-filter: blur(12px);
  box-shadow:
    0 18px 38px rgba(15, 23, 42, 0.2),
    0 12px 32px var(--auth-accent-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.auth-brand__icon svg {
  width: 22px;
  height: 22px;
}

.auth-brand__copy {
  display: inline-flex;
  align-items: center;
}

.auth-brand__copy strong {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-shadow: 0 10px 28px rgba(15, 23, 42, 0.22);
}

.auth-scene {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex: 1;
  min-height: 0;
  padding-bottom: 0;
}

.auth-scene__stage {
  width: 100%;
  max-width: 700px;
  min-height: 660px;
  padding-top: 52px;
}

.auth-scene__stage :deep(.scene-wrapper) {
  min-height: 100%;
}

.auth-scene__stage :deep(.scene-canvas) {
  transform: translateY(46px) scale(1.24);
  transform-origin: bottom center;
}

.auth-hero__footer {
  display: flex;
  gap: 12px;
}

.auth-hero__footer a {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--auth-hero-surface-border);
  border-radius: 999px;
  color: var(--auth-hero-muted);
  background: var(--auth-hero-surface);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 14px 30px rgba(15, 23, 42, 0.12);
  transition:
    background 180ms ease,
    transform 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
}

.auth-hero__footer a:hover {
  color: white;
  background: rgba(255, 255, 255, 0.16);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 18px 34px rgba(15, 23, 42, 0.16);
  transform: translateY(-1px);
}

.auth-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 14px 12px;

  @include tablet-up {
    padding: 18px;
  }

  @include desktop-up {
    padding: 24px 28px;
  }
}

.auth-card {
  position: relative;
  isolation: isolate;
  width: 100%;
  max-width: 408px;
  max-height: calc(100vh - 28px);
  max-height: calc(100dvh - 28px);
  padding: 16px 16px 14px;
  overflow: auto;
  // background: var(--auth-card-bg);
  border: 1px solid var(--auth-card-border);
  border-radius: 30px;
  box-shadow: var(--auth-card-shadow);
  backdrop-filter: blur(24px);
  scrollbar-width: none;

  @include tablet-up {
    padding: 20px 20px 16px;
  }

  @include desktop-up {
    max-width: 396px;
    max-height: calc(100vh - 48px);
    max-height: calc(100dvh - 48px);
  }
}

.auth-card::-webkit-scrollbar {
  display: none;
}

.auth-card__brandline {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--auth-heading);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.auth-mobile-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  margin-bottom: 8px;
  padding: 0 14px;
  border: 1px solid var(--auth-link-border);
  border-radius: 999px;
  color: var(--auth-link-text);
  background: rgba(239, 246, 255, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.52);
  transition:
    transform 180ms ease,
    background 180ms ease,
    color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;

  @include desktop-up {
    display: none;
  }
}

.auth-mobile-back:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.62),
    0 14px 26px rgba(37, 99, 235, 0.1);
}

.auth-mobile-back:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.auth-mobile-back svg {
  width: 16px;
  height: 16px;
}

.auth-mobile-back span {
  font-size: 13px;
  font-weight: 600;
}

.auth-card__header {
  margin: 10px 0 16px;
  text-align: center;
}

.auth-card__content {
  will-change: transform, opacity;
  transform-origin: top center;
}

.auth-card__header p {
  margin-top: 0;
  color: var(--auth-text);
  font-size: 14px;
  line-height: 1.7;
}

.auth-card__hint {
  margin: 10px 0 0;
  padding: 10px 14px;
  border-radius: 16px;
  color: #92400e;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.16);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-field label {
  display: inline-flex;
  margin-bottom: 8px;
  color: var(--auth-heading);
  font-size: 14px;
  font-weight: 600;
}

.auth-input-wrap {
  position: relative;
}

.auth-input {
  width: 100%;
  min-height: 54px;
  padding: 0 18px;
  border: 1px solid var(--auth-input-border);
  border-radius: 18px;
  background: var(--auth-input-bg);
  color: var(--auth-heading);
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.auth-input::placeholder {
  color: #94a3b8;
}

.auth-input:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.auth-input:focus {
  transform: translateY(-1px);
  border-color: rgba(37, 99, 235, 0.26);
  // box-shadow:
  //   0 0 0 5px var(--auth-input-focus),
  //   0 2px 8px rgba(37, 99, 235, 0.12);
}

.auth-input--password {
  padding-right: 56px;
}

.auth-password-toggle {
  position: absolute;
  top: 50%;
  right: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #64748b;
  transform: translateY(-50%);
  transition: color 180ms ease;
}

.auth-password-toggle:hover {
  color: var(--auth-heading);
}

.auth-password-toggle svg {
  width: 18px;
  height: 18px;
}

.auth-check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--auth-text);
  font-size: 14px;
  cursor: pointer;
}

.auth-check input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.auth-check__mark {
  position: relative;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.82);
  transition:
    background 180ms ease,
    border-color 180ms ease;
}

.auth-check__mark::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 3px;
  background: var(--auth-accent-start);
  opacity: 0;
  transform: scale(0.7);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.auth-check input:checked + .auth-check__mark {
  border-color: var(--auth-link-border);
  background: var(--auth-link-bg);
}

.auth-check input:checked + .auth-check__mark::after {
  opacity: 1;
  transform: scale(1);
}

.auth-check--agreement {
  align-items: flex-start;
  line-height: 1.7;
}

.auth-field__error {
  margin-top: 8px;
  color: #dc2626;
  font-size: 13px;
}

.auth-field__error--agreement {
  margin-top: 6px;
}

.auth-feedback {
  padding: 14px 16px;
  border-radius: 18px;
  font-size: 13px;
  line-height: 1.7;
}

.auth-feedback--info {
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.14);
}

.auth-feedback--success {
  color: #166534;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.16);
}

.auth-feedback--error {
  color: #b91c1c;
  background: rgba(248, 113, 113, 0.14);
  border: 1px solid rgba(239, 68, 68, 0.16);
}

.auth-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 54px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: 16px;
  color: white;
  background: linear-gradient(135deg, var(--auth-button-start) 0%, var(--auth-button-end) 100%);
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.22);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.auth-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  background: linear-gradient(135deg, var(--auth-button-hover-start) 0%, var(--auth-button-hover-end) 100%);
  box-shadow: 0 20px 38px rgba(37, 99, 235, 0.28);
}

.auth-submit:disabled {
  cursor: not-allowed;
  opacity: 0.74;
}

.auth-submit__text {
  font-weight: 700;
}

.auth-submit__arrow {
  width: 16px;
  height: 16px;
  opacity: 0.88;
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.auth-submit:hover:not(:disabled) .auth-submit__arrow {
  transform: translateX(3px);
  opacity: 1;
}

.auth-social {
  margin-top: 16px;
}

.auth-social__divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--auth-muted);
  font-size: 12px;
}

.auth-social__divider::before,
.auth-social__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--auth-line);
}

.auth-social__row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.auth-social__button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 88px;
  padding: 12px 10px;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 22px;
  background: var(--auth-soft-surface);
  color: var(--auth-heading);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.46),
    0 10px 22px rgba(37, 99, 235, 0.06);
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.auth-social__button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--auth-soft-surface-hover);
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.56),
    0 16px 30px rgba(37, 99, 235, 0.12);
}

.auth-social__button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.auth-social__button--unavailable {
  border-style: dashed;
}

.auth-social__button span:last-child {
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  line-height: 1.4;
}

.auth-social__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  color: #0f172a;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.92)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.04));
  border: 1px solid rgba(96, 165, 250, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.56),
    0 10px 20px rgba(37, 99, 235, 0.08);
}

.auth-social__icon svg {
  width: 18px;
  height: 18px;
}

.auth-social__icon img {
  width: 18px;
  height: 18px;
  display: block;
}

.auth-social__icon--github {
  color: #0f172a;
}

.auth-social__hint {
  margin: 12px 0 0;
  color: var(--auth-muted);
  font-size: 12px;
  line-height: 1.7;
}

.auth-confirmation {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 6px 2px 4px;
}

.auth-confirmation__notes {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(248, 251, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: var(--auth-text);
  font-size: 13px;
  line-height: 1.7;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.68);
    border-color: rgba(96, 165, 250, 0.18);
  }
}

.auth-confirmation__notes p {
  margin: 0;
}

.auth-confirmation__notes p + p {
  margin-top: 6px;
}

.auth-confirmation__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.auth-action-button {
  flex: 1 1 0;
  min-width: 0;
  min-height: 48px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 15px;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease,
    color 180ms ease;
}

.auth-action-button--primary {
  color: white;
  background: linear-gradient(135deg, var(--auth-button-start) 0%, var(--auth-button-end) 100%);
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.18);
}

.auth-action-button--ghost {
  color: var(--auth-heading);
  border: 1px solid var(--auth-link-border);
  background: rgba(248, 251, 255, 0.86);

  [data-theme='dark'] & {
    color: var(--auth-text);
    background: rgba(15, 23, 42, 0.74);
  }
}

.auth-action-button:hover {
  transform: translateY(-1px);
}

.auth-action-button--primary:hover {
  box-shadow: 0 20px 40px rgba(37, 99, 235, 0.24);
}

.auth-action-button--ghost:hover {
  box-shadow: 0 14px 24px rgba(15, 23, 42, 0.08);
}

.auth-card__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  color: var(--auth-muted);
  font-size: 14px;
}

.auth-card__footer a {
  position: relative;
  color: var(--auth-link-text);
  font-weight: 600;
  transition:
    color 180ms ease,
    opacity 180ms ease;
}

.auth-card__footer a::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -2px;
  left: 0;
  height: 1px;
  background: currentColor;
  opacity: 0.55;
  transform: scaleX(0.42);
  transform-origin: left center;
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.auth-card__footer a:hover {
  opacity: 0.84;
}

.auth-card__footer a:hover::after {
  opacity: 0.9;
  transform: scaleX(1);
}

@media (max-width: 767px) {
  .auth-panel {
    padding: 10px;
  }

  .auth-card {
    max-height: calc(100vh - 20px);
    max-height: calc(100dvh - 20px);
    padding: 16px 14px 14px;
    border-radius: 26px;
  }

  .auth-scene__stage :deep(.scene-canvas) {
    transform: scale(1.06);
  }

  .auth-scene__stage :deep(.scene-canvas) {
    transform: translateY(14px) scale(1.06);
  }
}

.auth-page--dark {
  --auth-bg: #07111f;
  --auth-bg-accent: #0f172a;
  --auth-hero-start: #020617;
  --auth-hero-mid: #0f2546;
  --auth-hero-end: #1d4ed8;
  --auth-hero-glow: rgba(37, 99, 235, 0.22);
  --auth-hero-glow-strong: rgba(56, 189, 248, 0.28);
  --auth-hero-surface: rgba(10, 19, 34, 0.26);
  --auth-hero-surface-border: rgba(96, 165, 250, 0.16);
  --auth-hero-text: rgba(248, 250, 252, 0.96);
  --auth-hero-muted: rgba(191, 219, 254, 0.84);
  --auth-card-bg:
    linear-gradient(180deg, rgba(5, 11, 24, 0.96), rgba(9, 16, 30, 0.92)),
    linear-gradient(140deg, rgba(59, 130, 246, 0.16), rgba(14, 165, 233, 0.08) 55%, rgba(2, 6, 23, 0));
  --auth-card-border: rgba(148, 163, 184, 0.18);
  --auth-card-shadow: 0 32px 96px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --auth-input-bg: rgba(10, 19, 34, 0.88);
  --auth-input-border: rgba(96, 165, 250, 0.18);
  --auth-input-focus: rgba(59, 130, 246, 0.14);
  --auth-heading: #f8fafc;
  --auth-text: #cbd5e1;
  --auth-muted: #94a3b8;
  --auth-line: rgba(148, 163, 184, 0.12);
  --auth-accent-start: #60a5fa;
  --auth-accent-end: #38bdf8;
  --auth-button-start: #60a5fa;
  --auth-button-end: #2563eb;
  --auth-button-hover-start: #4f96f8;
  --auth-button-hover-end: #1d4ed8;
  --auth-accent-warm: rgba(96, 165, 250, 0.22);
  --auth-accent-shadow: rgba(59, 130, 246, 0.22);
  --auth-link-bg: rgba(59, 130, 246, 0.14);
  --auth-link-border: rgba(96, 165, 250, 0.18);
  --auth-link-text: #bfdbfe;
  --auth-soft-surface: rgba(10, 19, 34, 0.88);
  --auth-soft-surface-hover: rgba(13, 24, 44, 0.96);
}

.auth-page--dark .auth-card {
  background: var(--auth-card-bg);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow:
    0 32px 96px rgba(0, 0, 0, 0.52),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.auth-page--dark .auth-input {
  background: rgba(10, 19, 34, 0.88);
  border-color: rgba(96, 165, 250, 0.18);
}

.auth-page--dark .auth-input::placeholder {
  color: #64748b;
}

.auth-page--dark .auth-password-toggle {
  color: #94a3b8;
}

.auth-page--dark .auth-mobile-back,
.auth-page--dark .auth-theme-toggle {
  background: rgba(10, 19, 34, 0.88);
  border-color: rgba(96, 165, 250, 0.18);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.28);
}

.auth-page--dark .auth-mobile-back:hover:not(:disabled),
.auth-page--dark .auth-theme-toggle:hover {
  background: rgba(13, 24, 44, 0.96);
}

.auth-page--dark .auth-card__hint {
  color: #fcd34d;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.16);
}

.auth-page--dark .auth-social__button {
  background: rgba(10, 19, 34, 0.88);
  border-color: rgba(96, 165, 250, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 22px rgba(2, 6, 23, 0.22);
}

.auth-page--dark .auth-social__button:hover:not(:disabled) {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 16px 30px rgba(37, 99, 235, 0.16);
}

.auth-page--dark .auth-check__mark {
  background: rgba(15, 23, 42, 0.8);
}

.auth-redirect-overlay {
  position: fixed;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 6vw, 48px);
  background:
    rgba(7, 17, 31, 0.4), radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.16), transparent 35%),
    radial-gradient(circle at 80% 15%, rgba(14, 165, 233, 0.12), transparent 38%),
    radial-gradient(circle at 70% 80%, rgba(59, 130, 246, 0.1), transparent 42%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.auth-redirect-overlay__panel {
  width: min(420px, 100%);
}

.auth-overlay-enter-active,
.auth-overlay-leave-active {
  transition: opacity 220ms ease;
}

.auth-overlay-enter-from,
.auth-overlay-leave-to {
  opacity: 0;
}
</style>
