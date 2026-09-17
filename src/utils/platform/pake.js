/**
 * Pake / Tauri desktop environment helpers.
 * Used to enable desktop-app-only UI (e.g. back button) without affecting normal web visitors.
 */

/**
 * Detect whether the page is running inside a Pake (Tauri) desktop shell.
 * @returns {boolean}
 */
export function isPakeDesktop() {
  if (typeof window === 'undefined') {
    return false
  }

  // Official Tauri global injected into the webview
  if (window.__TAURI__ || window.__TAURI_INTERNALS__) {
    return true
  }

  // Fallback: some builds expose a config marker
  if (window.pakeConfig) {
    return true
  }

  return false
}

/**
 * Navigate back within the desktop shell.
 * Prefer history back when possible; otherwise go home.
 * @param {import('vue-router').Router} [router]
 */
export function navigateDesktopBack(router) {
  if (typeof window === 'undefined') {
    return
  }

  if (window.history.length > 1) {
    window.history.back()
    return
  }

  if (router) {
    router.push('/desktop')
    return
  }

  window.location.href = '/desktop'
}
