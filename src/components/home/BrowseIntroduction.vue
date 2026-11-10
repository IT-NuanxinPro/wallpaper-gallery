<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { canonicalizePagePath, SITE_SEO } from '@/utils/seo/routes'

const props = defineProps({ path: { type: String, required: true } })
const page = computed(() => SITE_SEO[canonicalizePagePath(props.path)] || SITE_SEO['/'])
const sections = ['/desktop', '/mobile', '/avatar', '/bing', '/video', '/collections']
</script>

<template>
  <section class="browse-introduction" aria-label="壁纸分类介绍">
    <div class="browse-introduction-copy">
      <h1>{{ page.label }}</h1>
      <p>{{ page.description }}</p>
    </div>
    <nav class="browse-introduction-links" aria-label="浏览壁纸分类">
      <RouterLink v-for="section in sections" :key="section" :to="section" :aria-current="props.path === section ? 'page' : undefined">
        {{ SITE_SEO[section].label }}
      </RouterLink>
    </nav>
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
}
.browse-introduction-copy {
  flex: 1 1 420px;
}
.browse-introduction h1 {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  font-size: 24px;
  line-height: 1.4;
}
.browse-introduction p {
  max-width: 680px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.8;
}
.browse-introduction-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.browse-introduction-links a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-decoration: none;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}
.browse-introduction-links a:hover,
.browse-introduction-links a[aria-current='page'] {
  color: var(--color-accent);
  background: var(--accent-surface);
}
.browse-introduction-links a:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .browse-introduction-links a {
    transition: none;
  }
}
</style>
