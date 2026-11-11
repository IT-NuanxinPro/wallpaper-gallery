<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ContentEmpty from '@/components/common/feedback/ContentEmpty.vue'
import ContentLoading from '@/components/common/feedback/ContentLoading.vue'
import RemoteAvatar from '@/components/common/ui/RemoteAvatar.vue'
import ProfileTabs from '@/components/community/ProfileTabs.vue'
import PublicCollectionCard from '@/components/community/PublicCollectionCard.vue'
import PublicProfileCard from '@/components/community/PublicProfileCard.vue'
import WallpaperCard from '@/components/wallpaper/card/index.vue'
import { communityService } from '@/services/communityService'
import { useAuthStore } from '@/stores/auth'
import { getAvatarInitial, getAvatarStyle } from '@/utils/auth/avatarAppearance'
import { sanitizePublicAvatarUrl } from '@/utils/auth/providerProfile'
import { loadCommunityWallpapers, publicProfileName } from '@/utils/community/profile'
import { useCommunityRequest } from '@/utils/community/useCommunityRequest'
import { buildWallpaperSharePath } from '@/utils/wallpaper/share'
import '@/components/community/community-page.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tabs = [{ key: 'collections', label: '收藏夹' }, { key: 'likes', label: '喜欢' }, { key: 'following', label: '关注' }, { key: 'followers', label: '粉丝' }]
const tab = computed(() => tabs.some(item => item.key === route.query.tab) ? route.query.tab : 'collections')
const collectionId = computed(() => tab.value === 'collections' && typeof route.query.collection === 'string' ? route.query.collection : '')
const page = computed(() => Math.min(4166, Math.max(0, Math.floor(Number(route.query.page)) || 0)))
const followingBusy = ref(false)
const followError = ref('')
let mounted = true
const { state: profileState, refresh: refreshProfile } = useCommunityRequest(() => [route.params.id, auth.user?.id], signal => communityService.getProfile(route.params.id, { signal }))
const profile = computed(() => profileState.value.data)
const { state, refresh: refreshContent } = useCommunityRequest(() => [profile.value?.id, profile.value?.show_likes, tab.value, collectionId.value, page.value, auth.user?.id], async (signal) => {
  followError.value = ''
  const id = profile.value?.id
  if (!id)
    return null
  const options = { signal, offset: page.value * 24, collectionId: collectionId.value }
  const list = ['following', 'followers'].includes(tab.value)
    ? await communityService.getConnections(id, tab.value, options)
    : await communityService.getWallpapers(id, collectionId.value ? 'collection' : tab.value, options)
  const wallpapers = (tab.value === 'likes' || collectionId.value)
    ? await loadCommunityWallpapers(list.items.map(item => item.asset_key), { signal })
    : []
  return { list, wallpapers }
})
async function refresh() {
  await refreshProfile()
}
const isOwnProfile = computed(() => auth.user?.id === profile.value?.id)

function changeTab(key) {
  router.push({ path: route.path, query: { tab: key } })
}

function changePage(value) {
  router.push({ path: route.path, query: { ...route.query, page: value || undefined } })
}

async function follow() {
  if (!auth.isAuthenticated) {
    await router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (followingBusy.value || !profile.value || isOwnProfile.value)
    return
  const actor = auth.user?.id
  const target = profile.value.id
  const current = profileState.value
  followingBusy.value = true
  followError.value = ''
  try {
    const result = await communityService.setFollowing(target, !profile.value.is_following, actor)
    if (!mounted || auth.user?.id !== actor || profileState.value !== current)
      return
    if (result.followers_count === null) {
      await refresh()
    }
    else {
      profileState.value.data = { ...profile.value, is_following: result.following, followers_count: result.followers_count, following_count: result.following_count }
    }
  }
  catch {
    if (mounted && auth.user?.id === actor && profileState.value === current)
      followError.value = '操作未完成，请重试。'
  }
  finally {
    followingBusy.value = false
  }
}

onBeforeUnmount(() => {
  mounted = false
})
</script>

<template>
  <main class="community-page public-profile">
    <RouterLink class="public-profile__back" :to="auth.isAuthenticated ? '/account' : '/desktop'">
      {{ auth.isAuthenticated ? '← 个人信息' : '← 浏览壁纸' }}
    </RouterLink>
    <ContentLoading v-if="profileState.status === 'loading'" label="正在加载公开主页" />
    <div v-else-if="profileState.status === 'error'" class="profile-empty" role="status">
      <h1>主页暂时无法加载</h1><p>请检查网络后重试。</p><button class="community-button" @click="refresh">
        重新加载
      </button>
    </div>
    <ContentEmpty v-else-if="!profile" description="这个主页尚未公开，或链接已失效" />
    <template v-else>
      <header class="public-profile__identity-bar">
        <RemoteAvatar :src="sanitizePublicAvatarUrl(profile.avatar_url)" :alt="`${publicProfileName(profile)}的头像`" :initial="getAvatarInitial(publicProfileName(profile))" :fallback-style="getAvatarStyle(publicProfileName(profile))" image-class="public-profile__avatar" fallback-class="public-profile__avatar" />
        <div class="public-profile__identity">
          <h1>{{ publicProfileName(profile) }}</h1>
          <p v-if="profile.bio" class="public-profile__bio">
            {{ profile.bio }}
          </p>
          <div class="public-profile__counts">
            <button @click="changeTab('following')">
              <strong>{{ profile.following_count }}</strong> 关注
            </button>
            <button @click="changeTab('followers')">
              <strong>{{ profile.followers_count }}</strong> 粉丝
            </button>
            <span><strong>{{ profile.collection_count }}</strong> 公开收藏夹</span>
          </div>
        </div>
        <RouterLink v-if="isOwnProfile" class="community-button" to="/account?tab=settings">
          编辑公开设置
        </RouterLink>
        <button v-else class="community-button" :disabled="followingBusy" :aria-pressed="profile.is_following" @click="follow">
          {{ followingBusy ? '处理中…' : profile.is_following ? '已关注 · 取消' : '关注' }}
        </button>
      </header>
      <p v-if="followError" role="alert" class="community-page__notice">
        {{ followError }}
      </p>
      <ProfileTabs :tabs="tabs" :model-value="tab" @update:model-value="changeTab" />
      <div class="public-profile__content" role="tabpanel" :aria-busy="state.status === 'loading'">
        <ContentLoading v-if="state.status === 'loading'" label="正在加载壁纸内容" />
        <div v-else-if="state.status === 'error'" class="profile-empty">
          <p>内容暂时无法加载。</p><button class="community-button" @click="refreshContent">
            重试
          </button>
        </div>
        <template v-else-if="state.data">
          <div v-if="collectionId" class="public-profile__collection-back">
            <button class="community-button" @click="changeTab('collections')">
              ← 全部公开收藏夹
            </button>
          </div>
          <p v-if="['following', 'followers'].includes(tab)" class="community-page__notice">
            仅展示已公开主页的用户。
          </p>
          <ContentEmpty v-if="state.data.list.hidden" description="这部分内容暂未公开" />
          <ContentEmpty v-else-if="!state.data.list.items.length" :description="collectionId ? '这个收藏夹暂无可展示的壁纸' : tab === 'likes' ? '还没有公开喜欢的壁纸' : tab === 'following' ? '还没有公开关注' : tab === 'followers' ? '还没有公开粉丝' : '还没有公开收藏夹'" />
          <div v-else-if="['following', 'followers'].includes(tab)" class="community-page__grid community-page__grid--people">
            <PublicProfileCard v-for="person in state.data.list.items" :key="person.id" :profile="person" />
          </div>
          <div v-else-if="tab === 'collections' && !collectionId" class="community-page__grid">
            <PublicCollectionCard v-for="collection in state.data.list.items" :key="collection.id" :collection="collection" />
          </div>
          <ContentEmpty v-else-if="!state.data.wallpapers.length" description="这些壁纸已移除或暂未同步到图库" />
          <div v-else class="community-page__grid public-profile__wallpapers">
            <WallpaperCard v-for="(wallpaper, index) in state.data.wallpapers" :key="wallpaper.assetKey" :wallpaper="wallpaper" :index="index" :series="wallpaper.series" :aspect-ratio="wallpaper.resolution ? `${wallpaper.resolution.width}/${wallpaper.resolution.height}` : wallpaper.series === 'mobile' ? '9/16' : wallpaper.series === 'avatar' ? '1/1' : '16/10'" @click="router.push(buildWallpaperSharePath(wallpaper))" />
          </div>
          <nav v-if="page > 0 || state.data.list.has_more" class="community-pagination" aria-label="公开内容分页">
            <button class="community-button" :disabled="page === 0" @click="changePage(page - 1)">
              上一页
            </button><span>第 {{ page + 1 }} 页</span><button class="community-button" :disabled="!state.data.list.has_more" @click="changePage(page + 1)">
              下一页
            </button>
          </nav>
        </template>
      </div>
    </template>
  </main>
</template>

<style scoped>
.public-profile__back {
  display: inline-block;
  margin-bottom: 24px;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.public-profile__identity-bar {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 8px 0 24px;
}
.public-profile__identity-bar :deep(.public-profile__avatar) {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  display: grid;
  place-items: center;
  font-size: 24px;
  border: 2px solid var(--color-bg-secondary);
  box-shadow: 0 0 0 1px var(--accent-border);
}
.public-profile__identity {
  min-width: 0;
}
.public-profile .public-profile__identity h1 {
  margin: 0 0 5px;
  font-size: 20px;
  line-height: 1.5;
  letter-spacing: 0;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.public-profile__bio {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.public-profile__counts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 18px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.public-profile__counts button {
  border: 0;
  padding: 4px 0;
  color: inherit;
  background: none;
  font: inherit;
  cursor: pointer;
}
.public-profile__counts strong {
  color: var(--color-text-primary);
  font-weight: 600;
}
.public-profile__identity-bar > .community-button {
  min-width: 88px;
  color: var(--color-accent);
  border-color: var(--accent-border);
  background: var(--accent-surface);
}
.public-profile__tabs {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  margin: 0 0 24px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}
.public-profile__tabs button {
  padding: 12px 18px;
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
}
.public-profile__tabs button[aria-current='page'] {
  color: var(--color-accent);
  background: var(--color-bg-secondary);
}
.public-profile__tabs span {
  font-size: 12px;
}
.public-profile__collection-back {
  margin-bottom: 22px;
}
.public-profile__wallpapers {
  align-items: start;
}
@media (max-width: 600px) {
  .public-profile__identity-bar {
    grid-template-columns: 48px minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    padding: 0 0 20px;
  }
  .public-profile__identity-bar :deep(.public-profile__avatar) {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
  .public-profile .public-profile__identity h1 {
    font-size: 17px;
  }
  .public-profile__identity-bar > .community-button {
    min-width: 68px;
    min-height: 36px;
    padding: 7px 12px;
    font-size: 12px;
  }
  .public-profile__counts {
    gap: 4px 12px;
    font-size: 11px;
  }
  .public-profile__tabs {
    gap: 3px;
  }
  .public-profile__tabs button {
    padding: 10px 13px;
  }
}
</style>

<style scoped>
.public-profile {
  width: min(1360px, calc(100% - 40px));
}
.public-profile__identity-bar {
  border: 1px solid var(--color-border);
  border-bottom: 0;
  border-radius: 26px 26px 0 0;
  padding: 30px;
  background: var(--accent-surface);
  grid-template-columns: 88px minmax(0, 1fr) auto;
}
.public-profile__identity-bar :deep(.public-profile__avatar) {
  width: 88px;
  height: 88px;
}
.public-profile .public-profile__identity h1 {
  font-size: 25px;
}
.public-profile__counts {
  margin-top: 18px;
  font-size: 14px;
  gap: 24px;
}
.public-profile :deep(.profile-tabs) {
  background: color-mix(in srgb, var(--color-bg-primary) 80%, transparent);
  border: 1px solid var(--color-border);
  border-top: 0;
  border-radius: 0 0 24px 24px;
}
.public-profile__content {
  padding-top: 28px;
  min-height: 380px;
}
.public-profile__content > * {
  animation: profile-content-enter 220ms ease-out;
}
@keyframes profile-content-enter {
  from {
    opacity: 0.4;
  }
  to {
    opacity: 1;
  }
}
@media (max-width: 600px) {
  .public-profile {
    width: calc(100% - 28px);
  }
  .public-profile__identity-bar {
    padding: 22px 18px;
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 14px;
  }
  .public-profile__identity-bar :deep(.public-profile__avatar) {
    width: 56px;
    height: 56px;
  }
  .public-profile .public-profile__identity h1 {
    font-size: 21px;
  }
  .public-profile__identity-bar > .community-button {
    grid-column: 1 / -1;
  }
  .public-profile__counts {
    gap: 14px;
    font-size: 12px;
    margin-top: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .public-profile__content > * {
    animation: none;
  }
}
</style>

<style scoped>
.public-profile__identity-bar > button.community-button {
  background: var(--accent-gradient);
  color: #fff;
  border-color: transparent;
}
.public-profile__identity-bar > button.community-button[aria-pressed='true'] {
  background: var(--accent-surface);
  color: var(--color-accent);
  border-color: var(--accent-border);
}
</style>
