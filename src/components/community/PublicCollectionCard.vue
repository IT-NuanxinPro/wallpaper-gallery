<script setup>
import { computed } from 'vue'
import RemoteAvatar from '@/components/common/ui/RemoteAvatar.vue'
import { getAvatarInitial, getAvatarStyle } from '@/utils/auth/avatarAppearance'
import { sanitizePublicAvatarUrl } from '@/utils/auth/providerProfile'
import { loadCommunityWallpapers, publicProfileName } from '@/utils/community/profile'
import { useCommunityRequest } from '@/utils/community/useCommunityRequest'

const props = defineProps({ collection: { type: Object, required: true }, showOwner: Boolean })
const ownerName = computed(() => publicProfileName(props.collection.profile))
const { state } = useCommunityRequest(() => props.collection, signal => loadCommunityWallpapers(props.collection.asset_keys || [], { signal }))
const images = computed(() => state.value.data || [])
const previewStyle = computed(() => ({
  gridTemplateColumns: images.value.length === 1 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  gridTemplateRows: images.value.length <= 2 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
}))
</script>

<template>
  <RouterLink class="public-collection" :aria-label="showOwner ? `${ownerName}的收藏：${collection.name}` : undefined" :to="{ path: `/people/${collection.user_id}`, query: { tab: 'collections', collection: collection.id } }">
    <div class="public-collection__preview" :style="previewStyle">
      <img v-for="(image, index) in images" :key="image.assetKey" :style="{ gridRow: images.length === 3 && index === 0 ? 'span 2' : undefined }" :src="image.thumbnailUrl || image.previewUrl" :alt="image.displayTitle || image.title || image.filename" loading="lazy" decoding="async">
      <span v-if="!images.length">{{ state.status === 'loading' ? '预览加载中…' : state.status === 'error' ? '预览暂不可用' : '收藏夹暂无壁纸' }}</span>
    </div>
    <div class="public-collection__copy" :class="{ 'public-collection__copy--owner': showOwner }">
      <template v-if="showOwner">
        <RemoteAvatar
          :src="sanitizePublicAvatarUrl(collection.profile?.avatar_url)"
          :alt="`${ownerName}的头像`"
          :initial="getAvatarInitial(ownerName)"
          :fallback-style="getAvatarStyle(ownerName)"
          image-class="public-collection__avatar"
          fallback-class="public-collection__avatar"
        />
        <div class="public-collection__owner-copy">
          <h3>{{ ownerName }}</h3>
          <p>TA 的收藏</p>
        </div>
      </template>
      <template v-else>
        <h3>{{ collection.name }}</h3>
        <p>{{ collection.item_count }} 张壁纸<span v-if="collection.profile"> · {{ publicProfileName(collection.profile) }} 的收藏</span></p>
        <p v-if="collection.description" class="public-collection__description">
          {{ collection.description }}
        </p>
      </template>
    </div>
  </RouterLink>
</template>

<style scoped>
.public-collection {
  display: block;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 22px;
  color: inherit;
  text-decoration: none;
  background: var(--color-bg-primary);
}
.public-collection:hover {
  border-color: var(--color-accent);
}
.public-collection__preview {
  aspect-ratio: 16/10;
  display: grid;
  gap: 3px;
  padding: 3px;
  background: var(--color-bg-secondary);
  overflow: hidden;
}
.public-collection__preview img {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  object-fit: cover;
  border-radius: 6px;
}
.public-collection__preview > span {
  grid-area: 1 / 1 / -1 / -1;
  align-self: center;
  justify-self: center;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.public-collection__copy {
  padding: 18px;
}
.public-collection h3 {
  margin: 0 0 8px;
  font-size: 17px;
  overflow-wrap: anywhere;
}
.public-collection p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.public-collection__description {
  margin-top: 8px !important;
}
.public-collection__copy--owner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.public-collection__copy--owner :deep(.public-collection__avatar) {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  object-fit: cover;
  background: var(--avatar-accent-end, var(--color-bg-secondary));
  color: #fff;
  font-size: 17px;
  font-weight: 600;
}
.public-collection__owner-copy {
  flex: 1;
  min-width: 0;
}
.public-collection__owner-copy h3 {
  margin: 0 0 2px;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.public-collection__owner-copy p {
  font-size: 12px;
  line-height: 1.5;
}
</style>
