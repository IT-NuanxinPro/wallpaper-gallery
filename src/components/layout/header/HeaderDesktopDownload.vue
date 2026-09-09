<script setup>
const releaseBase = 'https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/download/desktop'

const desktopDownloads = [
  {
    id: 'macos',
    name: 'macOS 客户端',
    meta: 'Universal · DMG',
    url: `${releaseBase}/Wallpaper-Gallery-macOS-universal.dmg`,
  },
  {
    id: 'windows',
    name: 'Windows 客户端',
    meta: 'x64 · MSI',
    url: `${releaseBase}/Wallpaper-Gallery-Windows-x64.msi`,
  },
  {
    id: 'linux',
    name: 'Linux 客户端',
    meta: 'x86_64 · AppImage',
    url: `${releaseBase}/Wallpaper-Gallery-linux-x86_64.AppImage`,
  },
]
</script>

<template>
  <el-dropdown
    trigger="hover"
    placement="bottom-start"
    popper-class="header-desktop-download-dropdown"
    :show-timeout="90"
    :hide-timeout="120"
  >
    <button
      class="header-desktop-download-trigger"
      type="button"
      aria-label="下载桌面客户端"
      title="下载桌面客户端"
    >
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2" />
      </svg>
    </button>

    <template #dropdown>
      <div class="desktop-download-menu">
        <a
          v-for="item in desktopDownloads"
          :key="item.id"
          :href="item.url"
          class="desktop-download-item"
          rel="noopener noreferrer"
        >
          <span class="desktop-download-item__icon" :class="`is-${item.id}`">
            <svg v-if="item.id === 'macos'" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.79 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.1ZM12.03 7.25C11.88 5.02 13.69 3.18 15.77 3c.29 2.58-2.34 4.5-3.74 4.25Z" />
            </svg>
            <svg v-else-if="item.id === 'windows'" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 5.1 10.3 4v7H3V5.1Zm8.3-1.25L21 2.4V11h-9.7V3.85ZM3 12h7.3v7L3 17.9V12Zm8.3 0H21v8.6l-9.7-1.45V12Z" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M8.2 9.2c.2-3.3 1.4-5.7 3.8-5.7s3.6 2.4 3.8 5.7c.1 1.5.7 2.4 1.4 3.5.9 1.4 1.8 2.9 1.3 4.4-.4 1.1-1.5 1.6-2.8 1.6-.9 1.2-2 1.8-3.7 1.8s-2.8-.6-3.7-1.8c-1.3 0-2.4-.5-2.8-1.6-.5-1.5.4-3 1.3-4.4.7-1.1 1.3-2 1.4-3.5Z" />
              <circle cx="10.2" cy="8.7" r=".7" fill="currentColor" stroke="none" />
              <circle cx="13.8" cy="8.7" r=".7" fill="currentColor" stroke="none" />
              <path d="M10.3 11.3c.6.5 1.1.7 1.7.7s1.1-.2 1.7-.7" />
            </svg>
          </span>

          <span class="desktop-download-item__content">
            <strong>{{ item.name }}</strong>
            <small>{{ item.meta }}</small>
          </span>

          <svg class="desktop-download-item__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v11" />
            <path d="m8 12 4 4 4-4" />
            <path d="M6 20h12" />
          </svg>
        </a>
      </div>
    </template>
  </el-dropdown>
</template>

<style lang="scss">
.header-desktop-download-dropdown.el-popper {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.header-desktop-download-dropdown .el-popper__arrow::before {
  border-color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.96);
}

.desktop-download-menu {
  width: 286px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 24px 58px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.desktop-download-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 66px;
  padding: 9px 10px;
  border-radius: 15px;
  color: #334155;
  text-decoration: none;
  transition:
    transform 180ms ease,
    color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}

.desktop-download-item + .desktop-download-item {
  margin-top: 3px;
}

.desktop-download-item:hover,
.desktop-download-item:focus-visible {
  color: #0f172a;
  background: rgba(14, 165, 233, 0.1);
  transform: translateY(-1px);
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.08);
  outline: none;
}

.desktop-download-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 50%;
  color: #64748b;
  background: rgba(241, 245, 249, 0.92);
}

.desktop-download-item__icon svg {
  width: 23px;
  height: 23px;
}

.desktop-download-item__icon.is-windows {
  color: #2f80ed;
  background: rgba(47, 128, 237, 0.1);
}

.desktop-download-item__icon.is-linux {
  color: #475569;
  background: rgba(245, 158, 11, 0.1);
}

.desktop-download-item__content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.desktop-download-item__content strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-download-item__content small {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
}

.desktop-download-item__arrow {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  color: #94a3b8;
  transition: transform 180ms ease, color 180ms ease;
}

.desktop-download-item:hover .desktop-download-item__arrow,
.desktop-download-item:focus-visible .desktop-download-item__arrow {
  color: #0ea5e9;
  transform: translateY(2px);
}

html[data-theme='dark'] .header-desktop-download-dropdown .el-popper__arrow::before {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(8, 15, 28, 0.96);
}

html[data-theme='dark'] .desktop-download-menu {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(8, 15, 28, 0.95);
  box-shadow:
    0 26px 62px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

html[data-theme='dark'] .desktop-download-item {
  color: #dbeafe;
}

html[data-theme='dark'] .desktop-download-item:hover,
html[data-theme='dark'] .desktop-download-item:focus-visible {
  color: #f8fafc;
  background: rgba(56, 189, 248, 0.13);
}

html[data-theme='dark'] .desktop-download-item__icon {
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.86);
}

html[data-theme='dark'] .desktop-download-item__icon.is-windows {
  color: #60a5fa;
  background: rgba(37, 99, 235, 0.18);
}

html[data-theme='dark'] .desktop-download-item__icon.is-linux {
  color: #e2e8f0;
  background: rgba(245, 158, 11, 0.13);
}
</style>

<style lang="scss" scoped>
.header-desktop-download-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: $radius-full;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.6);
  }

  &:hover,
  &:focus-visible {
    color: var(--color-accent);
    background: var(--accent-surface);
    border-color: var(--accent-border-strong);
    box-shadow: 0 4px 15px var(--accent-shadow);
    transform: translateY(-2px);
    outline: none;
  }

  &:active {
    transform: translateY(0) scale(0.95);
  }

  .icon {
    width: 20px;
    height: 20px;
  }

  @media (min-width: 768px) and (max-width: 1180px) {
    width: 40px;
    height: 40px;
  }
}
</style>
