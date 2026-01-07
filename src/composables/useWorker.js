// ========================================
// Web Worker 管理器
// ========================================

import { ref, shallowRef } from 'vue'
import { decodeData } from '@/utils/codec'
import * as sorting from '@/utils/sorting'

// Worker 实例（单例）
let workerInstance = null
let messageId = 0
const pendingMessages = new Map()

/**
 * 获取或创建 Worker 实例
 */
function getWorker() {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../workers/data-processor.worker.js', import.meta.url),
      { type: 'module' },
    )

    // 处理 Worker 返回的消息
    workerInstance.onmessage = (e) => {
      const { id, success, result, error } = e.data
      const pending = pendingMessages.get(id)
      if (pending) {
        pendingMessages.delete(id)
        // 清理超时定时器
        if (pending.timeout) {
          clearTimeout(pending.timeout)
        }
        if (success) {
          pending.resolve(result)
        }
        else {
          pending.reject(new Error(error))
        }
      }
    }

    // 处理 Worker 错误
    workerInstance.onerror = (e) => {
      console.error('Worker error:', e)
    }
  }
  return workerInstance
}

/**
 * 发送消息到 Worker 并等待结果
 */
function sendMessage(type, data) {
  return new Promise((resolve, reject) => {
    const id = ++messageId
    const worker = getWorker()

    // 存储定时器引用
    const timeoutTimer = setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id)
        reject(new Error('Worker timeout'))
      }
    }, 10000)

    pendingMessages.set(id, {
      resolve,
      reject,
      timeout: timeoutTimer, // 存储定时器
    })
    worker.postMessage({ type, id, data })
  })
}

/**
 * 使用 Worker 解码数据
 */
export async function workerDecode(encoded) {
  try {
    return await sendMessage('decode', { encoded })
  }
  catch (e) {
    console.warn('Worker decode failed, falling back to main thread:', e)
    // 降级到主线程处理
    return decodeData(encoded)
  }
}

/**
 * 使用 Worker 解码并解析 JSON
 */
export async function workerDecodeAndParse(encoded) {
  try {
    return await sendMessage('decodeAndParse', { encoded })
  }
  catch (e) {
    console.warn('Worker decodeAndParse failed, falling back to main thread:', e)
    return JSON.parse(decodeData(encoded))
  }
}

/**
 * 使用 Worker 排序数据
 * @param {string} method - 排序方法名
 * @param {Array} wallpapers - 壁纸数组
 * @param {any} options - 排序选项（如 popularityMap）
 */
export async function workerSort(method, wallpapers, options) {
  try {
    // 如果数据量小，直接在主线程处理更快
    if (wallpapers.length < 100) {
      return sorting[method](wallpapers, options)
    }

    // 将 Map 转换为可序列化的格式
    let serializedOptions = options
    if (options instanceof Map) {
      serializedOptions = Array.from(options.entries())
    }

    return await sendMessage('sort', {
      method,
      wallpapers,
      options: serializedOptions,
    })
  }
  catch (e) {
    console.warn('Worker sort failed, falling back to main thread:', e)
    return sorting[method](wallpapers, options)
  }
}

/**
 * 使用 Worker 批量处理筛选和排序
 */
export async function workerFilterAndSort(wallpapers, filters, sortMethod, popularityMap) {
  try {
    // 如果数据量小，直接在主线程处理
    if (wallpapers.length < 100) {
      return null // 返回 null 表示应使用主线程
    }

    // 将 Map 转换为可序列化的格式
    let serializedPopularityMap = null
    if (popularityMap instanceof Map) {
      serializedPopularityMap = Array.from(popularityMap.entries())
    }
    else if (popularityMap) {
      serializedPopularityMap = Array.from(popularityMap.entries())
    }

    return await sendMessage('filterAndSort', {
      wallpapers,
      filters,
      sortMethod,
      popularityMap: serializedPopularityMap,
    })
  }
  catch (e) {
    console.warn('Worker filterAndSort failed:', e)
    return null // 返回 null 表示应使用主线程
  }
}

/**
 * 检查 Worker 是否可用
 */
export function isWorkerAvailable() {
  return typeof Worker !== 'undefined'
}

/**
 * 终止 Worker（清理资源）
 */
export function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
    // 清理所有待处理的定时器
    pendingMessages.forEach((pending) => {
      if (pending.timeout) {
        clearTimeout(pending.timeout)
      }
    })
    pendingMessages.clear()
  }
}

/**
 * Composable: 使用 Web Worker
 */
export function useWorker() {
  const isProcessing = ref(false)
  const error = shallowRef(null)

  async function decode(encoded) {
    isProcessing.value = true
    error.value = null
    try {
      return await workerDecode(encoded)
    }
    catch (e) {
      error.value = e
      throw e
    }
    finally {
      isProcessing.value = false
    }
  }

  async function decodeAndParse(encoded) {
    isProcessing.value = true
    error.value = null
    try {
      return await workerDecodeAndParse(encoded)
    }
    catch (e) {
      error.value = e
      throw e
    }
    finally {
      isProcessing.value = false
    }
  }

  async function sort(method, wallpapers, options) {
    isProcessing.value = true
    error.value = null
    try {
      return await workerSort(method, wallpapers, options)
    }
    catch (e) {
      error.value = e
      throw e
    }
    finally {
      isProcessing.value = false
    }
  }

  return {
    isProcessing,
    error,
    decode,
    decodeAndParse,
    sort,
    isAvailable: isWorkerAvailable(),
  }
}
