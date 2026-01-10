/**
 * CDN 注入插件
 * 在生产环境构建时注入 CDN 脚本，并移除 Import Map
 */

import process from 'node:process'

// CDN 配置
const cdn = {
  css: [],
  js: [
    'https://unpkg.com/vue@3.5.24/dist/vue.global.prod.js',
    'https://unpkg.com/vue-demi@0.14.10/lib/index.iife.js',
    'https://unpkg.com/vue-router@4.6.4/dist/vue-router.global.prod.js',
    'https://cdn.jsdelivr.net/npm/pinia@3.0.4/dist/pinia.iife.min.js',
  ],
}

/**
 * CDN 插件
 * @param {object} options 配置选项
 * @param {string[]} options.css - CDN CSS 文件列表
 * @param {string[]} options.js - CDN JS 文件列表
 * @returns {import('vite').Plugin}
 */
export function cdnPlugin(options = {}) {
  const { css = cdn.css, js = cdn.js } = options
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    name: 'vite-plugin-cdn',
    transformIndexHtml: {
      order: 'post', // 在 Vite 注入脚本之后执行
      handler(html) {
        if (!isProduction)
          return html

        // 移除 Import Map（生产环境使用 UMD 全局变量）
        html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/g, '')

        // 在第一个 <script type="module" 之前注入 CDN 脚本
        const cdnScripts = js.map(url => `    <script src="${url}"></script>`).join('\n')
        const cdnStyles = css.map(url => `    <link rel="stylesheet" href="${url}">`).join('\n')

        // 找到 Vite 注入的模块脚本位置，在其之前插入 CDN 脚本
        html = html.replace(
          /(<script type="module")/,
          `${cdnStyles}\n${cdnScripts}\n    $1`,
        )

        return html
      },
    },
  }
}

export default cdnPlugin
