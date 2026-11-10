export function buildDetailShell(html, css) {
  // 详情首屏只依赖内联关键样式；完整应用样式加载后再交给 Vue。
  return html.replace(/<link\b[^>]*>/g, tag => /\srel="stylesheet"/.test(tag) ? tag.replace(/>$/, ' media="print" data-detail-stylesheet>') : tag)
    .replace('</head>', `<style data-detail-critical>${css}</style></head>`)
}
