import { describe, expect, it } from 'vitest'
import { encodeData } from '../src/utils/common/codec.js'
import { extractCategoryFilesFromIndexData } from '../scripts/sync-data.js'

describe('extractCategoryFilesFromIndexData', () => {
  it('returns category files from encoded index data', () => {
    const categories = [
      { file: '动漫.json', name: '动漫' },
      { file: '风景.json', name: '风景' },
    ]
    const indexData = {
      blob: encodeData(JSON.stringify(categories)),
    }

    expect(extractCategoryFilesFromIndexData(indexData)).toEqual(['动漫.json', '风景.json'])
  })

  it('returns category files from plain categories data', () => {
    const indexData = {
      categories: [
        { file: '人物.json' },
        { file: '游戏.json' },
      ],
    }

    expect(extractCategoryFilesFromIndexData(indexData)).toEqual(['人物.json', '游戏.json'])
  })

  it('ignores invalid category entries', () => {
    const indexData = {
      categories: [
        { file: '有效.json' },
        {},
        null,
      ],
    }

    expect(extractCategoryFilesFromIndexData(indexData)).toEqual(['有效.json'])
  })
})
