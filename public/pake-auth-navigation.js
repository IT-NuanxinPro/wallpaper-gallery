(() => {
  const APP_ORIGIN = 'https://wallpaper.061129.xyz'
  const TOOLBAR_ID = 'wallpaper-pake-auth-toolbar'

  function getProviderInfo() {
    const host = window.location.hostname.toLowerCase()

    if (host === 'github.com' || host.endsWith('.github.com')) {
      return { label: 'GitHub 安全授权', accent: '#24292f' }
    }

    if (host.includes('google.')) {
      return { label: 'Google 安全授权', accent: '#4285f4' }
    }

    if (host === 'linux.do' || host.endsWith('.linux.do')) {
      return { label: 'Linux.do 安全授权', accent: '#0ea5e9' }
    }

    return { label: '第三方安全授权', accent: '#2563eb' }
  }

  function isExternalAuthPage() {
    try {
      const url = new URL(window.location.href)
      if (url.origin === APP_ORIGIN)
        return false

      const host = url.hostname.toLowerCase()
      const path = url.pathname.toLowerCase()
      const authHosts = [
        'github.com',
        'accounts.google.com',
        'appleid.apple.com',
        'login.microsoftonline.com',
        'linux.do',
      ]
      const authPathPatterns = [
        /\/oauth\//,
        /\/authorize(?:\/|$)/,
        /\/auth\//,
        /\/signin(?:\/|$)/,
        /\/login(?:\/|$)/,
        /\/sso\//,
      ]

      return authHosts.some(item => host === item || host.endsWith(`.${item}`))
        || authPathPatterns.some(pattern => pattern.test(path))
    }
    catch {
      return false
    }
  }

  function navigateBack() {
    const invoke = window.__TAURI__?.core?.invoke
    if (typeof invoke === 'function') {
      invoke('webview_navigate', { action: 'back' }).catch(() => window.history.back())
      return
    }
    window.history.back()
  }

  function cancelAuth() {
    window.location.href = `${APP_ORIGIN}/login`
  }

  function createButton(text, ariaLabel) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = text
    button.setAttribute('aria-label', ariaLabel)
    Object.assign(button.style, {
      height: '34px',
      padding: '0 13px',
      border: '1px solid rgba(148, 163, 184, .22)',
      borderRadius: '11px',
      color: '#334155',
      background: 'rgba(255,255,255,.7)',
      font: '600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      cursor: 'pointer',
      transition: 'background .18s ease, transform .18s ease, border-color .18s ease',
    })
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(241,245,249,.96)'
      button.style.borderColor = 'rgba(100,116,139,.32)'
    })
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255,255,255,.7)'
      button.style.borderColor = 'rgba(148,163,184,.22)'
    })
    button.addEventListener('mousedown', () => {
      button.style.transform = 'scale(.97)'
    })
    button.addEventListener('mouseup', () => {
      button.style.transform = 'scale(1)'
    })
    return button
  }

  function mountToolbar() {
    if (!isExternalAuthPage() || document.getElementById(TOOLBAR_ID) || !document.body)
      return

    const provider = getProviderInfo()
    const toolbar = document.createElement('div')
    toolbar.id = TOOLBAR_ID
    toolbar.setAttribute('role', 'navigation')
    toolbar.setAttribute('aria-label', '第三方授权导航')
    Object.assign(toolbar.style, {
      position: 'fixed',
      top: '12px',
      left: '50%',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      width: 'min(720px, calc(100vw - 32px))',
      height: '52px',
      padding: '0 9px',
      boxSizing: 'border-box',
      border: '1px solid rgba(255,255,255,.72)',
      borderRadius: '17px',
      background: 'rgba(255,255,255,.94)',
      boxShadow: '0 16px 44px rgba(15,23,42,.18), inset 0 1px 0 rgba(255,255,255,.8)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      transform: 'translateX(-50%)',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    })

    const backButton = createButton('← 返回', '返回上一页')
    backButton.addEventListener('click', navigateBack)

    const center = document.createElement('div')
    Object.assign(center.style, {
      display: 'flex',
      flex: '1',
      minWidth: '0',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '9px',
      padding: '0 12px',
      color: '#334155',
    })

    const lock = document.createElement('span')
    lock.textContent = '●'
    lock.setAttribute('aria-hidden', 'true')
    Object.assign(lock.style, {
      color: provider.accent,
      fontSize: '9px',
      boxShadow: `0 0 0 5px ${provider.accent}16`,
      borderRadius: '50%',
    })

    const text = document.createElement('div')
    Object.assign(text.style, {
      display: 'flex',
      minWidth: '0',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
    })

    const title = document.createElement('strong')
    title.textContent = provider.label
    Object.assign(title.style, {
      maxWidth: '100%',
      overflow: 'hidden',
      color: '#1e293b',
      fontSize: '13px',
      fontWeight: '700',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    })

    const hostname = document.createElement('small')
    hostname.textContent = window.location.hostname
    Object.assign(hostname.style, {
      maxWidth: '100%',
      overflow: 'hidden',
      color: '#94a3b8',
      fontSize: '10px',
      fontWeight: '500',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    })

    text.append(title, hostname)
    center.append(lock, text)

    const cancelButton = createButton('取消', '取消第三方授权')
    cancelButton.addEventListener('click', cancelAuth)

    toolbar.append(backButton, center, cancelButton)
    document.body.appendChild(toolbar)

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape')
        cancelAuth()
    }, { once: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountToolbar, { once: true })
  }
  else {
    mountToolbar()
  }
})()
