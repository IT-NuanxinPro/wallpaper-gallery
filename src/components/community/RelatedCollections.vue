<script setup>
import { computed } from 'vue'
import { communityService } from '@/services/communityService'
import { useAuthStore } from '@/stores/auth'
import { useCommunityRequest } from '@/utils/community/useCommunityRequest'
import PublicCollectionCard from './PublicCollectionCard.vue'

const props = defineProps({ record: { type: Object, default: null }, assetKey: { type: String, default: '' } })
const auth = useAuthStore()
const key = computed(() => props.assetKey || props.record?.assetKey || props.record?._assetKey || '')
const { state } = useCommunityRequest(() => [key.value, auth.user?.id], signal => communityService.getRelatedCollections(key.value, { signal, limit: 6 }))
const visible = computed(() => state.value.status === 'ready' && Boolean(state.value.data?.length))
</script>

<template>
  <section class="related-collections" :class="{ 'is-collapsed': !visible }" :style="{ gridTemplateRows: visible ? '1fr' : '0fr' }" :aria-hidden="visible ? undefined : true" :inert="!visible" aria-labelledby="related-collections-title">
    <div class="related-collections__content">
      <div class="related-collections__heading">
        <div>
          <h2 id="related-collections-title">
            相关收藏
          </h2><p>看看大家如何搭配喜欢的画面。</p>
        </div>
      </div>
      <div class="related-collections__body" :aria-busy="state.status === 'loading'">
        <div v-if="state.data?.length" class="related-collections__grid" aria-label="相关收藏列表，可横向浏览" tabindex="0">
          <PublicCollectionCard v-for="collection in state.data" :key="collection.id" :collection="collection" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.related-collections {
  display: grid;
  margin-block: 44px;
  overflow-anchor: none;
  transition:
    grid-template-rows 320ms cubic-bezier(0.22, 1, 0.36, 1),
    margin-block 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}
.related-collections.is-collapsed {
  margin-block: 0;
  opacity: 0;
  pointer-events: none;
}
.related-collections__content {
  min-height: 0;
  overflow: hidden;
}
.related-collections__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}
.related-collections h2 {
  margin: 0 0 8px;
  font-size: clamp(20px, 3vw, 26px);
}
.related-collections p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.related-collections a,
.related-collections button {
  color: var(--color-accent);
}
.related-collections__body {
  height: 280px;
  overflow-anchor: none;
}
.related-collections__grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: calc((100% - 40px) / 3);
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  gap: 20px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}
.related-collections__grid :deep(.public-collection) {
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 76px;
  scroll-snap-align: start;
}
.related-collections__grid :deep(.public-collection__preview) {
  aspect-ratio: auto;
  min-height: 0;
}
.related-collections__grid :deep(.public-collection__copy) {
  padding: 12px 16px;
  min-width: 0;
}
.related-collections__grid :deep(.public-collection__copy h3),
.related-collections__grid :deep(.public-collection__copy p) {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.related-collections__grid :deep(.public-collection__description) {
  display: none;
}
@media (max-width: 800px) {
  .related-collections__grid {
    grid-auto-columns: calc((100% - 20px) / 2);
  }
}
@media (max-width: 480px) {
  .related-collections__grid {
    grid-auto-columns: min(85%, 310px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .related-collections {
    transition: none;
  }
}
</style>
