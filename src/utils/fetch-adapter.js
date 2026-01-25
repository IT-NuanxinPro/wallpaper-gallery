/**
 * Fetch 适配器
 * 在 Electron 环境下拦截本地文件请求，使用 IPC 读取
 */

import { isElectron, readLocalFile } from './electron-adapter'

/**
 * 增强的 fetch 函数
 * 在 Electron 环境下，拦截相对路径请求并使用 IPC 读取本地文件
 */
export async function fetchWithAdapter(url, options) {
  // 检查是否是本地文件请求（相对路径或 data/ 开头）
  const isLocalFile = url.startsWith('./') || url.startsWith('data/') || url.startsWith('/data/')

  if (isElectron() && isLocalFile) {
    // 标准化路径：移除开头的 ./ 和 /
    const cleanUrl = url.replace(/^\.\//, '').replace(/^\//, '')

    // 使用 IPC 读取本地文件
    const result = await readLocalFile(cleanUrl)

    if (!result.success) {
      throw new Error(`Failed to read local file: ${result.message}`)
    }

    // 模拟 fetch Response 对象
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      json: async () => JSON.parse(result.data),
      text: async () => result.data,
      blob: async () => new Blob([result.data]),
    }
  }

  // 其他请求使用原生 fetch
  return fetch(url, options)
}

/**
 * 带重试的 fetch（兼容 Electron）
 */
export async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithAdapter(url, options)
      if (response.ok) {
        return response
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    catch (error) {
      if (i === retries - 1)
        throw error
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
