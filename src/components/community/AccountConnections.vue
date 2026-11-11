<script setup>
import { computed } from 'vue'
import ContentEmpty from '@/components/common/feedback/ContentEmpty.vue'
import ContentLoading from '@/components/common/feedback/ContentLoading.vue'
import { communityService } from '@/services/communityService'
import { useAuthStore } from '@/stores/auth'
import { useCommunityRequest } from '@/utils/community/useCommunityRequest'
import PublicProfileCard from './PublicProfileCard.vue'

const props = defineProps({ kind: { type: String, required: true } })
const auth = useAuthStore()
const { state, refresh } = useCommunityRequest(() => [auth.user?.id, props.kind], async (signal) => {
  if (!auth.user?.id)
    return null
  const profile = await communityService.getProfile(auth.user.id, { signal })
  if (!profile)
    return { published: false, items: [] }
  const result = await communityService.getConnections(auth.user.id, props.kind, { signal, limit: 48 })
  return { ...result, published: true }
})
const title = computed(() => props.kind === 'following' ? '关注' : '粉丝')
</script>

<template>
  <div class="account-connections">
    <ContentLoading v-if="state.status === 'loading'" :label="`正在加载${title}`" />
    <div v-else-if="state.status === 'error'" class="profile-empty">
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
    <p v-if="state.data?.has_more" class="community-page__notice">
      <RouterLink :to="`/people/${auth.user.id}?tab=${kind}`">
        查看全部{{ title }} →
      </RouterLink>
    </p>
  </div>
</template>
