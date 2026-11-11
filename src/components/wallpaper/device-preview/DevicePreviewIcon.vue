<script setup>
defineProps({ name: { type: String, default: 'laptop' } })
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'screen'"><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></template>
    <template v-else-if="name === 'replay'"><path d="M4 5v5h5M4.6 10a8 8 0 1 1 .5 6" /></template>
    <template v-else-if="name === 'phone'"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M10 5h4" /></template>
    <template v-else-if="name === 'monitor'"><rect x="6" y="2" width="12" height="16" rx="1.5" /><path d="M12 18v4m-4 0h8" /></template>
    <template v-else-if="name === 'laptop'"><rect x="4" y="4" width="16" height="12" rx="1.5" /><path d="M2 20h20" /></template>
    <template v-else><rect x="3" y="5" width="18" height="14" rx="2" /><path v-if="name === 'fold2'" d="M12 5v14" stroke-dasharray="1.5 2" /><path v-else-if="name === 'fold3'" d="M9 5v14m6-14v14" stroke-dasharray="1.5 2" /><circle v-else cx="12" cy="7.5" r=".5" /></template>
  </svg>
</template>
