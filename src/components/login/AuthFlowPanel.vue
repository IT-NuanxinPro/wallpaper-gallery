<script setup>
import { computed } from 'vue'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'

const props = defineProps({
  badge: {
    type: String,
    default: '',
  },
  eyebrow: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: 'loading',
  },
  text: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '请稍候...',
  },
})

const isLoading = computed(() => props.state === 'loading')
const isSuccess = computed(() => props.state === 'success')
</script>

<template>
  <div class="auth-flow-panel" :class="`auth-flow-panel--${state}`">
    <div v-if="eyebrow || badge" class="auth-flow-panel__meta">
      <span v-if="eyebrow" class="auth-flow-panel__eyebrow">{{ eyebrow }}</span>
      <span v-if="badge" class="auth-flow-panel__badge">{{ badge }}</span>
    </div>

    <div class="auth-flow-panel__visual" :class="`is-${state}`" aria-hidden="true">
      <div v-if="isLoading" class="auth-flow-panel__loader">
        <LoadingSpinner size="lg" />
      </div>

      <div v-else class="auth-flow-panel__status-icon">
        <svg v-if="isSuccess" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="m5 12 4.5 4.5L19 7.5" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </div>
    </div>

    <div class="auth-flow-panel__copy">
      <h1>{{ title }}</h1>
      <p>{{ text }}</p>
    </div>

    <div v-if="$slots.actions" class="auth-flow-panel__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.auth-flow-panel {
  --auth-flow-surface:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.88)),
    linear-gradient(150deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.05) 58%, rgba(255, 255, 255, 0));
  --auth-flow-border: rgba(148, 163, 184, 0.16);
  --auth-flow-shadow: 0 28px 56px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.52);
  --auth-flow-heading: #0f172a;
  --auth-flow-text: #526277;
  --auth-flow-muted: #64748b;
  --auth-flow-badge-bg: rgba(37, 99, 235, 0.1);
  --auth-flow-badge-border: rgba(37, 99, 235, 0.12);
  --auth-flow-badge-text: #1d4ed8;
  --auth-flow-loading-ring: rgba(37, 99, 235, 0.14);
  --auth-flow-success-ring: rgba(34, 197, 94, 0.16);
  --auth-flow-success-text: #15803d;
  --auth-flow-error-ring: rgba(239, 68, 68, 0.16);
  --auth-flow-error-text: #dc2626;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  padding: clamp(22px, 4vw, 32px);
  border-radius: 28px;
  background: var(--auth-flow-surface);
  border: 1px solid var(--auth-flow-border);
  box-shadow: var(--auth-flow-shadow);
  text-align: center;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  [data-theme='dark'] & {
    --auth-flow-surface:
      linear-gradient(180deg, rgba(5, 11, 24, 0.96), rgba(9, 16, 30, 0.92)),
      linear-gradient(145deg, rgba(59, 130, 246, 0.16), rgba(14, 165, 233, 0.08) 55%, rgba(2, 6, 23, 0));
    --auth-flow-border: rgba(148, 163, 184, 0.18);
    --auth-flow-shadow: 0 30px 70px rgba(0, 0, 0, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    --auth-flow-heading: #f8fafc;
    --auth-flow-text: #cbd5e1;
    --auth-flow-muted: #94a3b8;
    --auth-flow-badge-bg: rgba(59, 130, 246, 0.16);
    --auth-flow-badge-border: rgba(96, 165, 250, 0.14);
    --auth-flow-badge-text: #bfdbfe;
    --auth-flow-loading-ring: rgba(96, 165, 250, 0.16);
    --auth-flow-success-ring: rgba(34, 197, 94, 0.18);
    --auth-flow-success-text: #4ade80;
    --auth-flow-error-ring: rgba(248, 113, 113, 0.18);
    --auth-flow-error-text: #fca5a5;
  }
}

.auth-flow-panel__meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.auth-flow-panel__eyebrow,
.auth-flow-panel__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.auth-flow-panel__eyebrow {
  color: var(--auth-flow-muted);
  background: rgba(148, 163, 184, 0.1);
}

.auth-flow-panel__badge {
  color: var(--auth-flow-badge-text);
  background: var(--auth-flow-badge-bg);
  border: 1px solid var(--auth-flow-badge-border);
}

.auth-flow-panel__visual {
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-flow-panel__loader {
  padding: 24px;
}

.auth-flow-panel__status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 82px;
  height: 82px;
  border-radius: 999px;
  border: 1px solid transparent;

  svg {
    width: 34px;
    height: 34px;
  }
}

.auth-flow-panel__visual.is-success .auth-flow-panel__status-icon {
  color: var(--auth-flow-success-text);
  background: var(--auth-flow-success-ring);
  border-color: rgba(34, 197, 94, 0.14);
}

.auth-flow-panel__visual.is-error .auth-flow-panel__status-icon {
  color: var(--auth-flow-error-text);
  background: var(--auth-flow-error-ring);
  border-color: rgba(239, 68, 68, 0.14);
}

.auth-flow-panel__copy {
  display: flex;
  flex-direction: column;
  gap: 10px;

  h1 {
    margin: 0;
    color: var(--auth-flow-heading);
    font-size: clamp(22px, 3vw, 28px);
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  p {
    margin: 0 auto;
    max-width: 32ch;
    color: var(--auth-flow-text);
    font-size: 14px;
    line-height: 1.7;
  }
}

.auth-flow-panel__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
