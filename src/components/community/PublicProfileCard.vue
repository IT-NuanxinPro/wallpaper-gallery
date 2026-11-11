<script setup>
import RemoteAvatar from '@/components/common/ui/RemoteAvatar.vue'
import { getAvatarInitial, getAvatarStyle } from '@/utils/auth/avatarAppearance'
import { sanitizePublicAvatarUrl } from '@/utils/auth/providerProfile'
import { publicProfileName } from '@/utils/community/profile'

defineProps({ profile: { type: Object, required: true } })
</script>

<template>
  <RouterLink class="community-person" :to="`/people/${profile.id}`">
    <RemoteAvatar :src="sanitizePublicAvatarUrl(profile.avatar_url)" :alt="`${publicProfileName(profile)}的头像`" :initial="getAvatarInitial(publicProfileName(profile))" :fallback-style="getAvatarStyle(publicProfileName(profile))" image-class="community-avatar" fallback-class="community-avatar" />
    <div class="community-person__text">
      <h2>{{ publicProfileName(profile) }}</h2>
      <p>{{ profile.bio || '一起发现喜欢的壁纸。' }}</p>
      <span>{{ profile.collection_count }} 个公开收藏夹 · {{ profile.followers_count }} 位公开粉丝</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.community-person {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 24px;
  color: inherit;
  text-decoration: none;
  border: 1px solid var(--color-border);
  border-radius: 22px;
  background: var(--color-bg-primary);
}
.community-person:hover {
  border-color: var(--color-accent);
}
.community-person :deep(.community-avatar) {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  border-radius: 50%;
  object-fit: cover;
  display: grid;
  place-items: center;
  font-size: 24px;
}
.community-person__text {
  min-width: 0;
}
.community-person h2 {
  margin: 0 0 7px;
  font-size: 18px;
  overflow-wrap: anywhere;
}
.community-person p {
  margin: 0 0 10px;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.community-person span {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
