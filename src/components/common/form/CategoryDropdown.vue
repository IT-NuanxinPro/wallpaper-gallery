<script setup>
/**
 * 自定义分类下拉选择器
 * 左右分栏布局，支持一级和二级分类选择
 * 带丝滑动画效果
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
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

const emit = defineEmits(['update:categoryFilter', 'update:subcategoryFilter'])

// 下拉框状态
const isOpen = ref(false)
const dropdownRef = ref(null)

// 当前悬停/预览的一级分类（用于显示二级分类列表）
const hoveredCategory = ref(props.categoryFilter)

// 当前悬停的一级分类的二级分类列表
const currentSubcategories = computed(() => {
  if (hoveredCategory.value === 'all') {
    return []
  }
  const category = props.categoryOptions.find(opt => opt.value === hoveredCategory.value)
  return category?.subcategories || []
})

// 显示文本
const displayText = computed(() => {
  if (props.categoryFilter === 'all') {
    return '全部分类'
  }
  let text = props.categoryFilter
  if (props.subcategoryFilter !== 'all') {
    text += ` · ${props.subcategoryFilter}`
  }
  return text
})

// 是否有选中
const hasSelection = computed(() => props.categoryFilter !== 'all')

// PC 端不需要锁定滚动，下拉框通过 position: absolute 定位
// 移除 lockScroll/unlockScroll，避免与 sticky 定位冲突

// 打开下拉框
function openDropdown() {
  // 打开时，悬停状态设为当前选中的分类
  hoveredCategory.value = props.categoryFilter
  isOpen.value = true
}

// 关闭下拉框
function closeDropdown() {
  isOpen.value = false
}

// 切换下拉框
function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown()
  }
  else {
    openDropdown()
  }
}

// 处理一级分类点击
function handleCategoryClick(option) {
  hoveredCategory.value = option.value

  // 如果没有子分类或选择"全部"，直接确认选择并重置子分类
  if (!option.subcategories?.length || option.value === 'all') {
    emit('update:categoryFilter', option.value)
    emit('update:subcategoryFilter', 'all')
    closeDropdown()
  }
}

// 处理二级分类点击
function handleSubcategoryClick(subcategoryName) {
  // 同时更新父分类和子分类
  emit('update:categoryFilter', hoveredCategory.value)
  emit('update:subcategoryFilter', subcategoryName)
  closeDropdown()
}

// 点击外部关闭
function handleClickOutside(event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    closeDropdown()
  }
}

// 监听 props 变化，同步悬停状态
watch(() => props.categoryFilter, (newVal) => {
  if (!isOpen.value) {
    hoveredCategory.value = newVal
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="category-dropdown">
    <!-- 触发器 -->
    <button
      class="dropdown-trigger"
      :class="{ 'is-open': isOpen, 'has-selection': hasSelection }"
      @click="toggleDropdown"
    >
      <span class="trigger-text">{{ displayText }}</span>
      <svg class="trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <!-- 下拉面板 -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-panel" :class="{ 'single-column': currentSubcategories.length === 0 }">
        <div class="panel-content">
          <!-- 左侧：一级分类 -->
          <div class="category-list primary-list">
            <div class="list-header">
              分类
            </div>
            <div class="list-items">
              <button
                v-for="option in categoryOptions"
                :key="option.value"
                class="category-item"
                :class="{
                  'is-active': hoveredCategory === option.value,
                  'has-children': option.subcategories?.length > 0,
                }"
                @click="handleCategoryClick(option)"
              >
                <span class="item-label">{{ option.label }}</span>
                <svg
                  v-if="option.subcategories?.length > 0"
                  class="item-arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 右侧：二级分类 -->
          <Transition name="slide-right">
            <div v-if="currentSubcategories.length > 0" class="category-list secondary-list">
              <div class="list-header">
                {{ hoveredCategory }}
              </div>
              <div class="list-items">
                <!-- 全部选项 -->
                <button
                  class="category-item"
                  :class="{ 'is-active': categoryFilter === hoveredCategory && subcategoryFilter === 'all' }"
                  @click="handleSubcategoryClick('all')"
                >
                  <span class="item-label">全部</span>
                </button>
                <!-- 二级分类列表 -->
                <button
                  v-for="sub in currentSubcategories"
                  :key="sub.name"
                  class="category-item"
                  :class="{ 'is-active': categoryFilter === hoveredCategory && subcategoryFilter === sub.name }"
                  @click="handleSubcategoryClick(sub.name)"
                >
                  <span class="item-label">{{ sub.name }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>

    <!-- 遮罩层 -->
    <Transition name="fade">
      <div v-if="isOpen" class="dropdown-overlay" @click="closeDropdown" />
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.category-dropdown {
  position: relative;
  z-index: 100;
}

// 触发器按钮 - 与 Element Plus 风格一致
.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 0 14px;
  width: 160px;
  height: 38px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(255, 255, 255, 0.1);
  }

  &:hover {
    border-color: rgba(102, 126, 234, 0.4);
  }

  &.is-open {
    border-color: rgba(102, 126, 234, 0.6);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);

    .trigger-arrow {
      transform: rotate(180deg);
      color: #667eea;
    }
  }

  &.has-selection {
    color: #667eea;
    font-weight: 500;
  }
}

.trigger-text {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trigger-arrow {
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

// 下拉面板 - 毛玻璃高级感
.dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  overflow: hidden;
  z-index: 1000;
  will-change: transform, opacity;
  contain: layout style;
  width: 400px;

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.95);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: 
      0 10px 40px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  }

  &.single-column {
    width: 200px;

    .primary-list {
      border-right: none;
    }
  }
}

.panel-content {
  display: flex;
  max-height: 380px;
}

// 分类列表 - 毛玻璃风格
.category-list {
  display: flex;
  flex-direction: column;

  &.primary-list {
    width: 180px;
    flex-shrink: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.02);

    [data-theme='dark'] & {
      border-right-color: rgba(255, 255, 255, 0.06);
      background: rgba(0, 0, 0, 0.15);
    }
  }

  &.secondary-list {
    width: 220px;
    flex-shrink: 0;
    background: transparent;
  }
}

.list-header {
  padding: 14px 18px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.06);
  }
}

.list-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(102, 126, 234, 0.2);
    border-radius: 3px;

    &:hover {
      background: rgba(102, 126, 234, 0.3);
    }
  }
}

// 分类项 - 高级感设计
.category-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  color: var(--color-text-secondary);
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: background 200ms cubic-bezier(0.4, 0, 0.2, 1),
              color 200ms cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 2px;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    background: rgba(102, 126, 234, 0.08);
    color: var(--color-text-primary);

    .item-arrow {
      transform: translateX(2px);
      color: #667eea;
    }
  }

  &.is-active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.35);

    .item-count {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .item-arrow {
      color: white;
    }
  }

  &.has-children .item-label {
    flex: 1;
  }
}

.item-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  background: rgba(102, 126, 234, 0.1);
  padding: 3px 10px;
  border-radius: 12px;
  transition: all 200ms;

  [data-theme='dark'] & {
    background: rgba(102, 126, 234, 0.2);
  }
}

.item-arrow {
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

// 遮罩层
.dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: transparent;
}

// ========================================
// 动画效果 - 丝滑无跳动
// ========================================

.dropdown-enter-active {
  animation: dropdownIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-leave-active {
  animation: dropdownOut 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes dropdownIn {
  0% {
    opacity: 0;
    transform: translateY(-8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dropdownOut {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-8px);
  }
}

.slide-right-enter-active {
  animation: slideRightIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-right-leave-active {
  animation: slideRightOut 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideRightIn {
  0% {
    opacity: 0;
    transform: translateX(-12px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideRightOut {
  0% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-12px);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
