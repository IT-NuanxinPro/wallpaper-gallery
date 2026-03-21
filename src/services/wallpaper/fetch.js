export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchWithRetry(url, options = {}, retryConfig = {}) {
  const {
    retries = 3,
    retryDelay = 1000,
  } = retryConfig

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        if (i < retries - 1) {
          await delay(retryDelay * (i + 1))
          continue
        }

        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return response
    }
    catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch') && i < retries - 1) {
        await delay(retryDelay * (i + 1))
        continue
      }

      throw error
    }
  }
}
