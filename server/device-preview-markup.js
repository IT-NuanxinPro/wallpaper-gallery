import { getPreviewDevices, getPreviewMode } from '../src/utils/wallpaper/devicePreview.js'

/** 只接收服务端已转义的媒体HTML；默认设备几何与Vue一致。 */
export function renderDevicePreview(record, media) {
  const mode = getPreviewMode(record._series || record.series, record.usage || record.category)
  const device = mode === 'mobile' ? 'phone' : 'laptop'
  const ratio = mode === 'mobile' ? 390 / 844 : 16 / 10
  const controls = getPreviewDevices(mode).map(item => `<button type="button" data-device-option aria-pressed="${item.id === device}" title="${item.label}" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="5" width="16" height="13" rx="2"/></svg><span>${item.label}</span></button>`).join('')
  const decoration = mode === 'mobile'
    ? '<span class="preview-frame__island" aria-hidden="true"></span><span class="preview-frame__home" aria-hidden="true"></span>'
    : '<span class="preview-frame__base is-visible" aria-hidden="true"></span>'
  return `<div class="device-preview${mode === 'mobile' ? ' is-mobile-preview' : ''}" style="--device-ratio:${ratio};--fold-parts:1" data-device="${device}">
    <div class="device-preview__stage"><div class="device-preview__arrangement"><div class="preview-frame preview-frame--${device}"><div class="preview-frame__shell"><div class="preview-frame__screen">${media}${mode === 'mobile' ? decoration : ''}</div><span class="preview-frame__camera" aria-hidden="true"></span></div>${mode === 'desktop' ? decoration : ''}</div></div></div>
    <div class="device-controls${mode === 'mobile' ? ' is-vertical' : ''}"><div class="device-toolbar${mode === 'mobile' ? ' is-vertical' : ''}" role="toolbar" aria-label="预览设备"><button class="device-toolbar__follow" type="button" role="switch" aria-checked="false" title="按本机屏幕比例预览" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg><i class="device-toolbar__toggle"></i><span>本机屏幕</span></button><i class="device-toolbar__separator"></i>${controls}</div></div>
  </div>`
}
