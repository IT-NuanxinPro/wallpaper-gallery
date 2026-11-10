export async function prepareDetailStyles(document = globalThis.document) {
  const links = [...document.querySelectorAll('link[data-detail-stylesheet]')]
  await Promise.all(links.map(link => new Promise((resolve, reject) => {
    if (link.sheet) {
      resolve()
      return
    }
    function cleanup() {
      link.removeEventListener('load', loaded)
      link.removeEventListener('error', failed)
    }
    function loaded() {
      cleanup()
      resolve()
    }
    function failed() {
      cleanup()
      reject(new Error('详情应用样式加载失败'))
    }
    link.addEventListener('load', loaded, { once: true })
    link.addEventListener('error', failed, { once: true })
    // 读取 sheet 与添加监听之间完成的请求也能正确接管。
    if (link.sheet)
      loaded()
  })))
  links.forEach((link) => {
    link.media = 'all'
  })
}
