<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="about-page">
    <div class="container">
      <div class="about-content">
        <h1 class="about-title">
          关于 Wallpaper Gallery
        </h1>

        <section class="about-section">
          <h2>项目介绍</h2>
          <p>
            Wallpaper Gallery 是一个精选高清壁纸展示平台，提供海量 4K、5K 超高清壁纸免费下载。
            我们精心挑选每一张壁纸，确保为您带来最佳的视觉体验。
          </p>
        </section>

        <section class="about-section">
          <h2>特色功能</h2>
          <ul class="feature-list">
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>高清 4K/5K 壁纸，免费下载</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>智能搜索和分类筛选</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>多种视图模式（网格/列表/瀑布流）</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>浅色/深色主题切换</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>全屏浏览模式</span>
            </li>
          </ul>
        </section>

        <section class="about-section">
          <h2>技术栈</h2>
          <div class="tech-stack">
            <span class="tech-tag">Vue 3</span>
            <span class="tech-tag">Vite</span>
            <span class="tech-tag">Element Plus</span>
            <span class="tech-tag">Vant</span>
            <span class="tech-tag">SCSS</span>
            <span class="tech-tag">GSAP</span>
          </div>
        </section>

        <section class="about-section">
          <h2>联系我们</h2>
          <div class="contact-links">
            <a
              href="https://github.com/IT-NuanxinPro/wallpaper-gallery"
              target="_blank"
              rel="noopener noreferrer"
              class="contact-link"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </section>

        <section class="about-section">
          <h2>开发者工具</h2>
          <p>以下是一些开发和测试工具，用于验证应用的各项功能。</p>
          <div class="dev-tools">
            <router-link to="/yimen-demo" class="dev-tool-link dev-tool-link--featured">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M12 18h.01" />
              </svg>
              <div class="dev-tool-info">
                <h3>🚀 一门云 App 功能测试</h3>
                <p>测试原生下载功能、图片保存到相册、文件系统操作等 App 专属能力</p>
                <div class="dev-tool-badge">
                  App 专用
                </div>
              </div>
            </router-link>
          </div>
        </section>

        <div class="about-actions">
          <button class="btn btn--primary" @click="goHome">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            返回首页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.about-page {
  padding: $spacing-2xl 0;
  min-height: calc(100vh - $header-height - 200px);
}

.about-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 $spacing-lg;
}

.about-title {
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
  text-align: center;
  margin-bottom: $spacing-2xl;

  @include mobile-only {
    font-size: $font-size-xl;
  }
}

.about-section {
  margin-bottom: $spacing-xl;
  padding: $spacing-lg;
  background: var(--color-bg-secondary);
  border-radius: $radius-lg;
  border: 1px solid var(--color-border);

  h2 {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: var(--color-text-primary);
    margin-bottom: $spacing-md;
  }

  p {
    font-size: $font-size-md;
    color: var(--color-text-secondary);
    line-height: 1.8;
  }
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm 0;
    color: var(--color-text-secondary);

    svg {
      width: 20px;
      height: 20px;
      color: var(--color-accent);
      flex-shrink: 0;
    }
  }
}

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.tech-tag {
  display: inline-block;
  padding: $spacing-xs $spacing-md;
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: $radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
}

.contact-links {
  display: flex;
  gap: $spacing-md;
}

.contact-link {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background: var(--color-bg-hover);
  border-radius: $radius-md;
  color: var(--color-text-primary);
  text-decoration: none;
  transition: all 0.2s ease;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: var(--color-accent);
    color: white;
  }
}

.dev-tools {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  margin-top: $spacing-md;
}

.dev-tool-link {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-md;
  background: var(--color-bg-hover);
  border-radius: $radius-md;
  color: var(--color-text-primary);
  text-decoration: none;
  transition: all 0.2s ease;
  border: 1px solid var(--color-border);

  svg {
    width: 24px;
    height: 24px;
    color: var(--color-accent);
    flex-shrink: 0;
  }

  .dev-tool-info {
    flex: 1;

    h3 {
      font-size: $font-size-md;
      font-weight: $font-weight-semibold;
      color: var(--color-text-primary);
      margin-bottom: $spacing-xs;
    }

    p {
      font-size: $font-size-sm;
      color: var(--color-text-secondary);
      margin: 0 0 $spacing-xs 0;
    }

    .dev-tool-badge {
      display: inline-block;
      padding: 2px 8px;
      background: var(--color-accent);
      color: white;
      border-radius: $radius-full;
      font-size: 11px;
      font-weight: $font-weight-medium;
    }
  }

  &:hover {
    background: var(--color-accent-light);
    border-color: var(--color-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
  }

  &--featured {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
    border: 2px solid var(--color-accent);

    svg {
      color: var(--color-accent);
      animation: pulse 2s infinite;
    }

    .dev-tool-info h3 {
      color: var(--color-accent);
    }

    &:hover {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.25);
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.about-actions {
  display: flex;
  justify-content: center;
  margin-top: $spacing-2xl;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-xl;
  border-radius: $radius-md;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  cursor: pointer;
  transition: all 0.2s ease;

  svg {
    width: 20px;
    height: 20px;
  }

  &--primary {
    background: var(--color-accent);
    color: white;

    &:hover {
      background: var(--color-accent-hover);
      transform: translateY(-2px);
    }
  }
}
</style>
