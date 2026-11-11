let pending

/** 先加载官方脚本再挂载开源组件，避开组件加载途中取消/重试的竞态。 */
export function loadTurnstileScript() {
  if (window.turnstile?.render)
    return Promise.resolve()
  if (pending)
    return pending
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const callback = '__wallpaperTurnstileReady'
    let timer
    function cleanup() {
      clearTimeout(timer)
      delete window[callback]
      script.onerror = null
    }
    function fail() {
      cleanup()
      script.remove()
      reject(new Error('验证组件暂时无法加载'))
    }
    window[callback] = () => {
      if (!window.turnstile?.render) {
        fail()
        return
      }
      cleanup()
      resolve()
    }
    script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${callback}`
    script.async = true
    script.onerror = fail
    timer = setTimeout(fail, 18000)
    document.head.appendChild(script)
  })
  pending = promise.catch((error) => {
    pending = null
    throw error
  })
  return pending
}
