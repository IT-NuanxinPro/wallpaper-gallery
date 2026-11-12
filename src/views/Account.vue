<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import linuxdoIcon from '@/assets/svg/liunxdo.svg'
import PageLoadingScene from '@/components/common/feedback/PageLoadingScene.vue'
import RemoteAvatar from '@/components/common/ui/RemoteAvatar.vue'
import AccountConnections from '@/components/community/AccountConnections.vue'
import ProfileTabs from '@/components/community/ProfileTabs.vue'
import PublicProfileSettings from '@/components/community/PublicProfileSettings.vue'
import { useAuthStore } from '@/stores/auth'
import { useInteractionStore } from '@/stores/interaction'
import { getAvatarInitial, getAvatarStyle } from '@/utils/auth/avatarAppearance'
import { formatSupabaseAuthError } from '@/utils/auth/errors'
import {
  formatAccountHandle,
  getIdentityAccountHandle,
  getIdentityAvatarUrl,
  sanitizePublicAvatarUrl,
} from '@/utils/auth/providerProfile'
import {
  getAuthProviderDefinition,
  getAuthProviderKeyFromIdentity,
  getLinkedIdentityByProvider,
  isAuthProviderLinked,
  LINKABLE_OAUTH_PROVIDERS,
} from '@/utils/auth/providers'
import Library from './Library.vue'
import '@/components/community/community-page.css'

const ACCOUNT_ROUTE = '/account'

const router = useRouter()
const route = useRoute()
const interaction = useInteractionStore()
const accountTabs = computed(() => [
  { key: 'collections', label: '收藏夹', count: interaction.statsLoaded ? interaction.stats.collections : undefined },
  { key: 'likes', label: '喜欢', count: interaction.statsLoaded ? interaction.stats.likes : undefined },
  { key: 'following', label: '关注' },
  { key: 'followers', label: '粉丝' },
  { key: 'settings', label: '账号设置' },
])
const activeTab = computed(() => accountTabs.value.some(tab => tab.key === route.query.tab) ? route.query.tab : 'collections')
function changeTab(tab) {
  router.replace({ path: '/account', query: { tab } })
}
const authStore = useAuthStore()
const {
  activeAuthProvider,
  accountHandleText,
  avatarCandidates,
  avatarUrl,
  displayName,
  isAuthenticated,
  isConfigured,
  isInitialized,
  isInitializing,
  linkedIdentities,
  primaryEmail,
  user,
} = storeToRefs(authStore)

const pageState = computed(() => !isConfigured.value ? 'unavailable' : isAuthenticated.value && isInitialized.value ? 'ready' : 'loading')
const visitedPanels = ref(new Set([activeTab.value]))
const libraryTab = ref(activeTab.value === 'likes' ? 'likes' : 'collections')
const connectionKind = ref(activeTab.value === 'followers' ? 'followers' : 'following')
const connectionsRevision = ref(0)
function handleVisibilityChanged(actor) {
  if (actor === user.value?.id)
    connectionsRevision.value++
}
watch(activeTab, (tab) => {
  visitedPanels.value.add(tab)
  if (tab === 'collections' || tab === 'likes')
    libraryTab.value = tab
  if (tab === 'following' || tab === 'followers')
    connectionKind.value = tab
})
const activeProviderAction = ref('')
const isEditingDisplayName = ref(false)
const isSavingDisplayName = ref(false)
const isSavingPassword = ref(false)
const showPasswordDialog = ref(false)
const displayNameDraft = ref('')
const passwordForm = reactive({
  confirmPassword: '',
  password: '',
  showConfirmPassword: false,
  showPassword: false,
})

const providerDefinitions = LINKABLE_OAUTH_PROVIDERS

const authEmail = computed(() => primaryEmail.value || user.value?.email || '')
const visibleAccountHandle = computed(() => accountHandleText.value || '')
const visibleDisplayName = computed(() => {
  if (displayName.value) {
    return displayName.value
  }

  if (authEmail.value.includes('@')) {
    return authEmail.value.split('@')[0]
  }

  return visibleAccountHandle.value.replace(/^@/, '') || authEmail.value || '未命名用户'
})
const authInitial = computed(() => getAvatarInitial(visibleDisplayName.value || visibleAccountHandle.value || authEmail.value))
const authAvatarStyle = computed(() => getAvatarStyle(visibleDisplayName.value || visibleAccountHandle.value || authEmail.value))
const emailIdentity = computed(() => getLinkedIdentityByProvider(linkedIdentities.value, 'email'))
const emailPasswordEnabled = computed(() => Boolean(emailIdentity.value))
const linkedProviderKeys = computed(() =>
  Array.from(new Set(linkedIdentities.value.map(getAuthProviderKeyFromIdentity).filter(Boolean))),
)
const currentProviderLabel = computed(() => {
  const definition = getAuthProviderDefinition(activeAuthProvider.value || user.value?.app_metadata?.provider)
  return definition?.label || (emailPasswordEnabled.value ? '邮箱密码' : '未识别')
})
const passwordCardStatus = computed(() => (emailPasswordEnabled.value ? '已启用' : '未启用'))
const passwordDialogTitle = computed(() => (emailPasswordEnabled.value ? '更新邮箱密码' : '启用邮箱密码登录'))
const passwordSubmitLabel = computed(() => {
  if (isSavingPassword.value) {
    return emailPasswordEnabled.value ? '更新中...' : '启用中...'
  }

  return emailPasswordEnabled.value ? '更新密码' : '启用邮箱密码登录'
})
const canManagePassword = computed(() => Boolean(authEmail.value))

function formatAccountError(error) {
  return formatSupabaseAuthError(error, '账号操作失败，请稍后再试。')
}

function getLoginRoute() {
  return {
    path: '/login',
    query: {
      redirect: ACCOUNT_ROUTE,
    },
  }
}

function getProviderIdentity(providerKey) {
  return getLinkedIdentityByProvider(linkedIdentities.value, providerKey)
}

function getProviderAvatarUrl(providerKey) {
  return sanitizePublicAvatarUrl(getIdentityAvatarUrl(getProviderIdentity(providerKey)))
}

function isProviderLinked(providerKey) {
  return isAuthProviderLinked(linkedIdentities.value, providerKey)
}

function canUnlinkProvider(providerKey) {
  return Boolean(getProviderIdentity(providerKey)) && linkedIdentities.value.length > 1 && activeProviderAction.value !== providerKey
}

function getProviderIdentitySummary(providerKey) {
  const identity = getProviderIdentity(providerKey)
  if (!identity) {
    return '尚未绑定，后续可直接用这个账号登录同一份资料。'
  }

  const identityEmail = identity.email || identity.identity_data?.email
  const identityHandle = formatAccountHandle(getIdentityAccountHandle(identity))

  if (identityEmail) {
    return identityEmail
  }

  if (identityHandle) {
    return identityHandle
  }

  return '已绑定，可直接登录当前账号。'
}

function getProviderActionLabel(providerKey) {
  return activeProviderAction.value === providerKey ? '处理中...' : `绑定 ${getAuthProviderDefinition(providerKey)?.label || providerKey}`
}

function resetPasswordForm() {
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  passwordForm.showPassword = false
  passwordForm.showConfirmPassword = false
}

function closePasswordDialog() {
  if (isSavingPassword.value) {
    return
  }

  showPasswordDialog.value = false
  resetPasswordForm()
}

function openPasswordDialog() {
  if (!canManagePassword.value) {
    ElMessage.warning('当前账号没有可用邮箱，暂时不能启用邮箱密码登录。')
    return
  }

  resetPasswordForm()
  showPasswordDialog.value = true
}

function validatePasswordForm() {
  if (!canManagePassword.value) {
    return '当前账号没有可用邮箱，暂时不能启用邮箱密码登录。'
  }

  if (!passwordForm.password) {
    return '请输入密码。'
  }

  if (passwordForm.password.length < 6) {
    return '密码长度至少需要 6 位。'
  }

  if (!passwordForm.confirmPassword) {
    return '请再次输入密码。'
  }

  if (passwordForm.password !== passwordForm.confirmPassword) {
    return '两次输入的密码不一致。'
  }

  return ''
}

function startDisplayNameEdit() {
  displayNameDraft.value = visibleDisplayName.value
  isEditingDisplayName.value = true
}

function cancelDisplayNameEdit() {
  displayNameDraft.value = visibleDisplayName.value
  isEditingDisplayName.value = false
}

function validateDisplayName() {
  const normalizedDisplayName = String(displayNameDraft.value || '').trim()

  if (!normalizedDisplayName) {
    return '请输入昵称。'
  }

  if (normalizedDisplayName.length < 2) {
    return '昵称至少需要 2 个字符。'
  }

  return ''
}

async function ensurePageReady() {
  if (!isConfigured.value) {
    return
  }

  if (!isInitialized.value || isInitializing.value) {
    await authStore.initialize()
  }

  if (!isAuthenticated.value) {
    await router.replace(getLoginRoute())
    return
  }

  // 身份与标签先呈现，统计和壁纸内容独立更新。
  void interaction.loadLibraryData({ userId: user.value.id })
}

async function handleDisplayNameSave() {
  const validationMessage = validateDisplayName()
  if (validationMessage) {
    ElMessage.warning(validationMessage)
    return
  }

  isSavingDisplayName.value = true

  try {
    await authStore.updateProfileDisplayName(displayNameDraft.value)
    isEditingDisplayName.value = false
    ElMessage.success('昵称已更新')
  }
  catch (error) {
    ElMessage.error(formatAccountError(error))
  }
  finally {
    isSavingDisplayName.value = false
  }
}

async function handleLinkProvider(provider) {
  activeProviderAction.value = provider.key

  try {
    await authStore.linkIdentity(provider.oauthProvider, ACCOUNT_ROUTE, {
      flow: 'link',
      provider: provider.key,
    })
  }
  catch (error) {
    activeProviderAction.value = ''
    ElMessage.error(formatAccountError(error))
  }
}

async function handleUnlinkProvider(providerKey) {
  const provider = getAuthProviderDefinition(providerKey)
  const identity = getProviderIdentity(providerKey)
  if (!provider || !identity) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要移除 ${provider.label} 登录吗？移除后将不能再使用它直接登录当前账号。`,
      '解除绑定确认',
      {
        cancelButtonText: '取消',
        confirmButtonText: '继续解除',
        customClass: 'account-unlink-dialog',
        showClose: false,
        type: 'warning',
      },
    )
  }
  catch {
    return
  }

  activeProviderAction.value = provider.key

  try {
    await authStore.unlinkIdentity(identity)
    ElMessage({
      appendTo: document.body,
      grouping: false,
      message: `${provider.label} 已解除绑定`,
      type: 'success',
      zIndex: 4000,
    })
  }
  catch (error) {
    ElMessage.error(formatAccountError(error))
  }
  finally {
    activeProviderAction.value = ''
  }
}

async function handlePasswordSubmit() {
  const validationMessage = validatePasswordForm()
  if (validationMessage) {
    ElMessage.warning(validationMessage)
    return
  }

  isSavingPassword.value = true

  try {
    await authStore.updatePassword(passwordForm.password)
    showPasswordDialog.value = false
    resetPasswordForm()
    ElMessage.success(emailPasswordEnabled.value ? '密码已更新' : '邮箱密码登录已启用')
  }
  catch (error) {
    ElMessage.error(formatAccountError(error))
  }
  finally {
    isSavingPassword.value = false
  }
}

watch(visibleDisplayName, (nextDisplayName) => {
  if (!isEditingDisplayName.value) {
    displayNameDraft.value = nextDisplayName || ''
  }
}, { immediate: true })

watch(() => user.value?.id, (nextId, previousId) => {
  if (nextId === previousId)
    return
  visitedPanels.value = new Set([activeTab.value])
  isEditingDisplayName.value = false
  showPasswordDialog.value = false
  resetPasswordForm()
  if (!nextId) {
    interaction.$reset()
    router.replace(getLoginRoute())
  }
  else {
    void ensurePageReady()
  }
}, { flush: 'sync' })

onMounted(() => {
  ensurePageReady()
})
</script>

<template>
  <div class="account-page">
    <div class="container">
      <section class="account-shell">
        <PageLoadingScene
          v-if="pageState === 'loading'"
          title="个人中心加载中"
          text="正在同步账号资料..."
        />

        <template v-else>
          <div v-if="pageState !== 'ready'" class="account-state-card">
            <div class="account-state-card__icon" :class="`is-${pageState}`" />
            <h2>{{ pageState === 'unavailable' ? '当前环境尚未配置账号系统' : '正在加载账号信息' }}</h2>
            <p>
              {{
                pageState === 'unavailable'
                  ? '当前环境没有启用 Supabase Auth，所以暂时无法管理账号资料与登录绑定。'
                  : '正在同步登录状态与已绑定身份，请稍候。'
              }}
            </p>
            <RouterLink v-if="pageState !== 'unavailable'" class="account-primary-link" :to="getLoginRoute()">
              返回登录
            </RouterLink>
          </div>

          <div v-else :key="user?.id" class="account-hub">
            <header class="account-identity">
              <RemoteAvatar :sources="avatarCandidates" :src="avatarUrl" :alt="`${visibleDisplayName} 头像`" :initial="authInitial" :fallback-style="authAvatarStyle" image-class="account-identity__avatar" fallback-class="account-identity__avatar" />
              <div class="account-identity__copy">
                <h1>{{ visibleDisplayName }}</h1>
                <p>{{ visibleAccountHandle || '我的壁纸空间' }}</p>
                <div class="account-identity__stats">
                  <span>喜欢 <strong>{{ interaction.statsLoaded ? interaction.stats.likes : '—' }}</strong></span><span>收藏 <strong>{{ interaction.statsLoaded ? interaction.stats.collections : '—' }}</strong></span><span>下载 <strong>{{ interaction.statsLoaded ? interaction.stats.downloads : '—' }}</strong></span>
                </div>
              </div>
            </header>
            <ProfileTabs :tabs="accountTabs" :model-value="activeTab" @update:model-value="changeTab" />
            <div class="account-hub__content">
              <Library v-if="visitedPanels.has('collections') || visitedPanels.has('likes')" v-show="activeTab === 'collections' || activeTab === 'likes'" embedded :content-tab="libraryTab" />
              <AccountConnections v-if="visitedPanels.has('following') || visitedPanels.has('followers')" v-show="activeTab === 'following' || activeTab === 'followers'" :key="connectionsRevision" :kind="connectionKind" />
              <section v-if="visitedPanels.has('settings')" v-show="activeTab === 'settings'" class="account-layout">
                <div class="account-settings-column">
                  <article class="account-card account-card--profile">
                    <div class="account-card__header">
                      <h2>基本资料</h2>
                    </div>
                    <div class="account-overview">
                      <div class="account-overview__item">
                        <span>当前登录方式</span>
                        <strong>{{ currentProviderLabel }}</strong>
                      </div>
                      <div class="account-overview__item">
                        <span>密码状态</span>
                        <strong>{{ emailPasswordEnabled ? '已启用' : '未设置' }}</strong>
                      </div>
                      <div class="account-overview__item">
                        <span>已绑定方式</span>
                        <strong>{{ linkedProviderKeys.length }} 种</strong>
                      </div>
                    </div>

                    <div class="account-inline-panel" :class="{ 'is-editing': isEditingDisplayName }">
                      <div class="account-inline-panel__header">
                        <div class="account-inline-panel__copy">
                          <span class="account-inline-panel__label">昵称</span>
                          <div class="account-inline-panel__value-row">
                            <span>{{ visibleDisplayName }}</span>
                          </div>
                        </div>

                        <button
                          v-if="!isEditingDisplayName"
                          type="button"
                          class="account-action account-action--ghost account-action--compact"
                          @click="startDisplayNameEdit"
                        >
                          编辑昵称
                        </button>
                      </div>

                      <div v-if="isEditingDisplayName" class="account-inline-editor">
                        <input
                          v-model="displayNameDraft"
                          type="text"
                          class="account-input"
                          placeholder="输入新的昵称"
                          :disabled="isSavingDisplayName"
                          maxlength="32"
                        >

                        <div class="account-inline-editor__actions">
                          <button
                            type="button"
                            class="account-action account-action--primary"
                            :disabled="isSavingDisplayName"
                            @click="handleDisplayNameSave"
                          >
                            {{ isSavingDisplayName ? '保存中...' : '保存昵称' }}
                          </button>
                          <button
                            type="button"
                            class="account-action account-action--ghost"
                            :disabled="isSavingDisplayName"
                            @click="cancelDisplayNameEdit"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    </div>

                    <div class="account-inline-panel">
                      <div class="account-inline-panel__header">
                        <div class="account-inline-panel__copy">
                          <span class="account-inline-panel__label">账号</span>
                          <div class="account-inline-panel__value-row">
                            <span>{{ visibleAccountHandle || '当前账号暂未生成账号标识' }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="account-inline-panel">
                      <div class="account-inline-panel__header">
                        <div class="account-inline-panel__copy">
                          <span class="account-inline-panel__label">邮箱</span>
                          <div class="account-inline-panel__value-row">
                            <span>{{ authEmail || '当前第三方账号未返回邮箱地址' }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article class="account-card account-card--security">
                    <div class="account-card__header">
                      <div>
                        <h2>安全设置</h2>
                      </div>
                      <span class="account-card__badge" :class="{ 'is-active': emailPasswordEnabled }">
                        {{ passwordCardStatus }}
                      </span>
                    </div>

                    <div class="account-security">
                      <div class="account-security__copy">
                        <strong>{{ passwordDialogTitle }}</strong>
                        <p>
                          {{
                            canManagePassword
                              ? '设置后可以直接使用邮箱密码登录当前账号。'
                              : '当前账号没有可用邮箱，暂时不能启用邮箱密码登录。'
                          }}
                        </p>
                      </div>

                      <div class="account-security__actions">
                        <button
                          type="button"
                          class="account-action account-action--primary"
                          :disabled="!canManagePassword"
                          @click="openPasswordDialog"
                        >
                          {{ passwordDialogTitle }}
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
                <div class="account-settings-column">
                  <PublicProfileSettings @visibility-changed="handleVisibilityChanged" />
                  <article class="account-card account-card--providers">
                    <div class="account-card__header">
                      <div>
                        <h2>第三方绑定</h2>
                      </div>
                      <span class="account-card__badge">{{ linkedProviderKeys.length }} 已绑定</span>
                    </div>

                    <div class="provider-list">
                      <article
                        v-for="provider in providerDefinitions"
                        :key="provider.key"
                        class="provider-card"
                        :class="{ 'is-linked': isProviderLinked(provider.key) }"
                      >
                        <div class="provider-card__icon" :class="`provider-card__icon--${provider.key}`">
                          <RemoteAvatar
                            :src="getProviderAvatarUrl(provider.key)"
                            :alt="`${provider.label} 头像`"
                            image-class="provider-card__avatar-image"
                          >
                            <template #fallback>
                              <svg v-if="provider.key === 'github'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.52v-1.84c-2.94.64-3.56-1.25-3.56-1.25-.48-1.21-1.18-1.53-1.18-1.53-.97-.66.07-.65.07-.65 1.07.08 1.64 1.1 1.64 1.1.95 1.63 2.5 1.16 3.11.89.1-.69.37-1.16.67-1.43-2.35-.27-4.82-1.18-4.82-5.27 0-1.16.41-2.12 1.09-2.87-.11-.27-.47-1.37.1-2.86 0 0 .89-.29 2.92 1.1a10.1 10.1 0 0 1 5.31 0c2.03-1.39 2.92-1.1 2.92-1.1.57 1.49.21 2.59.1 2.86.68.75 1.09 1.71 1.09 2.87 0 4.1-2.48 4.99-4.84 5.25.38.33.72.98.72 1.98v2.94c0 .29.19.63.73.52A10.5 10.5 0 0 0 12 1.5Z" />
                              </svg>
                              <svg v-else-if="provider.key === 'google'" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M21.6 12.23c0-.73-.06-1.25-.2-1.8H12v3.39h5.52c-.11.84-.7 2.11-2 2.96l-.02.11 2.76 2.14.19.02c1.74-1.61 2.75-3.98 2.75-6.82Z" />
                                <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.15-2.44c-.84.59-1.97 1-3.47 1-2.64 0-4.88-1.73-5.68-4.14l-.1.01-2.87 2.22-.03.09C4.97 19.64 8.2 22 12 22Z" />
                                <path fill="#FBBC05" d="M6.32 14c-.21-.62-.33-1.28-.33-1.96s.12-1.34.32-1.96l-.01-.13-2.91-2.25-.09.04A9.94 9.94 0 0 0 2 12.04c0 1.6.38 3.11 1.05 4.44L6.32 14Z" />
                                <path fill="#EA4335" d="M12 5.86c1.89 0 3.16.82 3.89 1.5l2.84-2.77C16.96 2.98 14.7 2 12 2 8.2 2 4.97 4.36 3.29 7.74L6.3 10.05c.81-2.41 3.05-4.19 5.7-4.19Z" />
                              </svg>
                              <img v-else-if="provider.key === 'linuxdo'" :src="linuxdoIcon" alt="">
                            </template>
                          </RemoteAvatar>
                        </div>

                        <div class="provider-card__copy">
                          <div class="provider-card__title-row">
                            <h3>{{ provider.label }}</h3>
                            <span class="provider-card__status" :class="{ 'is-linked': isProviderLinked(provider.key) }">
                              {{ isProviderLinked(provider.key) ? '已绑定' : '未绑定' }}
                            </span>
                          </div>
                          <span class="provider-card__meta">{{ getProviderIdentitySummary(provider.key) }}</span>
                          <span class="provider-card__hint">{{ provider.description }}</span>
                        </div>

                        <div class="provider-card__actions">
                          <button
                            v-if="!isProviderLinked(provider.key)"
                            type="button"
                            class="account-action account-action--primary"
                            :disabled="activeProviderAction === provider.key"
                            @click="handleLinkProvider(provider)"
                          >
                            {{ getProviderActionLabel(provider.key) }}
                          </button>
                          <button
                            v-else
                            type="button"
                            class="account-action account-action--ghost"
                            :disabled="!canUnlinkProvider(provider.key)"
                            @click="handleUnlinkProvider(provider.key)"
                          >
                            {{ activeProviderAction === provider.key ? '处理中...' : '解除绑定' }}
                          </button>
                        </div>
                      </article>
                    </div>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </template>
      </section>
    </div>

    <el-dialog
      v-model="showPasswordDialog"
      class="account-password-dialog"
      width="min(92vw, 520px)"
      destroy-on-close
      @closed="resetPasswordForm"
    >
      <template #header>
        <div class="account-password-dialog__header">
          <h3>{{ passwordDialogTitle }}</h3>
          <p>{{ authEmail || '当前第三方账号未返回邮箱地址' }}</p>
        </div>
      </template>

      <form class="account-password-form" @submit.prevent="handlePasswordSubmit">
        <label class="account-field">
          <span>密码</span>
          <div class="account-input-wrap">
            <input
              v-model="passwordForm.password"
              :type="passwordForm.showPassword ? 'text' : 'password'"
              class="account-input"
              :disabled="isSavingPassword"
              placeholder="至少 6 位"
              autocomplete="new-password"
            >
            <button
              type="button"
              class="account-input-toggle"
              :disabled="isSavingPassword"
              @click="passwordForm.showPassword = !passwordForm.showPassword"
            >
              {{ passwordForm.showPassword ? '隐藏' : '显示' }}
            </button>
          </div>
        </label>

        <label class="account-field">
          <span>确认密码</span>
          <div class="account-input-wrap">
            <input
              v-model="passwordForm.confirmPassword"
              :type="passwordForm.showConfirmPassword ? 'text' : 'password'"
              class="account-input"
              :disabled="isSavingPassword"
              placeholder="再次输入同样的密码"
              autocomplete="new-password"
            >
            <button
              type="button"
              class="account-input-toggle"
              :disabled="isSavingPassword"
              @click="passwordForm.showConfirmPassword = !passwordForm.showConfirmPassword"
            >
              {{ passwordForm.showConfirmPassword ? '隐藏' : '显示' }}
            </button>
          </div>
        </label>

        <div class="account-password-form__actions">
          <button
            type="submit"
            class="account-action account-action--primary"
            :disabled="isSavingPassword"
          >
            {{ passwordSubmitLabel }}
          </button>
          <button
            type="button"
            class="account-action account-action--ghost"
            :disabled="isSavingPassword"
            @click="closePasswordDialog"
          >
            取消
          </button>
        </div>
      </form>
    </el-dialog>
  </div>
</template>

<style lang="scss">
.is-message-box .el-overlay-message-box {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: initial;
}

.is-message-box .el-overlay-message-box::after {
  display: none !important;
}

.is-message-box .el-overlay-message-box {
  background: rgba(15, 23, 42, 0.56);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.account-unlink-dialog {
  width: min(92vw, 560px) !important;
  max-width: min(92vw, 560px) !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden;
  border-radius: 26px !important;
  border: 1px solid rgba(255, 255, 255, 0.68) !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(255, 255, 255, 0.94)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.1), rgba(14, 165, 233, 0.06) 52%, rgba(255, 255, 255, 0)) !important;
  box-shadow:
    0 28px 72px rgba(15, 23, 42, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.76) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.account-unlink-dialog .el-message-box__header {
  margin: 0;
  padding: 24px 56px 12px 24px;
}

.account-unlink-dialog .el-message-box__title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: #0f172a;
}

.account-unlink-dialog .el-message-box__headerbtn {
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: rgba(30, 41, 59, 0.72);
  transition: all 0.2s ease;
}

.account-unlink-dialog .el-message-box__headerbtn:hover {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.account-unlink-dialog .el-message-box__content {
  padding: 0 24px 0;
}

.account-unlink-dialog .el-message-box__container {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.account-unlink-dialog .el-message-box__status {
  position: static !important;
  margin: 2px 0 0;
  flex-shrink: 0;
  font-size: 26px !important;
  color: #f59e0b !important;
}

.account-unlink-dialog .el-message-box__message {
  padding-left: 0 !important;
}

.account-unlink-dialog .el-message-box__message p {
  margin: 0;
  font-size: 16px;
  line-height: 1.72;
  color: #334155;
  word-break: break-word;
}

.account-unlink-dialog .el-message-box__btns {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 22px 24px 24px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.account-unlink-dialog .el-message-box__btns .el-button {
  min-width: 116px;
  height: 44px;
  margin-left: 0 !important;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.account-unlink-dialog .el-message-box__btns .el-button--default {
  border-color: rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.78);
  color: #334155;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.account-unlink-dialog .el-message-box__btns .el-button--default:hover {
  border-color: rgba(96, 165, 250, 0.36);
  color: #0f172a;
  background: rgba(248, 250, 252, 0.96);
}

.account-unlink-dialog .el-message-box__btns .el-button--primary {
  border: none;
  background: var(--accent-gradient);
  color: #fff;
  box-shadow: 0 12px 26px var(--accent-shadow);
}

.account-unlink-dialog .el-message-box__btns .el-button--primary:hover {
  background: var(--accent-gradient-hover);
  box-shadow: 0 16px 30px var(--accent-shadow-strong);
}

html[data-theme='dark'] .is-message-box .el-overlay-message-box {
  background: rgba(2, 6, 23, 0.7);
}

html[data-theme='dark'] .account-unlink-dialog {
  border-color: rgba(148, 163, 184, 0.18) !important;
  background:
    linear-gradient(180deg, rgba(8, 15, 28, 0.98), rgba(8, 15, 28, 0.94)),
    linear-gradient(140deg, rgba(59, 130, 246, 0.14), rgba(14, 165, 233, 0.08) 52%, rgba(2, 6, 23, 0)) !important;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
}

html[data-theme='dark'] .account-unlink-dialog .el-message-box__title {
  color: #f8fafc;
}

html[data-theme='dark'] .account-unlink-dialog .el-message-box__headerbtn {
  color: rgba(226, 232, 240, 0.72);
}

html[data-theme='dark'] .account-unlink-dialog .el-message-box__headerbtn:hover {
  background: rgba(96, 165, 250, 0.12);
  color: #93c5fd;
}

html[data-theme='dark'] .account-unlink-dialog .el-message-box__message p {
  color: rgba(226, 232, 240, 0.86);
}

html[data-theme='dark'] .account-unlink-dialog .el-message-box__btns {
  border-top-color: rgba(148, 163, 184, 0.14);
}

html[data-theme='dark'] .account-unlink-dialog .el-message-box__btns .el-button--default {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(226, 232, 240, 0.88);
  box-shadow: none;
}

html[data-theme='dark'] .account-unlink-dialog .el-message-box__btns .el-button--default:hover {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
}

@media (max-width: 640px) {
  .is-message-box .el-overlay-message-box {
    padding: 16px;
  }

  .account-unlink-dialog {
    width: min(94vw, 560px) !important;
    max-width: min(94vw, 560px) !important;
    border-radius: 22px !important;
  }

  .account-unlink-dialog .el-message-box__header {
    padding: 20px 52px 10px 20px;
  }

  .account-unlink-dialog .el-message-box__title {
    font-size: 21px;
  }

  .account-unlink-dialog .el-message-box__content {
    padding: 0 20px 0;
  }

  .account-unlink-dialog .el-message-box__message p {
    font-size: 15px;
  }

  .account-unlink-dialog .el-message-box__btns {
    padding: 18px 20px 20px;
  }

  .account-unlink-dialog .el-message-box__btns .el-button {
    min-width: 100px;
    height: 42px;
  }
}

.account-password-dialog {
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.62);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.92)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.05) 52%, rgba(255, 255, 255, 0));
  box-shadow:
    0 28px 72px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.account-password-dialog .el-dialog__header {
  margin: 0;
  padding: 24px 24px 12px;
}

.account-password-dialog .el-dialog__body {
  padding: 0 24px 24px;
}

.account-password-dialog .el-dialog__headerbtn {
  top: 18px;
  right: 18px;
}

html[data-theme='dark'] .account-password-dialog {
  border-color: rgba(148, 163, 184, 0.16);
  background:
    linear-gradient(180deg, rgba(8, 15, 28, 0.96), rgba(8, 15, 28, 0.9)),
    linear-gradient(140deg, rgba(59, 130, 246, 0.14), rgba(14, 165, 233, 0.08) 52%, rgba(2, 6, 23, 0));
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
</style>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;

.account-page {
  padding: 20px 0 0;
  background: transparent;
}

.account-shell {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: min(100%, 1420px);
  margin: 0 auto;
}

.account-hero {
  max-width: 620px;

  h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 36px);
    line-height: 1.08;
    letter-spacing: -0.04em;
    color: #0f172a;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }
}

.account-eyebrow,
.account-card__eyebrow,
.account-password-dialog__eyebrow {
  display: inline-flex;
  align-items: center;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;

  [data-theme='dark'] & {
    color: #93c5fd;
  }
}

.account-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;

  @include desktop-up {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.account-card,
.account-state-card {
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.88)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.05) 52%, rgba(255, 255, 255, 0));
  box-shadow:
    0 24px 64px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);

  [data-theme='dark'] & {
    border-color: rgba(148, 163, 184, 0.16);
    background:
      linear-gradient(180deg, rgba(8, 15, 28, 0.92), rgba(8, 15, 28, 0.86)),
      linear-gradient(140deg, rgba(59, 130, 246, 0.14), rgba(14, 165, 233, 0.08) 52%, rgba(2, 6, 23, 0));
    box-shadow:
      0 26px 72px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
}

.account-card {
  padding: 18px;
}

.account-card--profile {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: auto;
}

.account-card--security,
.account-card--providers {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.account-profile {
  display: flex;
  align-items: center;
  gap: 14px;
}

:deep(.account-profile__avatar),
:deep(.account-profile__avatar-image) {
  width: 68px;
  height: 68px;
  flex-shrink: 0;
}

:deep(.account-profile__avatar) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: white;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  background: var(--avatar-accent-end, #2563eb);
  box-shadow: 0 16px 30px var(--avatar-accent-shadow, rgba(37, 99, 235, 0.22));
}

:deep(.account-profile__avatar-image) {
  object-fit: cover;
  border-radius: 22px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
}

.account-profile__copy {
  min-width: 0;

  h2 {
    margin: 0;
    color: #0f172a;
    font-size: clamp(24px, 2.3vw, 28px);
    line-height: 1.08;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  p {
    margin-top: 6px;
    color: #526277;
    font-size: 14px;
    line-height: 1.7;
    word-break: break-word;

    [data-theme='dark'] & {
      color: #cbd5e1;
    }
  }

  small {
    display: block;
    margin-top: 4px;
    color: #64748b;
    line-height: 1.6;
    word-break: break-word;

    [data-theme='dark'] & {
      color: #94a3b8;
    }
  }
}

.account-overview {
  display: grid;
  gap: 10px;

  @include tablet-up {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.account-overview__item {
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(239, 246, 255, 0.72);
  border: 1px solid rgba(96, 165, 250, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);

  [data-theme='dark'] & {
    background: rgba(11, 22, 41, 0.82);
    border-color: rgba(96, 165, 250, 0.18);
  }

  span {
    display: block;
    margin-bottom: 6px;
    color: #64748b;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;

    [data-theme='dark'] & {
      color: #94a3b8;
    }
  }

  strong {
    color: #0f172a;
    font-size: 15px;
    line-height: 1.4;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }
}

.account-inline-panel {
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(248, 251, 255, 0.88);
  border: 1px solid rgba(96, 165, 250, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.52);

  [data-theme='dark'] & {
    background: rgba(10, 19, 34, 0.82);
    border-color: rgba(96, 165, 250, 0.16);
  }

  &.is-editing {
    padding-bottom: 18px;
  }
}

.account-inline-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.account-inline-panel__copy {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;

  strong {
    display: block;
    color: #0f172a;
    font-size: clamp(22px, 2.1vw, 26px);
    line-height: 1.08;
    letter-spacing: -0.02em;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  small {
    display: block;
    margin-top: 6px;
    color: #64748b;
    line-height: 1.6;

    [data-theme='dark'] & {
      color: #94a3b8;
    }
  }
}

.account-inline-panel__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  margin-bottom: 0;
  border-radius: 999px;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.14);

  [data-theme='dark'] & {
    color: #bfdbfe;
    background: rgba(30, 64, 175, 0.24);
    border-color: rgba(96, 165, 250, 0.18);
  }
}

.account-inline-panel__value-row {
  display: flex;
  align-items: center;
  min-width: 0;

  span {
    color: #0f172a;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }
}

.account-meta-grid {
  display: grid;
  gap: 12px;
  margin-top: 20px;

  @include tablet-up {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.account-meta-grid--compact {
  margin-top: 18px;
}

.account-meta-card {
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.12);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.76);
    border-color: rgba(148, 163, 184, 0.14);
  }

  span {
    display: block;
    margin-bottom: 6px;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;

    [data-theme='dark'] & {
      color: #94a3b8;
    }
  }

  strong {
    color: #0f172a;
    font-size: 15px;
    line-height: 1.5;
    word-break: break-word;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }
}

.account-meta-card--full {
  @include tablet-up {
    grid-column: 1 / -1;
  }
}

.account-inline-display {
  display: flex;
  flex-direction: column;
  gap: 8px;

  small {
    color: #64748b;
    line-height: 1.7;

    [data-theme='dark'] & {
      color: #94a3b8;
    }
  }
}

.account-inline-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 14px;
}

.account-inline-editor__actions,
.account-card__actions,
.account-password-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.account-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 2px 0 0;
    color: #0f172a;
    font-size: 22px;
    line-height: 1.12;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }
}

.account-section-divider {
  width: 100%;
  height: 1px;
  background: rgba(148, 163, 184, 0.14);
  margin: 2px 0;
}

.account-security {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.account-security__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.account-security__copy {
  min-width: 0;

  strong {
    display: block;
    color: #0f172a;
    font-size: 18px;
    line-height: 1.2;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  p {
    margin-top: 6px;
    color: #526277;
    font-size: 13px;
    line-height: 1.72;

    [data-theme='dark'] & {
      color: #94a3b8;
    }
  }
}

.account-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  color: #1e3a8a;
  font-size: 12px;
  font-weight: 700;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.14);

  [data-theme='dark'] & {
    color: #bfdbfe;
    background: rgba(30, 64, 175, 0.24);
    border-color: rgba(96, 165, 250, 0.18);
  }

  &.is-active {
    color: #eff6ff;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border-color: transparent;
    box-shadow: 0 12px 22px rgba(37, 99, 235, 0.18);

    [data-theme='dark'] & {
      color: #eff6ff;
      background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
      border-color: transparent;
    }
  }
}

.account-card__description {
  margin-top: 14px;
  color: #526277;
  line-height: 1.8;

  [data-theme='dark'] & {
    color: #cbd5e1;
  }
}

.account-card__actions {
  margin-top: 2px;
}

.account-card__actions--compact {
  margin-top: 0;
}

.account-security__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.provider-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 12px;
  margin-top: 0;
  justify-content: space-evenly;
}

.provider-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(248, 251, 255, 0.86);
  border: 1px solid rgba(96, 165, 250, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);

  [data-theme='dark'] & {
    background: rgba(10, 19, 34, 0.82);
    border-color: rgba(96, 165, 250, 0.16);
  }

  @include tablet-up {
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
  }

  &.is-linked {
    border-color: rgba(37, 99, 235, 0.2);
    box-shadow: 0 14px 30px rgba(37, 99, 235, 0.1);

    [data-theme='dark'] & {
      border-color: rgba(96, 165, 250, 0.22);
      box-shadow: 0 16px 32px rgba(37, 99, 235, 0.14);
    }
  }
}

.provider-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.92)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 233, 0.03));
  border: 1px solid rgba(96, 165, 250, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.62),
    0 10px 20px rgba(37, 99, 235, 0.08);

  [data-theme='dark'] & {
    background:
      linear-gradient(180deg, rgba(20, 34, 60, 0.96), rgba(12, 21, 39, 0.92)),
      linear-gradient(140deg, rgba(96, 165, 250, 0.14), rgba(14, 165, 233, 0.08));
    border-color: rgba(96, 165, 250, 0.16);
  }

  svg,
  img {
    width: 24px;
    height: 24px;
  }

  &--github {
    color: #111827;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  &--google {
    color: #0f172a;
  }

  &--linuxdo {
    color: #0f172a;
  }
}

:deep(.provider-card__avatar-image) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  border-radius: 18px;
}

.provider-card__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.provider-card__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;

  h3 {
    margin: 0;
    color: #0f172a;
    font-size: 18px;
    line-height: 1.2;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }
}

.provider-card__status {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  color: #1e3a8a;
  font-size: 12px;
  font-weight: 700;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.12);

  [data-theme='dark'] & {
    color: #bfdbfe;
    background: rgba(30, 64, 175, 0.24);
    border-color: rgba(96, 165, 250, 0.18);
  }

  &.is-linked {
    color: #eff6ff;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border-color: transparent;

    [data-theme='dark'] & {
      color: #eff6ff;
      background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
    }
  }
}

.provider-card__meta {
  display: block;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;

  [data-theme='dark'] & {
    color: #94a3b8;
  }
}

.provider-card__hint {
  display: block;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;

  [data-theme='dark'] & {
    color: #64748b;
  }
}

.provider-card__actions {
  display: flex;
  align-items: center;
}

.account-action,
.account-primary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 700;
  border: 1px solid transparent;
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    background 220ms ease,
    border-color 220ms ease,
    color 220ms ease;
}

.account-action {
  border: 1px solid transparent;
}

.account-action--primary,
.account-primary-link {
  color: white;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.22);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 38px rgba(37, 99, 235, 0.28);
  }
}

.account-action--ghost {
  color: #1d4ed8;
  background: rgba(239, 246, 255, 0.9);
  border-color: rgba(96, 165, 250, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.52);

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(37, 99, 235, 0.24);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.62),
      0 14px 26px rgba(37, 99, 235, 0.1);
  }

  [data-theme='dark'] & {
    color: #bfdbfe;
    background: rgba(10, 19, 34, 0.9);
    border-color: rgba(96, 165, 250, 0.18);
  }
}

.account-action--compact {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 14px;
}

.account-action:disabled,
.account-primary-link {
  text-decoration: none;
}

.account-action:disabled {
  cursor: not-allowed;
  opacity: 0.56;
  box-shadow: none;
  transform: none;
}

.account-field {
  display: flex;
  flex-direction: column;
  gap: 10px;

  span {
    color: #64748b;
    font-size: 13px;
    font-weight: 600;

    [data-theme='dark'] & {
      color: #94a3b8;
    }
  }
}

.account-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.account-input {
  width: 100%;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 16px;
  color: #0f172a;
  background: rgba(248, 251, 255, 0.92);
  transition:
    border-color 220ms ease,
    box-shadow 220ms ease;

  [data-theme='dark'] & {
    color: #f8fafc;
    background: rgba(10, 19, 34, 0.86);
    border-color: rgba(96, 165, 250, 0.18);
  }

  &:focus {
    outline: none;
    border-color: rgba(37, 99, 235, 0.36);
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
  }
}

.account-input-toggle {
  flex-shrink: 0;
  min-width: 56px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 14px;
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.14);
  font-size: 13px;
  font-weight: 600;

  [data-theme='dark'] & {
    color: #bfdbfe;
    background: rgba(30, 64, 175, 0.24);
    border-color: rgba(96, 165, 250, 0.18);
  }
}

.account-password-dialog__header {
  padding-right: 28px;

  h3 {
    margin: 10px 0 8px;
    color: #0f172a;
    font-size: 28px;
    line-height: 1.08;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  p {
    color: #526277;
    line-height: 1.7;
    word-break: break-word;

    [data-theme='dark'] & {
      color: #cbd5e1;
    }
  }
}

.account-password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.account-state-card {
  padding: 44px 24px;
  text-align: center;

  h2 {
    margin: 18px 0 10px;
    color: #0f172a;
    font-size: 26px;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  p {
    max-width: 520px;
    margin: 0 auto;
    color: #64748b;
    line-height: 1.8;

    [data-theme='dark'] & {
      color: #cbd5e1;
    }
  }
}

.account-state-card__icon {
  width: 68px;
  height: 68px;
  margin: 0 auto;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.18), rgba(37, 99, 235, 0.18));

  &.is-unavailable {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(249, 115, 22, 0.18));
  }
}

@media (max-width: 767px) {
  .account-page {
    padding: 10px 0 0;
  }

  .account-shell {
    width: 100%;
  }

  .account-card {
    padding: 18px;
  }

  .account-profile {
    align-items: flex-start;
  }

  .account-profile__copy h2 {
    font-size: 24px;
  }

  .account-overview {
    grid-template-columns: 1fr;
  }

  .account-inline-panel__header,
  .account-security__header,
  .account-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .account-inline-panel {
    padding: 14px;
  }

  .account-inline-panel__copy {
    align-items: flex-start;
    gap: 10px 12px;
  }

  .provider-card {
    padding: 16px;
  }

  .provider-card__actions {
    width: 100%;
  }
}
</style>

<style scoped>
.account-hub {
  border: 1px solid var(--color-border);
  border-radius: 28px;
  overflow: hidden;
  background: transparent;
}
.account-identity {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 32px;
  background: var(--accent-surface);
}
.account-identity :deep(.account-identity__avatar) {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--color-bg-primary);
}
.account-identity__copy {
  min-width: 0;
}
.account-identity h1 {
  margin: 0 0 7px;
  font-size: 26px;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}
.account-identity p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.account-identity__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 18px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.account-identity__stats strong {
  color: var(--color-text-primary);
  margin-left: 5px;
}
.account-hub__content {
  padding: 28px;
  min-height: 380px;
}
.account-card {
  box-shadow: none;
  backdrop-filter: none;
  border-color: var(--color-border);
  border-radius: 22px;
}
@media (max-width: 600px) {
  .account-hub {
    border-radius: 22px;
  }
  .account-identity {
    padding: 22px 18px;
    gap: 14px;
    flex-wrap: wrap;
  }
  .account-identity :deep(.account-identity__avatar) {
    width: 64px;
    height: 64px;
  }
  .account-identity h1 {
    font-size: 21px;
  }
  .account-hub__content {
    padding: 20px 14px;
  }
}
</style>

<style scoped>
.account-settings-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 18px;
}
.account-card--providers .provider-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
.account-card--providers .provider-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}
.account-card--providers .provider-card__copy {
  flex: 1;
  min-width: 160px;
}
.account-card--providers .provider-card__actions {
  margin-left: auto;
}
</style>
