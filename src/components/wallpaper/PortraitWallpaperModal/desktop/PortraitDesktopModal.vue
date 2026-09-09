<script setup>
/**
 * PC端手机壁纸弹窗 - 左右布局
 * 左侧：iPhone 14 Pro 真机预览（带灵动岛动画）
 * 右侧：壁纸信息和操作
 */
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import LoadingSpinner from '@/components/common/feedback/LoadingSpinner.vue'
import WallpaperCardActions from '@/components/wallpaper/card/shared/WallpaperCardActions.vue'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { usePopularityStore } from '@/stores/popularity'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/common/analytics'
import { copyText } from '@/utils/common/clipboard'
import { buildRawImageUrl, buildWallpaperDownloadFilename, downloadFile, formatDate, formatFileSize, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/common/format'
import { recordDownload, recordView } from '@/utils/integrations/supabase'
import { resolveWallpaperSeries } from '@/utils/wallpaper/identity'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: null,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
  liked: {
    type: Boolean,
    default: false,
  },
  collected: {
    type: Boolean,
    default: false,
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  collectCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['close', 'toggleLike', 'toggleCollect'])

const { currentSeries } = useWallpaperType()
const effectiveSeries = computed(() => resolveWallpaperSeries(props.wallpaper, currentSeries.value))
const popularityStore = usePopularityStore()

// 状态
const isVisible = ref(false)
const imageLoaded = ref(false)
const downloading = ref(false)
const imageDimensions = ref({ width: 0, height: 0 })
const fallbackStage = ref('none')

// 统计数据（从 popularityStore 获取，支持乐观更新）
const downloadCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getDownloadCount(props.wallpaper.filename)
})

const viewCount = computed(() => {
  if (!props.wallpaper)
    return 0
  return popularityStore.getViewCount(props.wallpaper.filename)
})

// 时钟
const timeDigits = ref(['0', '0', '0', '0'])
let timeTimer = null

// 灵动岛动画
const islandExpanded = ref(false)
let islandTimer = null

// 悬浮状态
const isHovered = ref(false)

function updateTime() {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  timeDigits.value = [hours[0], hours[1], minutes[0], minutes[1]]
}

// 自动展示灵动岛动画
function autoExpandIsland() {
  if (!isVisible.value)
    return
  islandExpanded.value = true
  setTimeout(() => {
    islandExpanded.value = false
  }, 3500)
}

// 计算属性 - 优先使用 AI 生成的 displayTitle
const displayFilename = computed(() => {
  if (!props.wallpaper)
    return ''

  // 优先使用 AI 生成的显示标题
  if (props.wallpaper.displayTitle) {
    // 去除常见的图片格式后缀名
    return props.wallpaper.displayTitle.replace(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|tif|ico|heic|heif)$/i, '')
  }

  // 回退到处理过的文件名
  return getDisplayFilename(props.wallpaper.filename)
})

// AI 标签（显示前3个关键词）
const aiTags = computed(() => {
  if (!props.wallpaper?.keywords || !Array.isArray(props.wallpaper.keywords)) {
    return []
  }
  return props.wallpaper.keywords.slice(0, 3)
})

const categoryDisplay = computed(() => {
  if (!props.wallpaper?.category)
    return ''
  const { category, subcategory } = props.wallpaper
  return subcategory ? `${category} / ${subcategory}` : category
})

const resolution = computed(() => {
  if (props.wallpaper?.resolution)
    return props.wallpaper.resolution
  if (imageDimensions.value.width > 0)
    return getResolutionLabel(imageDimensions.value.width, imageDimensions.value.height)
  return { label: '加载中', type: 'secondary' }
})

const fileExt = computed(() =>
  props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '',
)

const formattedSize = computed(() =>
  props.wallpaper ? formatFileSize(props.wallpaper.size) : '',
)

const formattedDate = computed(() =>
  props.wallpaper ? formatDate(props.wallpaper.createdAt) : '',
)

// 优化的图片 URL（使用 webp 预览图）
const optimizedImageUrl = computed(() => {
  if (!props.wallpaper?.url)
    return ''

  if (fallbackStage.value === 'raw')
    return buildRawImageUrl(props.wallpaper.url)

  return props.wallpaper.url
})

// 监听
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.wallpaper) {
    handleOpen()
  }
  else if (!isOpen && isVisible.value) {
    handleClose()
  }
}, { immediate: true })

watch(() => props.wallpaper, () => {
  fallbackStage.value = 'none'
  resetState()
  // 统计数据现在是 computed，从 popularityStore 自动获取
})

function handleOpen() {
  trackWallpaperPreview(props.wallpaper)
  recordView(props.wallpaper, effectiveSeries.value)

  // 滚动锁定由父组件处理，这里只需要显示弹窗
  isVisible.value = true

  // 启动时钟更新（仅在弹窗打开时运行）
  updateTime()
  if (timeTimer)
    clearInterval(timeTimer)
  timeTimer = setInterval(updateTime, 1000)

  // 延迟启动灵动岛动画
  setTimeout(autoExpandIsland, 1500)
  islandTimer = setInterval(autoExpandIsland, 8000)
}

function handleClose() {
  isVisible.value = false
  // 清理所有定时器
  if (timeTimer) {
    clearInterval(timeTimer)
    timeTimer = null
  }
  if (islandTimer) {
    clearInterval(islandTimer)
    islandTimer = null
  }
}

function onModalAfterLeave() {
  // 滚动恢复由父组件处理，这里只需要通知关闭
  emit('close')
}

async function handleDownload() {
  if (!props.wallpaper || downloading.value)
    return

  downloading.value = true
  try {
    await downloadFile(props.wallpaper.url, buildWallpaperDownloadFilename(props.wallpaper))
    trackWallpaperDownload(props.wallpaper, effectiveSeries.value)
    recordDownload(props.wallpaper, effectiveSeries.value)
  }
  finally {
    downloading.value = false
  }
}

async function handleCopyUrl() {
  const url = props.wallpaper?.url
  if (!url)
    return

  try {
    await copyText(url)
    ElMessage.success('链接已复制')
  }
  catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

function handleImageLoad(e) {
  imageLoaded.value = true
  imageDimensions.value = {
    width: e.target.naturalWidth,
    height: e.target.naturalHeight,
  }
}

function handleImageError() {
  if (fallbackStage.value === 'none') {
    fallbackStage.value = 'raw'
    imageLoaded.value = false
  }
}

function resetState() {
  imageLoaded.value = false
  imageDimensions.value = { width: 0, height: 0 }
  // 统计数据现在是 computed，无需手动重置
  islandExpanded.value = false
}

onMounted(() => {
  // 注意：时钟定时器在 handleOpen 中启动，避免组件挂载但弹窗未打开时浪费资源
})

onUnmounted(() => {
  if (timeTimer)
    clearInterval(timeTimer)
  if (islandTimer)
    clearInterval(islandTimer)
})
</script>
