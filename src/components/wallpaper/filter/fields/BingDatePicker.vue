<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'all', // 'all' 或 'YYYY-MM' 格式
  },
  // 可选的日期范围
  minDate: {
    type: String,
    default: '2019-06', // Bing 数据最早日期（从 2019 年 6 月开始）
  },
  maxDate: {
    type: String,
    default: null, // 默认为当前月份
  },
})

const emit = defineEmits(['update:modelValue'])

// 内部日期值 (Date 对象)
const internalDateValue = ref(null)

// 初始化和监听外部值变化
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue === 'all' || !newValue) {
      internalDateValue.value = null
    }
    else {
      // 转换 'YYYY-MM' 为 Date
      const [year, month] = newValue.split('-')
      internalDateValue.value = new Date(Number.parseInt(year), Number.parseInt(month) - 1, 1)
    }
  },
  { immediate: true },
)

// 处理日期变化
function handleChange(value) {
  if (!value) {
    emit('update:modelValue', 'all')
  }
  else {
    // value 是 Date 对象
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    emit('update:modelValue', `${year}-${month}`)
  }
}

// 禁用未来月份和范围外的月份
function disabledDate(date) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  const year = date.getFullYear()
  const month = date.getMonth()

  // 禁用未来月份
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    return true
  }

  // 禁用最小日期之前的月份
  if (props.minDate) {
    const [minYear, minMonth] = props.minDate.split('-').map(Number)
    if (year < minYear || (year === minYear && month < minMonth - 1)) {
      return true
    }
  }

  // 禁用最大日期之后的月份
  if (props.maxDate) {
    const [maxYear, maxMonth] = props.maxDate.split('-').map(Number)
    if (year > maxYear || (year === maxYear && month > maxMonth - 1)) {
      return true
    }
  }

  return false
}

// Placeholder 显示
const placeholderText = computed(() => {
  if (props.modelValue === 'all' || !props.modelValue) {
    return '全部月份'
  }
  const [year, month] = props.modelValue.split('-')
  return `${year}年${Number.parseInt(month)}月`
})
</script>

<template>
  <el-date-picker
    v-model="internalDateValue"
    type="month"
    :placeholder="placeholderText"
    :disabled-date="disabledDate"
    :clearable="true"
    size="default"
    style="width: 160px"
    format="YYYY年MM月"
    popper-class="bing-date-picker-popper"
    @change="handleChange"
  />
</template>
