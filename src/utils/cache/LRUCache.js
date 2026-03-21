/**
 * 简单的 LRU 缓存
 * 用于限制 Store 中的数据缓存大小，防止内存泄漏
 */
export class LRUCache {
  constructor(maxSize = 10) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key))
      return undefined

    // 访问时移到末尾（最近使用）
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key, value) {
    // 如果已存在，先删除（为了更新顺序）
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    // 超出容量，删除最旧的
    else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    this.cache.set(key, value)
  }

  has(key) {
    return this.cache.has(key)
  }

  delete(key) {
    return this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  get size() {
    return this.cache.size
  }

  // 删除指定前缀的所有条目
  deleteByPrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }
}

/**
 * 创建一个带有自动清理的 Map
 * 用于统计数据等需要限制大小的场景
 */
export class BoundedMap {
  constructor(maxSize = 5000) {
    this.maxSize = maxSize
    this.map = new Map()
  }

  get(key) {
    return this.map.get(key)
  }

  set(key, value) {
    // 超出容量时，批量删除最旧的 20%
    if (!this.map.has(key) && this.map.size >= this.maxSize) {
      const deleteCount = Math.floor(this.maxSize * 0.2)
      const keys = [...this.map.keys()].slice(0, deleteCount)
      keys.forEach(k => this.map.delete(k))
    }
    this.map.set(key, value)
  }

  has(key) {
    return this.map.has(key)
  }

  delete(key) {
    return this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }

  get size() {
    return this.map.size
  }

  entries() {
    return this.map.entries()
  }

  values() {
    return this.map.values()
  }

  keys() {
    return this.map.keys()
  }

  forEach(callback) {
    this.map.forEach(callback)
  }
}
