<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  activeThemeOption: {
    type: Object,
    required: true,
  },
  isMobile: {
    type: Boolean,
    default: false,
  },
  showThemeMenu: {
    type: Boolean,
    default: false,
  },
  theme: {
    type: String,
    default: 'light',
  },
  themeButtonLabel: {
    type: String,
    default: '',
  },
  themeMode: {
    type: String,
    default: 'system',
  },
  themeOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['quickToggle', 'select', 'toggle', 'update:showThemeMenu'])

const rootRef = ref(null)
const themeIcon = computed(() => props.theme === 'dark' ? 'dark' : 'light')

function closeMenu() {
  emit('update:showThemeMenu', false)
}

function containsTarget(target) {
  return rootRef.value?.contains(target) ?? false
}

defineExpose({
  containsTarget,
})
</script>

<template>
  <div ref="rootRef" class="theme-switcher">
    <button
      class="theme-toggle"
      :class="{ 'is-active': showThemeMenu }"
      :aria-label="themeButtonLabel"
      :aria-haspopup="isMobile ? 'dialog' : 'menu'"
      :aria-expanded="showThemeMenu"
      @click="emit('toggle')"
    >
      <svg v-if="themeIcon === 'dark'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
      <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>

    <template v-if="!isMobile">
      <Transition name="theme-menu">
        <div v-if="showThemeMenu" class="theme-menu" role="menu" aria-label="主题模式">
          <div class="theme-menu-header">
            <span class="theme-menu-title">外观主题</span>
            <span class="theme-menu-subtitle">{{ activeThemeOption.label }}</span>
          </div>

          <button class="theme-menu-quick" type="button" @click="emit('quickToggle')">
            <span>快速切换</span>
            <span>{{ theme === 'dark' ? '切到浅色' : '切到深色' }}</span>
          </button>

          <button
            v-for="option in themeOptions"
            :key="option.value"
            class="theme-menu-option"
            :class="{ 'is-active': themeMode === option.value }"
            type="button"
            role="menuitemradio"
            :aria-checked="themeMode === option.value"
            @click="emit('select', option.value)"
          >
            <span class="theme-menu-option__title">{{ option.label }}</span>
            <span class="theme-menu-option__desc">{{ option.description }}</span>
          </button>
        </div>
      </Transition>
    </template>

    <Teleport v-else to="body">
      <van-popup
        :show="showThemeMenu"
        position="bottom"
        round
        class="theme-sheet"
        :teleport="null"
        :close-on-click-overlay="true"
        @update:show="emit('update:showThemeMenu', $event)"
      >
        <div class="theme-sheet-content">
          <div class="theme-sheet-header">
            <div>
              <h3>外观主题</h3>
              <p>当前为{{ activeThemeOption.label }}</p>
            </div>
            <button class="theme-sheet-close" type="button" @click="closeMenu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button class="theme-sheet-quick" type="button" @click="emit('quickToggle')">
            <span>快速切换</span>
            <span>{{ theme === 'dark' ? '切到浅色' : '切到深色' }}</span>
          </button>

          <button
            v-for="option in themeOptions"
            :key="option.value"
            class="theme-sheet-option"
            :class="{ 'is-active': themeMode === option.value }"
            type="button"
            @click="emit('select', option.value)"
          >
            <span class="theme-sheet-option__title">{{ option.label }}</span>
            <span class="theme-sheet-option__desc">{{ option.description }}</span>
          </button>
        </div>
      </van-popup>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.theme-switcher {
  position: relative;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: $radius-full;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

  @include tablet-up {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  @include mobile-only {
    background: rgba(255, 255, 255, 0.8);
  }

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.08);

    @include mobile-only {
      background: rgba(15, 23, 42, 0.85);
    }
  }

  &:hover {
    background: rgba(102, 126, 234, 0.15);
    border-color: rgba(102, 126, 234, 0.3);
    color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
  }

  &:active {
    transform: translateY(0) scale(0.95);
  }

  .icon,
  svg {
    width: 20px;
    height: 20px;
  }

  &.is-active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);

    &:hover {
      color: white;
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
  }
}

.theme-menu-enter-active,
.theme-menu-leave-active {
  transition: all 180ms ease;
}

.theme-menu-enter-from,
.theme-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.theme-menu {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: 280px;
  padding: 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.92);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
  }
}

.theme-menu-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8px 8px 10px;
}

.theme-menu-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.theme-menu-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
}

.theme-menu-quick,
.theme-menu-option {
  width: 100%;
  border: 0;
  text-align: left;
  border-radius: 16px;
  color: inherit;
  background: transparent;
  transition: all 220ms ease;
}

.theme-menu-quick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);

  &:hover {
    background: rgba(102, 126, 234, 0.16);
  }
}

.theme-menu-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;

  &:hover {
    background: rgba(102, 126, 234, 0.08);
  }

  &.is-active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.16), rgba(118, 75, 162, 0.14));
  }
}

.theme-menu-option__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.theme-menu-option__desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.theme-sheet {
  background: rgba(255, 255, 255, 0.96);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.96);
  }
}

.theme-sheet-content {
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
}

.theme-sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 18px;
    color: var(--color-text-primary);
  }

  p {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--color-text-secondary);
  }
}

.theme-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: rgba(102, 126, 234, 0.08);

  svg {
    width: 18px;
    height: 18px;
  }
}

.theme-sheet-quick,
.theme-sheet-option {
  width: 100%;
  border: 0;
  text-align: left;
  border-radius: 18px;
}

.theme-sheet-quick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}

.theme-sheet-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: rgba(102, 126, 234, 0.04);
  transition: all 220ms ease;

  & + & {
    margin-top: 10px;
  }

  &.is-active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.16), rgba(118, 75, 162, 0.14));
  }
}

.theme-sheet-option__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.theme-sheet-option__desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
