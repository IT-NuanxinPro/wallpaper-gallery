<script setup>
import { computed } from 'vue'
import OnlineVisitorsBadge from '@/components/home/OnlineVisitorsBadge.vue'
import { canonicalizePagePath, SITE_SEO } from '@/utils/seo/routes'

const props = defineProps({ path: { type: String, required: true }, activePath: { type: String, default: '' }, headingTag: { type: String, default: 'h1' } })
const page = computed(() => SITE_SEO[canonicalizePagePath(props.path)] || SITE_SEO['/'])
</script>

<template>
  <section class="browse-introduction" aria-label="壁纸分类介绍">
    <div class="browse-introduction-copy">
      <div class="browse-introduction-heading">
        <component :is="headingTag" class="browse-introduction-title">
          {{ page.label }}
        </component>
        <OnlineVisitorsBadge />
      </div>
      <p>{{ page.description }}</p>
    </div>
  </section>
</template>

<style scoped>
.browse-introduction {
  display: flex;
  align-items: end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin: 8px 0 24px;
  min-height: 100px;
}
.browse-introduction-copy {
  flex: 1 1 420px;
  min-width: 0;
}
.browse-introduction-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.browse-introduction .browse-introduction-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
}
.browse-introduction p {
  max-width: 680px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.8;
}
@media (max-width: 767px) {
  .browse-introduction {
    align-content: start;
  }
  .browse-introduction-heading {
    gap: 8px;
  }
}
@media (max-width: 360px) {
  .browse-introduction .browse-introduction-title {
    font-size: 22px;
  }
}
</style>
