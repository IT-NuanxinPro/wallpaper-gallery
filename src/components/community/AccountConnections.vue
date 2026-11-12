<script setup>
import { computed } from 'vue'
import ContentEmpty from '@/components/common/feedback/ContentEmpty.vue'
import { communityService } from '@/services/communityService'
import { useAuthStore } from '@/stores/auth'
import { useCommunityRequest } from '@/utils/community/useCommunityRequest'
import PublicProfileCard from './PublicProfileCard.vue'

const props = defineProps({ kind: { type: String, required: true } })
const auth = useAuthStore()
const { state, refresh } = useCommunityRequest(() => [auth.user?.id, props.kind], async (signal) => {
  const actor = auth.user?.id
  const kind = props.kind
  if (!actor)
    return null
  const profile = await communityService.getProfile(actor, { signal })
  signal.throwIfAborted()
  if (!profile)
    return { published: false, items: [] }
  const result = await communityService.getConnections(actor, kind, { signal, limit: 48 })
  return { ...result, published: true }
}, { cache: true, cacheScope: () => auth.user?.id, retainDataOnRefresh: true })
const title = computed(() => props.kind === 'following' ? '关注' : '粉丝')
</script>

<template>
  <div class="account-connections" :aria-busy="state.status === 'loading'">
    <div v-if="state.status === 'loading' && !state.data" class="account-connections__skeleton" role="status" :aria-label="`正在加载${title}`">
      <span class="connections-loading-label">正在加载{{ title }}</span>
      <div v-for="index in 3" :key="index" class="connections-placeholder" aria-hidden="true">
        <i class="connections-placeholder__avatar" />
        <div><i /><i /></div>
        <i class="connections-placeholder__action" />
      </div>
    </div>
    <div v-else-if="state.status === 'error' && !state.data" class="profile-empty">
      <p>暂时无法加载，请稍后重试。</p><button class="community-button" @click="refresh">
        重试
      </button>
    </div>
    <ContentEmpty v-else-if="!state.data?.published" description="发布主页后，可查看公开关注和粉丝">
      <RouterLink class="community-button" to="/account?tab=settings">
        设置公开主页
      </RouterLink>
    </ContentEmpty>
    <ContentEmpty v-else-if="!state.data.items.length" :description="`还没有公开${title}`" />
    <div v-else class="community-page__grid community-page__grid--people">
      <PublicProfileCard v-for="profile in state.data.items" :key="profile.id" :profile="profile" />
    </div>
    <p v-if="state.data && state.status === 'loading'" class="connections-status" role="status">
      正在更新{{ title }}…
    </p>
    <p v-if="state.data && state.status === 'error'" class="connections-status" role="status">
      更新暂时失败，已保留当前列表。<button class="community-button" @click="refresh">
        重试
      </button>
    </p>
    <p v-if="state.data?.has_more" class="community-page__notice">
      <RouterLink :to="`/people/${auth.user.id}?tab=${kind}`">
        查看全部{{ title }} →
      </RouterLink>
    </p>
  </div>
</template>

<style scoped>
.account-connections {
  min-height: 380px;
}
.account-connections__skeleton {
  min-height: 380px;
}
.connections-loading-label {
  display: block;
  margin-bottom: 18px;
  color: var(--color-text-secondary);
  font-size: 13px;
}
.connections-placeholder {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 94px;
  border-bottom: 1px solid var(--color-border);
}
.connections-placeholder i {
  display: block;
  background: var(--color-bg-hover);
  border-radius: 6px;
}
.connections-placeholder .connections-placeholder__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}
.connections-placeholder > div {
  flex: 1;
}
.connections-placeholder > div i {
  width: 38%;
  height: 12px;
  margin: 8px 0;
}
.connections-placeholder > div i + i {
  width: 64%;
  height: 10px;
}
.connections-placeholder__action {
  width: 64px;
  height: 30px;
}
.connections-status {
  min-height: 32px;
  color: var(--color-text-secondary);
  font-size: 13px;
}
.community-page__grid {
  animation: connections-enter 160ms ease-out;
}
@keyframes connections-enter {
  from {
    opacity: 0.65;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .community-page__grid {
    animation: none;
  }
}
</style>
