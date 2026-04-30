const HOT_TAGS_BASE_URL = '/data/stats'

export async function loadHotTags(series = 'all') {
  if (series === 'video') {
    return []
  }

  try {
    const response = await fetch(`${HOT_TAGS_BASE_URL}/hot-tags-${series}.json`)
    if (!response.ok) {
      if (response.status === 404) {
        return []
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return Array.isArray(data?.tags) ? data.tags : []
  }
  catch (error) {
    console.error(`[HotTagsService] 加载热门标签失败: ${series}`, error)
    return []
  }
}
