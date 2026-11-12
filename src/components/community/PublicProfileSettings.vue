<script setup>
import { ElOption, ElSelect, ElSwitch } from 'element-plus'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { communityService } from '@/services/communityService'
import { useAuthStore } from '@/stores/auth'
import { useCommunityRequest } from '@/utils/community/useCommunityRequest'
import 'element-plus/es/components/switch/style/css'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/option/style/css'
import './community-page.css'

const emit = defineEmits(['visibilityChanged'])
const auth = useAuthStore()
const page = ref(0)
const draft = reactive({ enabled: false, show_likes: false })
const saving = ref(false)
const needsVerification = ref(false)
const feedback = ref('')
let mounted = true
const { state, refresh, invalidateCache } = useCommunityRequest(() => [auth.user?.id, page.value], async (signal) => {
  feedback.value = ''
  if (!auth.user?.id)
    return null
  const [settings, collections] = await Promise.all([communityService.getSettings({ signal }), communityService.getMyCollections({ signal, offset: page.value * 24 })])
  return { settings, collections }
}, { cache: true, cacheScope: () => auth.user?.id, retainDataOnRefresh: true })
watch(() => state.value.data?.settings, (settings) => {
  Object.assign(draft, settings || { enabled: false, show_likes: false })
}, { immediate: true })
watch(() => auth.user?.id, () => {
  needsVerification.value = false
  saving.value = false
  feedback.value = ''
  page.value = 0
}, { flush: 'sync' })

function markUnconfirmed() {
  needsVerification.value = true
  feedback.value = '保存结果未确认，请重新读取设置，核对后再保存。'
}

async function refreshSettings() {
  const actor = auth.user?.id
  await refresh()
  if (!mounted || actor !== auth.user?.id)
    return
  if (state.value.status === 'ready' && state.value.data) {
    needsVerification.value = false
    feedback.value = '已重新读取最新设置，请核对后再保存。'
    emit('visibilityChanged', actor)
  }
  else if (needsVerification.value) {
    markUnconfirmed()
  }
}

async function save(operation, success) {
  if (saving.value || needsVerification.value || !auth.user?.id || state.value.status !== 'ready')
    return
  const actor = auth.user.id
  const current = state.value
  saving.value = true
  feedback.value = ''
  try {
    await operation(actor)
    if (!mounted || actor !== auth.user?.id || state.value !== current)
      return
    invalidateCache()
    await refresh()
    if (mounted && actor === auth.user?.id) {
      if (state.value.status === 'ready' && state.value.data) {
        feedback.value = success
        emit('visibilityChanged', actor)
      }
      else {
        markUnconfirmed()
      }
    }
  }
  catch {
    if (mounted && actor === auth.user?.id && state.value === current)
      markUnconfirmed()
  }
  finally {
    if (mounted && actor === auth.user?.id)
      saving.value = false
  }
}

function saveVisibility(collection, visibility) {
  save(actor => communityService.setCollectionVisibility(collection.id, visibility, actor), '收藏夹可见性已保存。')
}

onBeforeUnmount(() => {
  mounted = false
})
</script>

<template>
  <article class="public-settings" :aria-busy="state.status === 'loading'">
    <div v-if="state.status === 'loading' && !state.data" class="public-settings__skeleton" role="status" aria-label="正在读取公开设置">
      <span class="public-settings__note">正在读取公开设置</span>
      <div class="settings-placeholder" aria-hidden="true">
        <i class="settings-placeholder__title" />
        <i class="settings-placeholder__description" />
        <div v-for="index in 2" :key="index" class="settings-placeholder__row">
          <div><i /><i /></div><i class="settings-placeholder__toggle" />
        </div>
        <i class="settings-placeholder__button" />
        <i class="settings-placeholder__section" />
        <div class="settings-placeholder__row">
          <div><i /><i /></div><i class="settings-placeholder__select" />
        </div>
      </div>
    </div>
    <div v-else-if="state.status === 'error' && !state.data" role="status">
      <p>公开设置暂时无法读取。</p><button v-if="!needsVerification" class="community-button" @click="refreshSettings">
        重试
      </button>
    </div>
    <template v-else-if="state.data">
      <div class="public-settings__intro">
        <h2>公开主页</h2>
        <p class="public-settings__note">
          默认关闭。发布后展示昵称、头像、签名和公开关注关系；邮箱与登录信息始终私密。
        </p>
      </div>
      <div class="public-settings__panels">
        <form @submit.prevent="save(actor => communityService.saveSettings({ ...draft }, actor), '公开设置已保存。')">
          <div class="public-settings__switch">
            <span><strong>发布我的主页</strong><small>关闭后隐藏主页、喜欢与收藏。</small></span><ElSwitch v-model="draft.enabled" aria-label="发布我的主页" :disabled="state.status !== 'ready' || saving || needsVerification" />
          </div>
          <div class="public-settings__switch">
            <span><strong>展示我的喜欢</strong><small>单独授权，在公开主页展示。</small></span><ElSwitch v-model="draft.show_likes" aria-label="展示我的喜欢" :disabled="state.status !== 'ready' || saving || needsVerification || !draft.enabled" />
          </div>
          <div class="public-settings__actions">
            <button class="community-button public-settings__save" type="submit" :disabled="state.status !== 'ready' || saving || needsVerification">
              {{ saving ? '保存中…' : '保存公开设置' }}
            </button><RouterLink v-if="state.data.settings.enabled" :to="`/people/${auth.user.id}`">
              查看我的主页 ↗
            </RouterLink>
          </div>
        </form>
        <div class="public-settings__collections">
          <h3>收藏夹可见性</h3><p class="public-settings__note">
            选择「公开」后会在已发布的主页展示；选择「私有」则仅自己可见。
          </p>
          <p v-if="!state.data.collections.items.length" class="public-settings__note">
            还没有收藏夹，先去壁纸库收藏喜欢的画面。
          </p>
          <div v-for="collection in state.data.collections.items" :key="collection.id" class="public-settings__collection">
            <label :for="`visibility-${collection.id}`">{{ collection.name }}</label><ElSelect :id="`visibility-${collection.id}`" :model-value="collection.visibility" :aria-label="`${collection.name}的可见性`" :disabled="state.status !== 'ready' || saving || needsVerification" @change="saveVisibility(collection, $event)">
              <ElOption value="private" label="私有" />
              <ElOption value="public" label="公开" />
            </ElSelect>
          </div>
          <nav v-if="page > 0 || state.data.collections.has_more" class="community-pagination" aria-label="收藏夹设置分页">
            <button class="community-button" :disabled="page === 0 || saving || needsVerification" @click="page--">
              上一页
            </button><button class="community-button" :disabled="!state.data.collections.has_more || saving || needsVerification" @click="page++">
              下一页
            </button>
          </nav>
        </div>
      </div>
    </template>
    <p v-if="state.data && state.status === 'loading' && !saving" class="public-settings__note" role="status">
      正在更新公开设置…
    </p>
    <p v-if="state.data && state.status === 'error' && !needsVerification" class="public-settings__note" role="status">
      暂时无法更新设置，已保留上次内容。<button class="community-button" @click="refreshSettings">
        重试
      </button>
    </p>
    <p v-if="feedback" role="status" aria-live="polite" class="public-settings__note">
      {{ feedback }}
    </p>
    <button v-if="needsVerification" class="community-button" :disabled="saving || state.status === 'loading'" @click="refreshSettings">
      重新读取设置
    </button>
  </article>
</template>

<style scoped>
.public-settings {
  container-type: inline-size;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 392px;
  align-self: stretch;
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 28px;
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.88)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.05) 52%, rgba(255, 255, 255, 0));
  box-shadow:
    0 24px 64px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
}
.public-settings__skeleton {
  min-height: 354px;
}
.settings-placeholder i {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: var(--color-bg-hover);
}
.settings-placeholder .settings-placeholder__title {
  width: 110px;
  height: 20px;
  margin: 18px 0;
}
.settings-placeholder__description {
  width: 90%;
  margin-bottom: 20px;
}
.settings-placeholder__row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 0;
}
.settings-placeholder__row > div {
  flex: 1;
}
.settings-placeholder__row > div i {
  width: 48%;
}
.settings-placeholder__row > div i + i {
  width: 84%;
  height: 10px;
  margin-top: 10px;
}
.settings-placeholder .settings-placeholder__toggle {
  width: 40px;
  height: 20px;
  border-radius: 12px;
}
.settings-placeholder .settings-placeholder__button {
  width: 120px;
  height: 40px;
  margin: 18px 0 24px;
}
.settings-placeholder__section {
  width: 120px;
  margin: 18px 0;
}
.settings-placeholder .settings-placeholder__select {
  width: 120px;
  height: 40px;
}
.public-settings__intro,
.public-settings__panels {
  animation: settings-content-enter 140ms ease-out;
}
@keyframes settings-content-enter {
  from {
    opacity: 0.65;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .public-settings__intro,
  .public-settings__panels {
    animation: none;
  }
}
[data-theme='dark'] .public-settings {
  border-color: rgba(148, 163, 184, 0.16);
  background:
    linear-gradient(180deg, rgba(8, 15, 28, 0.92), rgba(8, 15, 28, 0.86)),
    linear-gradient(140deg, rgba(59, 130, 246, 0.14), rgba(14, 165, 233, 0.08) 52%, rgba(2, 6, 23, 0));
  box-shadow:
    0 26px 72px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.public-settings h2 {
  margin: 0;
  font-size: 18px;
}
.public-settings h3 {
  margin: 0 0 6px;
  font-size: 15px;
}
.public-settings a {
  color: var(--color-accent);
  font-size: 13px;
}
.public-settings__note {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.65;
  margin: 10px 0 14px;
}
.public-settings__panels {
  display: grid;
  gap: 18px;
}
.public-settings__panels > form {
  min-width: 0;
}
.public-settings__switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}
.public-settings__switch strong {
  display: block;
  font-size: 14px;
}
.public-settings__switch small {
  display: block;
  margin-top: 4px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.public-settings__switch :deep(.el-switch) {
  flex-shrink: 0;
  --el-switch-on-color: #2563eb;
}
.public-settings__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}
.public-settings .community-button {
  min-height: 40px;
  padding: 8px 16px;
  color: var(--color-accent);
  border-color: rgba(37, 99, 235, 0.18);
  background: rgba(37, 99, 235, 0.06);
}
.public-settings .public-settings__save {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.16);
}
.public-settings__collections {
  min-width: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  padding-top: 16px;
}
.public-settings__collection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}
.public-settings__collection label {
  overflow-wrap: anywhere;
  min-width: 0;
  font-size: 14px;
}
.public-settings__collection :deep(.el-select) {
  width: 120px;
  flex-shrink: 0;
}
.public-settings__collection :deep(.el-select__wrapper) {
  min-height: 40px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
}
[data-theme='dark'] .public-settings__collection :deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.06);
}
.public-settings .community-pagination {
  justify-content: flex-start;
  gap: 10px;
  margin-top: 12px;
}
@container (min-width: 620px) {
  .public-settings__panels {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 24px;
  }
  .public-settings__collections {
    border-top: 0;
    border-left: 1px solid rgba(148, 163, 184, 0.18);
    padding: 0 0 0 24px;
  }
}
</style>
