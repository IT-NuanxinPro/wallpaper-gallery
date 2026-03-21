<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const heroMetrics = [
  {
    value: '4',
    label: '内容系列',
  },
  {
    value: '2019',
    label: 'Bing 归档起点',
  },
  {
    value: 'Vue 3',
    label: '核心框架',
  },
  {
    value: 'MIT',
    label: '开源协议',
  },
]

const highlights = [
  {
    code: '4X',
    title: '四大内容系列',
    text: '电脑壁纸、手机壁纸、头像与每日 Bing 分开维护，不同设备直接进入对应内容场景。',
  },
  {
    code: 'SR',
    title: '搜索链路完整',
    text: '支持模糊搜索、搜索建议、关键词高亮与精确命中，兼容旧文件名与 displayTitle。',
  },
  {
    code: 'CP',
    title: '裁剪与制作',
    text: '电脑壁纸支持智能裁剪，头像支持上传、圆角与尺寸控制，形成可直接导出的制作链路。',
  },
  {
    code: 'DV',
    title: '多端分别实现',
    text: 'PC 与移动端不是单纯缩放同一页面，而是分别处理布局、弹层、手势与浏览逻辑。',
  },
  {
    code: 'BG',
    title: 'Bing 长线归档',
    text: '每日 Bing 壁纸从 2019 年开始持续归档，按年份分片加载，兼顾内容规模和访问效率。',
  },
  {
    code: 'AN',
    title: '动效与浏览体验',
    text: '视图切换、真机预览、弹层进入等交互由 GSAP 驱动，重点做流畅度和节奏控制。',
  },
]

const seriesCards = [
  {
    badge: 'PC',
    title: '电脑壁纸',
    text: '支持分辨率筛选、多视图切换、今日精选与横屏裁剪预览。',
  },
  {
    badge: 'MB',
    title: '手机壁纸',
    text: '面向竖屏内容流，适配移动端弹层、真机模式与切换手势。',
  },
  {
    badge: 'AV',
    title: '头像',
    text: '包含头像浏览与头像制作，兼顾素材查找和个性化输出。',
  },
  {
    badge: 'BN',
    title: '每日 Bing',
    text: '按年组织历史壁纸，保留大图浏览与下载能力，适合沉浸式回看。',
  },
]

const techCards = [
  {
    badge: 'FE',
    title: '前端基础',
    text: 'Vue 3、Vite、Vue Router、Pinia 组成主框架，保持页面组织清晰与状态响应一致。',
  },
  {
    badge: 'UI',
    title: '界面与交互',
    text: 'PC 端使用 Element Plus，移动端使用 Vant，动画与转场由 GSAP 衔接。',
  },
  {
    badge: 'OP',
    title: '交付与分发',
    text: 'Cloudflare Pages、GitHub Actions、CDN 缓存与 Brotli 压缩共同承担部署性能。',
  },
]

const projectNotes = [
  '搜索、筛选、预览、下载不是分散功能，而是围绕找图效率串成完整使用路径。',
  '项目已经开源，Fork 后同步数据即可启动，统计能力可按需接入 Supabase。',
  '目录整理与同类能力归档会持续推进，目标是让功能扩展和后续重构都更稳。',
]

const projectFacts = [
  {
    label: '内容组织',
    value: '按系列与分类拆分数据，兼顾查找效率和后续维护。',
  },
  {
    label: '性能策略',
    value: '分片加载、代码分包、Brotli 压缩与 CDN 缓存同时生效。',
  },
  {
    label: '工程化',
    value: 'GitHub Actions 负责同步、构建和部署，保持开源项目可持续迭代。',
  },
]

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="about-page">
    <div class="about-page__mesh" />

    <div class="container about-shell">
      <section class="hero-card reveal reveal--0">
        <div class="hero-card__main">
          <span class="hero-card__chip">Open Source Wallpaper Project</span>
          <h1 class="hero-card__title">
            Wallpaper Gallery
          </h1>
          <p class="hero-card__summary">
            一个已经开源的高清壁纸项目，围绕四大内容系列，把搜索、筛选、预览、裁剪、下载和多端浏览做成统一体验，而不是单纯堆图片。
          </p>

          <div class="hero-card__actions">
            <button class="about-button about-button--primary" @click="goHome">
              返回首页
            </button>
            <a
              class="about-button about-button--ghost"
              href="https://github.com/IT-NuanxinPro/wallpaper-gallery"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              class="about-button about-button--ghost"
              href="https://wallpaper-gallery-architecture.061129.xyz/"
              target="_blank"
              rel="noopener noreferrer"
            >
              架构页
            </a>
          </div>
        </div>

        <div class="hero-card__aside">
          <div class="metric-grid">
            <div
              v-for="item in heroMetrics"
              :key="item.label"
              class="metric-item"
            >
              <strong>{{ item.value }}</strong>
              <span>{{ item.label }}</span>
            </div>
          </div>

          <div class="snapshot-card">
            <div class="snapshot-card__row">
              <span class="snapshot-card__label">定位</span>
              <strong>面向多端的开源壁纸站</strong>
            </div>
            <div class="snapshot-card__row">
              <span class="snapshot-card__label">重点</span>
              <strong>找图效率、浏览体验、项目可维护性</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="content-grid">
        <div class="content-main">
          <div class="card-grid reveal reveal--1">
            <article
              v-for="item in highlights"
              :key="item.title"
              class="info-card info-card--highlight"
            >
              <span class="info-card__badge">{{ item.code }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </article>
          </div>

          <div class="series-grid reveal reveal--2">
            <article
              v-for="item in seriesCards"
              :key="item.title"
              class="info-card info-card--series"
            >
              <span class="info-card__badge info-card__badge--soft">{{ item.badge }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </article>
          </div>
        </div>

        <aside class="content-side reveal reveal--3">
          <article class="side-card">
            <div class="side-card__list">
              <div
                v-for="item in techCards"
                :key="item.title"
                class="tech-item"
              >
                <span class="tech-item__badge">{{ item.badge }}</span>
                <div class="tech-item__body">
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.text }}</p>
                </div>
              </div>
            </div>
          </article>

          <article class="side-card side-card--notes">
            <ul class="note-list">
              <li v-for="item in projectNotes" :key="item">
                {{ item }}
              </li>
            </ul>
          </article>

          <article class="side-card side-card--facts">
            <div
              v-for="item in projectFacts"
              :key="item.label"
              class="fact-item"
            >
              <span class="fact-item__label">{{ item.label }}</span>
              <p>{{ item.value }}</p>
            </div>
          </article>
        </aside>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.about-page {
  position: relative;
  min-height: 100vh;
  padding: clamp(28px, 4vw, 52px) 0 clamp(52px, 7vw, 84px);
  overflow: hidden;

  @include mobile-only {
    padding-top: 24px;
  }

  &__mesh {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 10% 10%, rgba(14, 165, 233, 0.12), transparent 24%),
      radial-gradient(circle at 88% 12%, rgba(59, 130, 246, 0.14), transparent 22%),
      radial-gradient(circle at 50% 100%, rgba(34, 197, 94, 0.1), transparent 30%);
  }
}

.about-shell {
  position: relative;
  z-index: 1;
}

.hero-card,
.info-card,
.side-card,
.snapshot-card {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.76)),
    linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(16, 185, 129, 0.04));
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);

  [data-theme='dark'] & {
    border-color: rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(17, 24, 39, 0.82)),
      linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(34, 197, 94, 0.05));
    box-shadow: 0 24px 56px rgba(0, 0, 0, 0.26);
  }
}

.hero-card {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
  gap: 20px;
  padding: clamp(24px, 3vw, 36px);
  border-radius: 32px;

  @include tablet-only {
    grid-template-columns: 1fr;
  }

  @include mobile-only {
    grid-template-columns: 1fr;
    padding: 20px;
    border-radius: 26px;
  }
}

.hero-card__main {
  min-width: 0;
}

.hero-card__chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: $radius-full;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.08em;
  text-transform: uppercase;

  [data-theme='dark'] & {
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.16);
  }
}

.hero-card__title {
  margin-top: 16px;
  color: var(--color-text-primary);
  font-size: clamp(34px, 5vw, 58px);
  line-height: 0.98;
  letter-spacing: -0.05em;

  @include mobile-only {
    font-size: 34px;
    line-height: 1.04;
  }
}

.hero-card__summary {
  max-width: 44rem;
  margin-top: 18px;
  color: var(--color-text-secondary);
  font-size: clamp(15px, 1.35vw, 18px);
  line-height: 1.85;
}

.hero-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.about-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  border-radius: $radius-full;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: $font-weight-semibold;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;

  &:hover {
    transform: translateY(-1px);
  }

  &--primary {
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #0f766e);
    box-shadow: 0 16px 34px rgba(37, 99, 235, 0.22);
  }

  &--ghost {
    color: var(--color-text-primary);
    border-color: var(--color-border);
    background: rgba(255, 255, 255, 0.42);

    [data-theme='dark'] & {
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.03);
    }
  }
}

.hero-card__aside {
  display: grid;
  gap: 14px;
  align-content: start;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.metric-item {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.24);

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
  }

  strong {
    display: block;
    color: var(--color-text-primary);
    font-size: clamp(22px, 2.4vw, 30px);
    line-height: 1;
    letter-spacing: -0.04em;
  }

  span {
    display: block;
    margin-top: 8px;
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.4;
  }
}

.snapshot-card {
  padding: 18px;
  border-radius: 24px;
}

.snapshot-card__row + .snapshot-card__row {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.snapshot-card__label {
  display: block;
  margin-bottom: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.snapshot-card strong {
  color: var(--color-text-primary);
  font-size: 16px;
  line-height: 1.65;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.8fr);
  gap: 20px;
  align-items: start;
  margin-top: 22px;

  @include tablet-only {
    grid-template-columns: 1fr;
  }

  @include mobile-only {
    grid-template-columns: 1fr;
  }
}

.content-main {
  display: grid;
  gap: 20px;
}

.content-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-grid,
.series-grid {
  display: grid;
  gap: 16px;
}

.card-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @include mobile-only {
    grid-template-columns: 1fr;
  }
}

.series-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @include mobile-only {
    grid-template-columns: 1fr;
  }
}

.info-card,
.side-card {
  border-radius: 28px;
}

.info-card {
  padding: 22px;

  h3 {
    margin-top: 16px;
    color: var(--color-text-primary);
    font-size: 19px;
    line-height: 1.3;
  }

  p {
    margin-top: 10px;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.78;
  }
}

.info-card__badge,
.tech-item__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 42px;
  padding: 0 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(13, 148, 136, 0.14));
  color: #1d4ed8;
  font-size: 13px;
  font-weight: $font-weight-bold;
  letter-spacing: 0.08em;

  [data-theme='dark'] & {
    color: #93c5fd;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(16, 185, 129, 0.14));
  }
}

.info-card__badge--soft {
  color: #0f766e;

  [data-theme='dark'] & {
    color: #6ee7b7;
  }
}

.side-card {
  padding: 20px;
}

.side-card__list {
  display: grid;
  gap: 14px;
}

.tech-item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.22);

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

.tech-item__body {
  strong {
    display: block;
    color: var(--color-text-primary);
    font-size: 16px;
    line-height: 1.3;
  }

  p {
    margin-top: 6px;
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.72;
  }
}

.note-list {
  display: grid;
  gap: 12px;

  li {
    position: relative;
    padding-left: 18px;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.78;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #0f766e);
    }
  }
}

.side-card--facts {
  display: grid;
  gap: 14px;
}

.fact-item {
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.22);

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
  }

  p {
    margin-top: 8px;
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.72;
  }
}

.fact-item__label {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: $radius-full;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: $font-weight-semibold;

  [data-theme='dark'] & {
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.16);
  }
}

.reveal {
  opacity: 0;
  transform: translateY(18px);
  animation: about-fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.reveal--0 {
  animation-delay: 0.02s;
}

.reveal--1 {
  animation-delay: 0.1s;
}

.reveal--2 {
  animation-delay: 0.18s;
}

.reveal--3 {
  animation-delay: 0.26s;
}

@keyframes about-fade-up {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
