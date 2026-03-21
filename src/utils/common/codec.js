// ========================================
// 数据编码/解码（防止在线工具直接解码）
// ========================================

import { CHAR_MAP_DECODE, CHAR_MAP_ENCODE, VERSION_PREFIX } from './codec-config.js'

/**
 * 自定义编码（Base64 + 字符映射 + 反转）
 * @param {string} str - 原始字符串
 * @returns {string} 编码后的字符串
 */
export function encodeData(str) {
  const base64 = btoa(unescape(encodeURIComponent(str)))
  const mapped = base64.split('').map(c => CHAR_MAP_ENCODE[c] || c).join('')
  return VERSION_PREFIX + mapped.split('').reverse().join('')
}

/**
 * 自定义解码
 * @param {string} encoded - 编码后的字符串
 * @returns {string} 原始字符串
 */
export function decodeData(encoded) {
  if (!encoded.startsWith(VERSION_PREFIX)) {
    throw new Error('Invalid data format')
  }
  const reversed = encoded.slice(VERSION_PREFIX.length).split('').reverse().join('')
  const base64 = reversed.split('').map(c => CHAR_MAP_DECODE[c] || c).join('')
  return decodeURIComponent(escape(atob(base64)))
}
