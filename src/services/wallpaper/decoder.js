import { isWorkerAvailable, workerDecodeAndParse } from '@/composables/useWorker'
import { decodeData } from '@/utils/common/codec'

export async function decodeDataWithWorker(encoded) {
  if (isWorkerAvailable() && encoded.length > 1000) {
    try {
      return await workerDecodeAndParse(encoded)
    }
    catch (error) {
      console.warn('Worker decode failed, fallback to main thread:', error)
    }
  }

  const jsonStr = decodeData(encoded)
  return JSON.parse(jsonStr)
}
