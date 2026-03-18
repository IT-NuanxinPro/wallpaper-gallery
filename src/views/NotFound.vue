<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
const goHome = () => router.push('/')
const goBack = () => router.back()
</script>

<template>
  <div class="not-found">
    <div class="content">
      <h1 class="code">
        404
      </h1>
      <p class="msg">
        抱歉，您访问的页面已迷失在画廊中
      </p>
      <div class="actions">
        <button class="btn primary" @click="goHome">
          返回首页
        </button>
        <button class="btn secondary" @click="goBack">
          返回上一页
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.not-found {
  // 占满全屏
  width: 100%;
  height: 100vh;
  height: 100dvh;

  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background-color: var(--color-bg-primary, #f8f9fa);

  .content {
    text-align: center;
    padding: 2rem;
    animation: fadeIn 0.6s ease-out;

    .code {
      font-size: clamp(6rem, 15vw, 10rem);
      font-weight: 800;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
    }

    .msg {
      font-size: 1.2rem;
      color: var(--color-text-secondary, #64748b);
      margin-bottom: 3rem;
    }

    .actions {
      display: flex;
      gap: 1.2rem;
      justify-content: center;

      .btn {
        padding: 0.8rem 2rem;
        border-radius: 50px; // 圆角按钮更符合沉浸式设计
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.3s ease;
        border: none;

        &.primary {
          background-color: var(--color-accent, #6366f1);
          color: white;
          &:hover {
            transform: scale(1.05);
            box-shadow: 0 10px 20px rgba(99, 102, 241, 0.2);
          }
        }

        &.secondary {
          background-color: var(--color-bg-hover, #e2e8f0);
          color: var(--color-text-primary, #1e293b);
          &:hover {
            background-color: var(--color-border, #cbd5e1);
          }
        }
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 480px) {
  .actions {
    flex-direction: column;
    align-items: center;
    .btn {
      width: 200px;
    }
  }
}
</style>
