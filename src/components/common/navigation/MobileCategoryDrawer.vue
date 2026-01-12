<script setup>
import { computed, nextTick, ref, watch } from 'vue'

import { useScrollLock } from '@/composables/useScrollLock'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  categoryOptions: {
    type: Array,
    default: () => [],
  },
  categoryFilter: {
    type: String,
    default: 'all',
  },
  subcategoryFilter: {
    type: String,
    default: 'all',
  },
})

const emit = defineEmits(['update:show', 'update:categoryFilter', 'update:subcategoryFilter', 'confirm'])

// 临时选中的分类（用于预览，确认后才真正应用）
const tempCategory = ref(props.categoryFilter)
const tempSubcategory = ref(props.subcategoryFilter)

// 使用滚动锁定 composable
const scrollLock = useScrollLock()

// 同步外部值
watch(() => props.show, async (val) => {
  if (val) {
    // 延迟锁定滚动，让动画先开始，避免 position: fixed 导致的重排卡顿
    await nextTick()
    requestAnimationFrame(() => {
      scrollLock.lock()
    })
    // 如果当前是"全部"，默认选中第一个分类
    if (props.categoryFilter === 'all') {
      const firstCategory = props.categoryOptions.find(opt => opt.value !== 'all')
      tempCategory.value = firstCategory ? firstCategory.value : ''
    }
    else {
      tempCategory.value = props.categoryFilter
    }
    tempSubcategory.value = props.subcategoryFilter
  }
  else {
    // 解锁滚动
    scrollLock.unlock()
  }
})

// 当前选中分类的二级分类列表
const currentSubcategories = computed(() => {
  if (tempCategory.value === 'all') {
    return []
  }
  const category = props.categoryOptions.find(opt => opt.value === tempCategory.value)
  return category?.subcategories || []
})

// 是否有二级分类
const hasSubcategories = computed(() => currentSubcategories.value.length > 0)

// 选择一级分类
function selectCategory(value) {
  tempCategory.value = value
  // 切换一级分类时重置二级分类
  tempSubcategory.value = 'all'
}

// 选择二级分类
function selectSubcategory(value) {
  tempSubcategory.value = value
}

// 确认选择
function handleConfirm() {
  emit('update:categoryFilter', tempCategory.value)
  emit('update:subcategoryFilter', tempSubcategory.value)
  emit('confirm')
  closeDrawer()
}

// 重置（清除分类筛选）
function handleReset() {
  emit('update:categoryFilter', 'all')
  emit('update:subcategoryFilter', 'all')
  closeDrawer()
}

// 关闭抽屉
function closeDrawer() {
  emit('update:show', false)
}
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩层 -->
    <Transition name="fade">
      <div v-if="show" class="drawer-overlay" @click="closeDrawer" />
    </Transition>

    <!-- 抽屉内容 -->
    <Transition name="slide-up">
      <div v-if="show" class="category-drawer">
        <!-- 头部 -->
        <div class="drawer-header">
          <button class="header-btn reset-btn" @click="handleReset">
            重置
          </button>
          <span class="header-title">选择分类</span>
          <button class="header-btn close-btn" @click="closeDrawer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 主体：左右分栏 -->
        <div class="drawer-body">
          <!-- 左侧：一级分类列表（排除"全部"选项） -->
          <div class="category-list">
            <div
              v-for="option in categoryOptions.filter(opt => opt.value !== 'all')"
              :key="option.value"
              class="category-item"
              :class="{ 'is-active': tempCategory === option.value }"
              @click="selectCategory(option.value)"
            >
              <span class="category-name">{{ option.label }}</span>
            </div>
          </div>

          <!-- 右侧：二级分类 -->
          <div class="subcategory-panel">
            <template v-if="hasSubcategories">
              <div class="subcategory-header">
                <span>{{ tempCategory }}</span>
              </div>
              <div class="subcategory-grid">
                <!-- 全部选项 -->
                <button
                  class="subcategory-btn"
                  :class="{ 'is-active': tempSubcategory === 'all' }"
                  @click="selectSubcategory('all')"
                >
                  全部
                </button>
                <!-- 二级分类选项 -->
                <button
                  v-for="sub in currentSubcategories"
                  :key="sub.name"
                  class="subcategory-btn"
                  :class="{ 'is-active': tempSubcategory === sub.name }"
                  @click="selectSubcategory(sub.name)"
                >
                  {{ sub.name }}
                </button>
              </div>
            </template>
            <template v-else>
              <div class="no-subcategory">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p>该分类暂无子分类</p>
              </div>
            </template>
          </div>
        </div>

        <!-- 底部确认按钮 -->
        <div class="drawer-footer">
          <button class="confirm-btn" @click="handleConfirm">
            确认选择
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  // 防止触摸穿透
  touch-action: none;
}

.category-drawer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 70vh;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 20px 20px 0 0;
  z-index: 1001;
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.15);
  touch-action: pan-y;
  overscroll-behavior: contain;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.98);
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.header-btn {
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  color: var(--color-text-muted);
  transition: all 250ms;

  &.reset-btn {
    color: #667eea;

    &:active {
      opacity: 0.7;
    }
  }

  &.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;

    [data-theme='dark'] & {
      background: rgba(15, 23, 42, 0.6);
      border-color: rgba(255, 255, 255, 0.08);
    }

    svg {
      width: 18px;
      height: 18px;
    }

    &:active {
      background: rgba(102, 126, 234, 0.15);
      color: #667eea;
    }
  }
}

.drawer-body {
  display: flex;
  min-height: 0;
  overflow: hidden;
}

// 左侧一级分类
.category-list {
  width: 110px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.03);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: calc(70vh - 130px);
  border-right: 1px solid rgba(0, 0, 0, 0.06);

  [data-theme='dark'] & {
    background: rgba(0, 0, 0, 0.2);
    border-right-color: rgba(255, 255, 255, 0.08);
  }
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 14px;
  font-size: 14px;
  color: var(--color-text-secondary);
  border-left: 3px solid transparent;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  &.is-active {
    background: rgba(255, 255, 255, 0.8);
    color: #667eea;
    font-weight: 600;
    border-left-color: #667eea;

    [data-theme='dark'] & {
      background: rgba(102, 126, 234, 0.15);
    }
  }

  &:active {
    background: rgba(102, 126, 234, 0.08);
  }
}

.category-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-count {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-left: 4px;
}

// 右侧二级分类
.subcategory-panel {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: calc(70vh - 130px);
}

.subcategory-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  span {
    color: #667eea;
  }
}

.subcategory-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.subcategory-btn {
  padding: 10px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.8);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &.is-active {
    color: white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    font-weight: 600;
    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
  }

  &:active {
    transform: scale(0.95);
  }

  .sub-count {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-left: 2px;
  }
}

.no-subcategory {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 150px;
  color: var(--color-text-muted);

  svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    opacity: 0.4;
  }

  p {
    font-size: 14px;
  }
}

.drawer-footer {
  padding: 16px 20px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.3);
  background: transparent;

  [data-theme='dark'] & {
    border-top-color: rgba(255, 255, 255, 0.08);
  }
}

.confirm-btn {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
  }
}

// 动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
