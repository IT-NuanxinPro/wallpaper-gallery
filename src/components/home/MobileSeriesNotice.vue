<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  content: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <div class="series-notice-card">
    <div class="series-notice-card__badge">
      {{ content.eyebrow }}
    </div>

    <div class="series-notice-card__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M9 7h6" />
        <path d="M12 17h.01" />
      </svg>
    </div>

    <h1 class="series-notice-card__title">
      {{ content.title }}
    </h1>

    <p class="series-notice-card__description">
      {{ content.description }}
    </p>

    <div class="series-notice-card__actions">
      <RouterLink class="series-notice-card__button series-notice-card__button--primary" to="/mobile">
        去手机壁纸
      </RouterLink>
      <RouterLink class="series-notice-card__button series-notice-card__button--secondary" to="/avatar">
        去头像专区
      </RouterLink>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.series-notice-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: $spacing-2xl;
  margin-top: $spacing-lg;
  border-radius: $radius-xl;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.02)), var(--color-bg-secondary);
  border: 1px solid rgba(99, 102, 241, 0.14);
  box-shadow: var(--shadow-md);

  @include mobile-only {
    padding: $spacing-xl $spacing-lg;
    margin-top: $spacing-md;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-xs $spacing-md;
    margin-bottom: $spacing-md;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-accent);
    background: rgba(99, 102, 241, 0.1);
    border-radius: $radius-full;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    margin-bottom: $spacing-lg;
    color: var(--color-accent);
    background: rgba(99, 102, 241, 0.1);
    border-radius: $radius-full;

    svg {
      width: 32px;
      height: 32px;
    }
  }

  &__title {
    max-width: 520px;
    margin-bottom: $spacing-md;
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: var(--color-text-primary);
    line-height: 1.4;

    @include mobile-only {
      font-size: $font-size-lg;
    }
  }

  &__description {
    max-width: 620px;
    margin-bottom: $spacing-xl;
    font-size: $font-size-md;
    color: var(--color-text-secondary);
    line-height: 1.8;

    @include mobile-only {
      margin-bottom: $spacing-lg;
      font-size: $font-size-sm;
    }
  }

  &__actions {
    display: flex;
    gap: $spacing-md;

    @include mobile-only {
      width: 100%;
      flex-direction: column;
    }
  }

  &__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 144px;
    padding: $spacing-sm $spacing-xl;
    border-radius: $radius-full;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    text-decoration: none;
    transition:
      transform var(--transition-fast),
      box-shadow var(--transition-fast),
      background-color var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);

    @include mobile-only {
      width: 100%;
    }

    &:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    &--primary {
      color: #fff;
      background: var(--color-accent);
    }

    &--secondary {
      color: var(--color-text-primary);
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
    }
  }
}
</style>
