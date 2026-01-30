<script setup>
import { onMounted, ref, watch } from 'vue'
import DownloadButton from '@/components/common/DownloadButton.vue'
import { useYimenApp } from '@/composables/useYimenApp'
import { checkAgreementStatus, checkStoragePermission, deleteDownloadedWallpaper, downloadImageToAppDir, exitApp, fileExists, getDeviceInfo, getDownloadedWallpapers, getFileSize, isYimenApp, onAgreementChange, openAppSettings, requestPermissions, saveImageToAlbum, setAgreementStatus, showAgreement, showToast, showUserAgreement, showUserPrivacy } from '@/utils/yimenBridge'

const { inApp, isAppEnvironment, isBridgeReady, isLoading } = useYimenApp()

const deviceInfo = ref(null)
const hasStoragePermission = ref(false)
const testResults = ref([])
const downloadedFiles = ref([])
const selectedDownloadMode = ref('album')
const agreementStatus = ref(false)

// 测试壁纸数据
const testWallpaper = {
  id: 'test-001',
  filename: '测试壁纸.jpg',
  url: 'https://cdn.jsdelivr.net/gh/IT-NuanxinPro/nuanXinProPic@v1.1.57/preview/desktop/政治/通用/任务栏设计-励志标语.webp',
  category: '动漫',
  subcategory: '刀剑神域',
}

function addTestResult(test, result, details = '') {
  testResults.value.push({
    test,
    result,
    details,
    timestamp: new Date().toLocaleTimeString(),
  })
}

// 测试基础环境检测
async function testEnvironment() {
  addTestResult('环境检测', isYimenApp() ? '✅ 一门云 App 环境' : '❌ 浏览器环境')
  addTestResult('Bridge 状态', isBridgeReady.value ? '✅ Bridge 已就绪' : '❌ Bridge 未就绪')
}

// 测试设备信息获取
async function testDeviceInfo() {
  try {
    const info = await getDeviceInfo()
    if (info) {
      deviceInfo.value = info
      addTestResult('设备信息', '✅ 获取成功', JSON.stringify(info, null, 2))
    }
    else {
      addTestResult('设备信息', '❌ 获取失败')
    }
  }
  catch (error) {
    addTestResult('设备信息', '❌ 获取异常', error.message)
  }
}

// 测试权限检查
async function testPermissionCheck() {
  try {
    const hasPermission = await checkStoragePermission()
    hasStoragePermission.value = hasPermission
    addTestResult('存储权限检查', hasPermission ? '✅ 已授权' : '❌ 未授权')
  }
  catch (error) {
    addTestResult('存储权限检查', '❌ 检查异常', error.message)
  }
}

// 测试权限请求
async function testPermissionRequest() {
  try {
    const result = await requestPermissions(['WRITE_EXTERNAL_STORAGE'])
    addTestResult('权限请求', result.granted ? '✅ 授权成功' : '❌ 授权失败', JSON.stringify(result))

    // 重新检查权限状态
    await testPermissionCheck()
  }
  catch (error) {
    addTestResult('权限请求', '❌ 请求异常', error.message)
  }
}

// 测试 Toast 显示
async function testToast() {
  try {
    await showToast('这是一个测试 Toast 消息')
    addTestResult('Toast 显示', '✅ 显示成功')
  }
  catch (error) {
    addTestResult('Toast 显示', '❌ 显示异常', error.message)
  }
}

// 测试图片保存到相册
async function testImageSaveToAlbum() {
  try {
    const result = await saveImageToAlbum(testWallpaper.url, testWallpaper.filename)
    addTestResult('保存到相册', result.success ? '✅ 保存成功' : '❌ 保存失败', result.message)
  }
  catch (error) {
    addTestResult('保存到相册', '❌ 保存异常', error.message)
  }
}

// 测试图片下载到应用目录
async function testImageDownloadToApp() {
  try {
    const result = await downloadImageToAppDir(testWallpaper.url, testWallpaper.filename)
    addTestResult('下载到应用目录', result.success ? '✅ 下载成功' : '❌ 下载失败', result.message)
    if (result.success) {
      await refreshDownloadedFiles()
    }
  }
  catch (error) {
    addTestResult('下载到应用目录', '❌ 下载异常', error.message)
  }
}

// 测试获取下载的文件列表
async function testGetDownloadedFiles() {
  try {
    const result = await getDownloadedWallpapers()
    downloadedFiles.value = result.files || []
    addTestResult('获取文件列表', result.success ? '✅ 获取成功' : '❌ 获取失败', result.success ? `找到 ${result.files.length} 个文件` : result.message)
  }
  catch (error) {
    addTestResult('获取文件列表', '❌ 获取异常', error.message)
  }
}

// 测试文件是否存在
async function testFileExists() {
  try {
    const exists = await fileExists(testWallpaper.filename)
    addTestResult('文件存在检查', exists ? '✅ 文件存在' : '❌ 文件不存在')
  }
  catch (error) {
    addTestResult('文件存在检查', '❌ 检查异常', error.message)
  }
}

// 测试获取文件大小
async function testGetFileSize() {
  try {
    const result = await getFileSize(testWallpaper.filename)
    addTestResult('获取文件大小', result.success ? '✅ 获取成功' : '❌ 获取失败', result.success ? `文件大小: ${(result.size / 1024).toFixed(2)} KB` : result.message)
  }
  catch (error) {
    addTestResult('获取文件大小', '❌ 获取异常', error.message)
  }
}

// 测试删除文件
async function testDeleteFile() {
  try {
    const result = await deleteDownloadedWallpaper(testWallpaper.filename)
    addTestResult('删除文件', result.success ? '✅ 删除成功' : '❌ 删除失败', result.message)
    if (result.success) {
      await refreshDownloadedFiles()
    }
  }
  catch (error) {
    addTestResult('删除文件', '❌ 删除异常', error.message)
  }
}

// 刷新下载的文件列表
async function refreshDownloadedFiles() {
  const result = await getDownloadedWallpapers()
  downloadedFiles.value = result.files || []
}

// ========================================
// 隐私协议相关测试
// ========================================

// 测试检查协议状态
async function testCheckAgreementStatus() {
  try {
    const agreed = await checkAgreementStatus()
    agreementStatus.value = agreed
    addTestResult('检查协议状态', agreed ? '✅ 已同意' : '❌ 未同意')
  }
  catch (error) {
    addTestResult('检查协议状态', '❌ 检查异常', error.message)
  }
}

// 测试显示协议弹窗
async function testShowAgreement() {
  try {
    const agreed = await showAgreement()
    agreementStatus.value = agreed
    addTestResult('显示协议弹窗', agreed ? '✅ 用户同意' : '❌ 用户拒绝')
  }
  catch (error) {
    addTestResult('显示协议弹窗', '❌ 显示异常', error.message)
  }
}

// 测试显示用户协议
async function testShowUserAgreement() {
  try {
    await showUserAgreement()
    addTestResult('显示用户协议', '✅ 显示成功')
  }
  catch (error) {
    addTestResult('显示用户协议', '❌ 显示异常', error.message)
  }
}

// 测试显示隐私政策
async function testShowUserPrivacy() {
  try {
    await showUserPrivacy()
    addTestResult('显示隐私政策', '✅ 显示成功')
  }
  catch (error) {
    addTestResult('显示隐私政策', '❌ 显示异常', error.message)
  }
}

// 测试设置协议状态为同意
async function testSetAgreementStatusTrue() {
  try {
    const success = await setAgreementStatus(true)
    if (success) {
      agreementStatus.value = true
      addTestResult('设置协议状态(同意)', '✅ 设置成功')
    }
    else {
      addTestResult('设置协议状态(同意)', '❌ 设置失败')
    }
  }
  catch (error) {
    addTestResult('设置协议状态(同意)', '❌ 设置异常', error.message)
  }
}

// 测试设置协议状态为拒绝
async function testSetAgreementStatusFalse() {
  try {
    const success = await setAgreementStatus(false)
    if (success) {
      agreementStatus.value = false
      addTestResult('设置协议状态(拒绝)', '✅ 设置成功')
    }
    else {
      addTestResult('设置协议状态(拒绝)', '❌ 设置失败')
    }
  }
  catch (error) {
    addTestResult('设置协议状态(拒绝)', '❌ 设置异常', error.message)
  }
}

// 测试监听协议变化
async function testOnAgreementChange() {
  try {
    await onAgreementChange((agreed) => {
      agreementStatus.value = agreed
      addTestResult('协议状态变化', agreed ? '✅ 用户同意' : '❌ 用户拒绝')
    })
    addTestResult('监听协议变化', '✅ 监听已设置')
  }
  catch (error) {
    addTestResult('监听协议变化', '❌ 设置异常', error.message)
  }
}

// 测试退出应用
async function testExitApp() {
  try {
    // eslint-disable-next-line no-alert
    const shouldExit = confirm('确定要退出应用吗？这将关闭 App')
    if (shouldExit) {
      await exitApp()
      addTestResult('退出应用', '✅ 退出成功')
    }
    else {
      addTestResult('退出应用', '❌ 用户取消')
    }
  }
  catch (error) {
    addTestResult('退出应用', '❌ 退出异常', error.message)
  }
}

// 测试打开设置
async function testOpenSettings() {
  try {
    await openAppSettings()
    addTestResult('打开设置', '✅ 调用成功')
  }
  catch (error) {
    addTestResult('打开设置', '❌ 调用异常', error.message)
  }
}

// 清空测试结果
function clearResults() {
  testResults.value = []
}

// 运行所有测试
async function runAllTests() {
  clearResults()

  await testEnvironment()
  await testDeviceInfo()
  await testPermissionCheck()
  await testToast()

  // 只在 App 环境中测试需要权限的功能
  if (inApp.value) {
    // 先检查协议状态
    await testCheckAgreementStatus()

    if (!hasStoragePermission.value) {
      await testPermissionRequest()
    }
    await testImageSaveToAlbum()
    await testImageDownloadToApp()
    await testGetDownloadedFiles()
    await testFileExists()
    await testGetFileSize()

    // 设置协议监听
    await testOnAgreementChange()
  }
}

onMounted(() => {
  // 等待 App 检测完成后自动运行测试
  const unwatch = watch(() => isLoading.value, (loading) => {
    if (!loading) {
      runAllTests()
      unwatch()
    }
  }, { immediate: true })
})
</script>

<template>
  <div class="yimen-demo">
    <div class="demo-container">
      <!-- 标题 -->
      <div class="demo-header">
        <h1>一门云 JS Bridge 测试</h1>
        <p class="demo-desc">
          测试一门云 App 环境下的原生功能集成
        </p>
      </div>

      <!-- 环境状态 -->
      <div class="status-section">
        <h2>环境状态</h2>
        <div class="status-grid">
          <div class="status-card">
            <div class="status-icon" :class="{ active: isAppEnvironment }">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M12 18h.01" />
              </svg>
            </div>
            <div class="status-info">
              <h3>App 环境</h3>
              <p>{{ isAppEnvironment ? '一门云 App' : '浏览器环境' }}</p>
            </div>
          </div>

          <div class="status-card">
            <div class="status-icon" :class="{ active: isBridgeReady }">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div class="status-info">
              <h3>JS Bridge</h3>
              <p>{{ isBridgeReady ? '已就绪' : '未就绪' }}</p>
            </div>
          </div>

          <div class="status-card">
            <div class="status-icon" :class="{ active: hasStoragePermission }">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4" />
                <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" />
                <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" />
              </svg>
            </div>
            <div class="status-info">
              <h3>存储权限</h3>
              <p>{{ hasStoragePermission ? '已授权' : '未授权' }}</p>
            </div>
          </div>

          <div class="status-card">
            <div class="status-icon" :class="{ active: agreementStatus }">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>
            <div class="status-info">
              <h3>隐私协议</h3>
              <p>{{ agreementStatus ? '已同意' : '未同意' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 功能测试 -->
      <div class="test-section">
        <h2>功能测试</h2>
        <div class="test-buttons">
          <button class="test-btn" @click="runAllTests">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            运行所有测试
          </button>

          <button class="test-btn" @click="testEnvironment">
            环境检测
          </button>
          <button class="test-btn" @click="testDeviceInfo">
            设备信息
          </button>
          <button class="test-btn" @click="testPermissionCheck">
            权限检查
          </button>
          <button class="test-btn" @click="testPermissionRequest">
            请求权限
          </button>
          <button class="test-btn" @click="testToast">
            显示 Toast
          </button>
          <button class="test-btn" @click="testImageSaveToAlbum">
            保存到相册
          </button>
          <button class="test-btn" @click="testImageDownloadToApp">
            下载到应用
          </button>
          <button class="test-btn" @click="testGetDownloadedFiles">
            获取文件列表
          </button>
          <button class="test-btn" @click="testFileExists">
            文件存在检查
          </button>
          <button class="test-btn" @click="testGetFileSize">
            获取文件大小
          </button>
          <button class="test-btn" @click="testDeleteFile">
            删除文件
          </button>
          <button class="test-btn" @click="testOpenSettings">
            打开设置
          </button>

          <!-- 隐私协议相关测试 -->
          <div class="test-divider">
            隐私协议测试
          </div>
          <button class="test-btn" @click="testCheckAgreementStatus">
            检查协议状态
          </button>
          <button class="test-btn" @click="testShowAgreement">
            显示协议弹窗
          </button>
          <button class="test-btn" @click="testShowUserAgreement">
            显示用户协议
          </button>
          <button class="test-btn" @click="testShowUserPrivacy">
            显示隐私政策
          </button>
          <button class="test-btn test-btn--success" @click="testSetAgreementStatusTrue">
            设置协议(同意)
          </button>
          <button class="test-btn test-btn--warning" @click="testSetAgreementStatusFalse">
            设置协议(拒绝)
          </button>
          <button class="test-btn" @click="testOnAgreementChange">
            监听协议变化
          </button>
          <button class="test-btn test-btn--danger" @click="testExitApp">
            退出应用
          </button>

          <div class="test-divider">
            其他操作
          </div>
          <button class="test-btn test-btn--danger" @click="clearResults">
            清空结果
          </button>
        </div>
      </div>

      <!-- 下载按钮测试 -->
      <div class="download-section">
        <h2>下载按钮测试</h2>

        <!-- 下载模式选择 -->
        <div class="download-mode-selector">
          <label>下载模式：</label>
          <select v-model="selectedDownloadMode" class="mode-select">
            <option value="album">
              保存到相册
            </option>
            <option value="app">
              下载到应用目录
            </option>
            <option value="both">
              同时保存
            </option>
          </select>
        </div>

        <div class="download-demo">
          <div class="wallpaper-preview">
            <img :src="testWallpaper.url" :alt="testWallpaper.filename">
            <div class="wallpaper-info">
              <h3>{{ testWallpaper.filename }}</h3>
              <p>{{ testWallpaper.category }} / {{ testWallpaper.subcategory }}</p>
            </div>
          </div>

          <div class="download-buttons">
            <DownloadButton
              :wallpaper="testWallpaper"
              :download-mode="selectedDownloadMode"
              size="lg"
              variant="primary"
              @download-start="() => addTestResult('下载按钮', '🔄 开始下载')"
              @download-success="() => { addTestResult('下载按钮', '✅ 下载成功'); refreshDownloadedFiles() }"
              @download-error="(error) => addTestResult('下载按钮', '❌ 下载失败', error.message)"
            />
          </div>
        </div>
      </div>

      <!-- 已下载文件列表 -->
      <div v-if="inApp && downloadedFiles.length > 0" class="files-section">
        <h2>已下载文件 ({{ downloadedFiles.length }})</h2>
        <div class="files-list">
          <div
            v-for="file in downloadedFiles"
            :key="file"
            class="file-item"
          >
            <div class="file-info">
              <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21,15 16,10 5,21" />
              </svg>
              <span class="file-name">{{ file }}</span>
            </div>
            <button
              class="delete-btn"
              title="删除文件"
              @click="() => { deleteDownloadedWallpaper(file); refreshDownloadedFiles() }"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6" />
                <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 设备信息 -->
      <div v-if="deviceInfo" class="device-section">
        <h2>设备信息</h2>
        <pre class="device-info">{{ JSON.stringify(deviceInfo, null, 2) }}</pre>
      </div>

      <!-- 测试结果 -->
      <div class="results-section">
        <h2>测试结果</h2>
        <div v-if="testResults.length === 0" class="no-results">
          暂无测试结果，点击上方按钮开始测试
        </div>
        <div v-else class="results-list">
          <div
            v-for="(result, index) in testResults"
            :key="index"
            class="result-item"
          >
            <div class="result-header">
              <span class="result-test">{{ result.test }}</span>
              <span class="result-status">{{ result.result }}</span>
              <span class="result-time">{{ result.timestamp }}</span>
            </div>
            <div v-if="result.details" class="result-details">
              <pre>{{ result.details }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.yimen-demo {
  min-height: 100vh;
  background: var(--color-bg-primary);
  padding: 20px;
}

.demo-container {
  max-width: 800px;
  margin: 0 auto;
}

.demo-header {
  text-align: center;
  margin-bottom: 32px;

  h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }

  .demo-desc {
    color: var(--color-text-secondary);
    font-size: 16px;
  }
}

.status-section,
.test-section,
.download-section,
.device-section,
.results-section {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 16px;
  }
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.status-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);

  svg {
    width: 20px;
    height: 20px;
  }

  &.active {
    background: var(--color-accent);
    color: white;
  }
}

.status-info {
  h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 2px;
  }

  p {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
}

.test-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.test-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
  }

  &--danger {
    color: #dc3545;
    border-color: #dc3545;

    &:hover {
      background: #dc3545;
      color: white;
    }
  }
}

.download-demo {
  display: flex;
  gap: 24px;
  align-items: center;

  @media (max-width: 640px) {
    flex-direction: column;
  }
}

.wallpaper-preview {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;

  img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: var(--radius-md);
  }

  .wallpaper-info {
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 4px;
    }

    p {
      font-size: 14px;
      color: var(--color-text-secondary);
    }
  }
}

.download-buttons {
  flex-shrink: 0;
}

.device-info {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow-x: auto;
}

.no-results {
  text-align: center;
  color: var(--color-text-muted);
  padding: 32px;
  font-style: italic;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;

  .result-test {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .result-status {
    font-family: monospace;
    font-size: 14px;
  }

  .result-time {
    margin-left: auto;
    font-size: 12px;
    color: var(--color-text-muted);
  }
}

.result-details {
  pre {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-size: 11px;
    color: var(--color-text-secondary);
    overflow-x: auto;
    white-space: pre-wrap;
  }
}

.download-mode-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;

  label {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .mode-select {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 14px;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: var(--color-accent);
    }
  }
}

.files-section {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 16px;
  }
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);

  .file-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .file-icon {
      width: 20px;
      height: 20px;
      color: var(--color-accent);
      flex-shrink: 0;
    }

    .file-name {
      font-size: 14px;
      color: var(--color-text-primary);
      word-break: break-all;
    }
  }

  .delete-btn {
    padding: 6px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background: #dc3545;
      border-color: #dc3545;
      color: white;
    }
  }
}

.test-divider {
  width: 100%;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 8px 0;
  border-top: 1px solid var(--color-border);
  margin-top: 8px;
}

.test-btn {
  &--success {
    color: #28a745;
    border-color: #28a745;

    &:hover {
      background: #28a745;
      color: white;
    }
  }

  &--warning {
    color: #ffc107;
    border-color: #ffc107;

    &:hover {
      background: #ffc107;
      color: #212529;
    }
  }
}
</style>
