import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client'
import {
  buildProfileSyncPatch,
  formatAccountHandle,
  getIdentityAccountHandle,
  getIdentityAvatarUrl,
  getUserAccountHandle,
  getUserDisplayName,
  getUserPrimaryEmail,
  sanitizePublicAvatarUrl,
} from '@/utils/auth/providerProfile'
import { getLinkedIdentityByProvider, normalizeAuthProviderKey } from '@/utils/auth/providers'

const PROFILE_SELECT_FIELDS = 'id, username, display_name, avatar_url, bio, primary_email, primary_provider, role, status, extra'
const PREFERENCES_SELECT_FIELDS = 'user_id, default_series, theme_mode, sort_mode, sync_local_preferences, email_updates, data'
const AUTH_PROVIDER_STORAGE_KEY = 'wallpaper-gallery-auth-provider'
const AUTH_PROVIDER_PENDING_STORAGE_KEY = 'wallpaper-gallery-auth-provider-pending'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const profile = ref(null)
  const preferences = ref(null)
  const linkedIdentities = ref([])
  const currentAuthProvider = ref(readStoredProvider(AUTH_PROVIDER_STORAGE_KEY))
  const isInitializing = ref(false)
  const isInitialized = ref(false)
  const lastError = ref('')

  let authSubscription = null
  let initializePromise = null

  const isConfigured = computed(() => isSupabaseConfigured())
  const user = computed(() => session.value?.user || null)
  const isAuthenticated = computed(() => Boolean(user.value))
  const displayName = computed(() => profile.value?.display_name || getUserDisplayName(user.value))
  const activeAuthProvider = computed(() =>
    normalizeAuthProviderKey(currentAuthProvider.value)
    || normalizeAuthProviderKey(user.value?.app_metadata?.provider)
    || 'email',
  )
  const activeIdentity = computed(() => getLinkedIdentityByProvider(linkedIdentities.value, activeAuthProvider.value))
  const avatarCandidates = computed(() => {
    const avatarByProvider = {
      github: sanitizePublicAvatarUrl(getIdentityAvatarUrl(getLinkedIdentityByProvider(linkedIdentities.value, 'github'))),
      google: sanitizePublicAvatarUrl(getIdentityAvatarUrl(getLinkedIdentityByProvider(linkedIdentities.value, 'google'))),
    }

    switch (activeAuthProvider.value) {
      case 'github':
        return avatarByProvider.github ? [avatarByProvider.github] : []
      case 'google':
        return avatarByProvider.google ? [avatarByProvider.google] : []
      case 'linuxdo':
      case 'email':
      default:
        return []
    }
  })
  const avatarUrl = computed(() => avatarCandidates.value[0] || '')
  const primaryEmail = computed(() => profile.value?.primary_email || getUserPrimaryEmail(user.value) || '')
  const accountHandle = computed(() => {
    const identityHandle = getIdentityAccountHandle(activeIdentity.value)
    if (identityHandle) {
      return identityHandle
    }

    const linuxDoUsername = String(profile.value?.extra?.provider_username || '').trim()
    if (linuxDoUsername) {
      return linuxDoUsername
    }

    const profileUsername = String(profile.value?.username || '').trim()
    if (profileUsername) {
      return profileUsername
    }

    return getUserAccountHandle(user.value)
  })
  const accountHandleText = computed(() => formatAccountHandle(accountHandle.value))
  const accountSecondaryLabel = computed(() =>
    primaryEmail.value || accountHandleText.value || '当前账号暂未返回邮箱地址',
  )

  function clearUserState() {
    session.value = null
    profile.value = null
    preferences.value = null
    linkedIdentities.value = []
    clearStoredProvider(AUTH_PROVIDER_STORAGE_KEY)
    clearStoredProvider(AUTH_PROVIDER_PENDING_STORAGE_KEY)
    currentAuthProvider.value = ''
  }

  function readStoredProvider(storageKey) {
    if (typeof window === 'undefined') {
      return ''
    }

    try {
      return normalizeAuthProviderKey(window.localStorage.getItem(storageKey))
    }
    catch {
      return ''
    }
  }

  function writeStoredProvider(storageKey, provider) {
    if (typeof window === 'undefined') {
      return
    }

    const normalizedProvider = normalizeAuthProviderKey(provider)
    if (!normalizedProvider) {
      clearStoredProvider(storageKey)
      return
    }

    window.localStorage.setItem(storageKey, normalizedProvider)
  }

  function clearStoredProvider(storageKey) {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.removeItem(storageKey)
  }

  function setCurrentAuthProvider(provider) {
    const normalizedProvider = normalizeAuthProviderKey(provider) || 'email'
    currentAuthProvider.value = normalizedProvider
    writeStoredProvider(AUTH_PROVIDER_STORAGE_KEY, normalizedProvider)
    clearStoredProvider(AUTH_PROVIDER_PENDING_STORAGE_KEY)
  }

  function rememberPendingAuthProvider(provider) {
    writeStoredProvider(AUTH_PROVIDER_PENDING_STORAGE_KEY, provider)
  }

  function finalizeCurrentAuthProvider(provider) {
    const resolvedProvider
      = normalizeAuthProviderKey(provider)
        || readStoredProvider(AUTH_PROVIDER_PENDING_STORAGE_KEY)
        || currentAuthProvider.value
        || normalizeAuthProviderKey(user.value?.app_metadata?.provider)
        || 'email'

    setCurrentAuthProvider(resolvedProvider)
  }

  async function loadUserContext(currentUser = user.value) {
    if (!currentUser || !isConfigured.value) {
      profile.value = null
      preferences.value = null
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return
    }

    try {
      const [
        { data: profileData, error: profileError },
        { data: preferencesData, error: preferencesError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select(PROFILE_SELECT_FIELDS)
          .eq('id', currentUser.id)
          .maybeSingle(),
        supabase
          .from('user_preferences')
          .select(PREFERENCES_SELECT_FIELDS)
          .eq('user_id', currentUser.id)
          .maybeSingle(),
      ])

      if (profileError) {
        throw profileError
      }
      if (preferencesError) {
        throw preferencesError
      }

      profile.value = profileData || null
      preferences.value = preferencesData || null
      lastError.value = ''
    }
    catch (error) {
      profile.value = null
      preferences.value = null
      lastError.value = error?.message || '加载用户上下文失败'
      console.warn('[AuthStore] 加载用户上下文失败:', error)
    }
  }

  async function loadUserIdentities(currentUser = user.value) {
    if (!currentUser || !isConfigured.value) {
      linkedIdentities.value = []
      return []
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return []
    }

    try {
      const { data, error } = await supabase.auth.getUserIdentities()

      if (error) {
        throw error
      }

      linkedIdentities.value = data?.identities || []
      lastError.value = ''
      return linkedIdentities.value
    }
    catch (error) {
      linkedIdentities.value = []
      lastError.value = error?.message || '加载用户登录方式失败'
      console.warn('[AuthStore] 加载用户登录方式失败:', error)
      return []
    }
  }

  async function syncProfileFromUserMetadata(currentUser = user.value) {
    if (!currentUser || !profile.value || !isConfigured.value) {
      return
    }

    const patch = buildProfileSyncPatch(currentUser, profile.value)
    if (!Object.keys(patch).length) {
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', currentUser.id)
        .select(PROFILE_SELECT_FIELDS)
        .maybeSingle()

      if (error) {
        throw error
      }

      profile.value = data || { ...profile.value, ...patch }
      lastError.value = ''
    }
    catch (error) {
      lastError.value = error?.message || '同步第三方账号资料失败'
      console.warn('[AuthStore] 同步第三方账号资料失败:', error)
    }
  }

  async function applySession(nextSession) {
    session.value = nextSession

    if (!nextSession?.user) {
      profile.value = null
      preferences.value = null
      linkedIdentities.value = []
      return
    }

    await loadUserContext(nextSession.user)
    await syncProfileFromUserMetadata(nextSession.user)
    await loadUserIdentities(nextSession.user)
  }

  async function refreshSession() {
    if (!isConfigured.value) {
      clearUserState()
      return null
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return null
    }

    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    await applySession(currentSession)
    return currentSession
  }

  async function initialize() {
    if (!isConfigured.value) {
      isInitialized.value = true
      clearUserState()
      return null
    }

    if (initializePromise) {
      return initializePromise
    }

    initializePromise = (async () => {
      isInitializing.value = true

      try {
        const currentSession = await refreshSession()

        const supabase = getSupabaseClient()

        if (!authSubscription) {
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((event, nextSession) => {
            window.setTimeout(async () => {
              if (event === 'SIGNED_OUT') {
                clearUserState()
                lastError.value = ''
                try {
                  const { useInteractionStore } = await import('@/stores/interaction')
                  const interactionStore = useInteractionStore()
                  interactionStore.$reset()
                }
                catch {
                  // 静默处理
                }
                return
              }

              await applySession(nextSession)
            }, 0)
          })

          authSubscription = subscription
        }

        lastError.value = ''
        return currentSession
      }
      catch (error) {
        clearUserState()
        lastError.value = error?.message || '初始化登录状态失败'
        console.warn('[AuthStore] 初始化失败:', error)
        return null
      }
      finally {
        isInitializing.value = false
        isInitialized.value = true
      }
    })()

    return initializePromise
  }

  async function signInWithProvider(provider, nextTarget) {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase Auth 未配置')
    }

    const normalizedProvider = normalizeAuthProviderKey(provider)
    rememberPendingAuthProvider(normalizedProvider)

    const { buildAuthCallbackUrl } = await import('@/utils/auth/redirect')
    const { error } = await supabase.auth.signInWithOAuth({
      options: {
        redirectTo: buildAuthCallbackUrl(nextTarget, {
          flow: 'signin',
          provider: normalizedProvider,
        }),
      },
      provider,
    })

    if (error) {
      clearStoredProvider(AUTH_PROVIDER_PENDING_STORAGE_KEY)
      throw error
    }
  }

  async function linkIdentity(provider, nextTarget, context = {}) {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase Auth 未配置')
    }

    const { buildAuthCallbackUrl } = await import('@/utils/auth/redirect')
    const { error } = await supabase.auth.linkIdentity({
      options: {
        redirectTo: buildAuthCallbackUrl(nextTarget, {
          flow: context.flow || 'link',
          provider: context.provider || provider,
        }),
      },
      provider,
    })

    if (error) {
      throw error
    }
  }

  async function signInWithPassword({ email, password }) {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase Auth 未配置')
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    setCurrentAuthProvider('email')
    await applySession(data.session)
    return data
  }

  async function signUpWithPassword({ displayName: nextDisplayName, email, password, nextTarget }) {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase Auth 未配置')
    }

    const { buildAuthCallbackUrl } = await import('@/utils/auth/redirect')
    const { data, error } = await supabase.auth.signUp({
      email,
      options: {
        data: {
          display_name: nextDisplayName,
          full_name: nextDisplayName,
        },
        emailRedirectTo: buildAuthCallbackUrl(nextTarget),
      },
      password,
    })

    if (error) {
      throw error
    }

    if (data.session) {
      setCurrentAuthProvider('email')
      await applySession(data.session)
    }

    return {
      ...data,
      requiresEmailConfirmation: Boolean(data.user && !data.session),
    }
  }

  async function signOut() {
    const supabase = getSupabaseClient()
    if (!supabase) {
      clearUserState()
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }

    clearUserState()

    // 清除交互数据缓存（喜欢/收藏）
    try {
      const { useInteractionStore } = await import('@/stores/interaction')
      const interactionStore = useInteractionStore()
      interactionStore.$reset()
    }
    catch {
      // 静默处理，避免循环依赖或 store 未注册的异常
    }
  }

  async function unlinkIdentity(identity) {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase Auth 未配置')
    }

    const { error } = await supabase.auth.unlinkIdentity(identity)
    if (error) {
      throw error
    }

    await refreshSession()
  }

  async function updatePassword(password) {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase Auth 未配置')
    }

    const { data, error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      throw error
    }

    if (data?.user && session.value) {
      session.value = {
        ...session.value,
        user: data.user,
      }
    }

    await refreshSession()
    return data
  }

  async function updateProfileDisplayName(nextDisplayName) {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase Auth 未配置')
    }

    const currentUser = user.value
    if (!currentUser) {
      throw new Error('当前未登录')
    }

    const normalizedDisplayName = String(nextDisplayName || '').trim()
    if (!normalizedDisplayName) {
      throw new Error('昵称不能为空')
    }

    if (normalizedDisplayName === String(profile.value?.display_name || '').trim()) {
      return profile.value
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: normalizedDisplayName,
      })
      .eq('id', currentUser.id)
      .select(PROFILE_SELECT_FIELDS)
      .maybeSingle()

    if (error) {
      throw error
    }

    profile.value = data || {
      ...(profile.value || {}),
      display_name: normalizedDisplayName,
      id: currentUser.id,
    }
    lastError.value = ''
    return profile.value
  }

  return {
    activeAuthProvider,
    accountHandle,
    accountHandleText,
    accountSecondaryLabel,
    avatarCandidates,
    avatarUrl,
    displayName,
    finalizeCurrentAuthProvider,
    initialize,
    isAuthenticated,
    isConfigured,
    isInitialized,
    isInitializing,
    lastError,
    linkIdentity,
    linkedIdentities,
    loadUserContext,
    loadUserIdentities,
    preferences,
    primaryEmail,
    profile,
    refreshSession,
    session,
    signInWithPassword,
    signInWithProvider,
    signOut,
    signUpWithPassword,
    syncProfileFromUserMetadata,
    unlinkIdentity,
    updateProfileDisplayName,
    updatePassword,
    user,
  }
})
