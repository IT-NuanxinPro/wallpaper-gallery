<script setup>
import { DETAIL_STATS_METRICS, formatDetailStatsCount } from '@/utils/stats/detailMetrics'

defineProps({
  stats: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
})
</script>

<template>
  <dl class="detail-stats" aria-label="壁纸统计" :aria-busy="loading" :title="failed ? '统计暂不可用' : undefined">
    <div v-for="metric in DETAIL_STATS_METRICS" :key="metric.key" :title="metric.title">
      <dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="metric.path" /></svg><span>{{ metric.label }}</span></dt>
      <dd>{{ formatDetailStatsCount(stats?.[metric.key]) }}</dd>
    </div>
  </dl>
</template>
