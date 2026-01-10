import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { VantResolver } from '@vant/auto-import-resolver'
import vue from '@vitejs/plugin-vue'
import externalGlobals from 'rollup-plugin-external-globals'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import compression from 'vite-plugin-compression'
import { obfuscatePlugin } from './build/vite-plugin-obfuscate.js'

// 是否生产环境
const isProduction = process.env.NODE_ENV === 'production'

// CDN 配置
const cdn = {
  css: [],
  js: [
    'https://unpkg.com/vue@3.5.24/dist/vue.global.prod.js',
    'https://unpkg.com/vue-demi@0.14.10/lib/index.iife.js',
    'https://unpkg.com/vue-router@4.6.4/dist/vue-router.global.prod.js',
  ],
}

/**
 * CDN 注入插件
 * 在生产环境构建时注入 CDN 脚本，并移除 Import Map
 */
function cdnPlugin() {
  return {
    name: 'cdn-plugin',
    transformIndexHtml: {
      order: 'post', // 在 Vite 注入脚本之后执行
      handler(html) {
        if (!isProduction)
          return html

        // 移除 Import Map（生产环境使用 UMD 全局变量）
        html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/g, '')

        // 在第一个 <script type="module" 之前注入 CDN 脚本
        const cdnScripts = cdn.js.map(url => `    <script src="${url}"></script>`).join('\n')
        const cdnStyles = cdn.css.map(url => `    <link rel="stylesheet" href="${url}">`).join('\n')

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

// 读取 package.json 版本号
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
const APP_VERSION = pkg.version
const BUILD_TIME = new Date().toISOString()

/**
 * 版本文件更新插件
 * 在构建时自动更新 public/version.json
 */
function versionPlugin() {
  return {
    name: 'version-plugin',
    buildStart() {
      if (isProduction) {
        const versionFile = path.resolve(__dirname, 'public/version.json')
        const versionData = {
          version: APP_VERSION,
          buildTime: BUILD_TIME,
        }
        fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2))
        console.log(`[version-plugin] Updated version.json to v${APP_VERSION}`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    versionPlugin(),
    cdnPlugin(),
    AutoImport({
      resolvers: [ElementPlusResolver(), VantResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver(), VantResolver()],
    }),
    // Gzip 压缩
    // compression({
    //   algorithm: 'gzip',
    //   ext: '.gz',
    //   threshold: 10240,
    //   deleteOriginFile: false,
    // }),
    // Brotli 压缩（压缩率更高，GitHub Pages 支持）
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
    }),
    // 生产环境：对敏感文件进行混淆
    isProduction && obfuscatePlugin({
      include: [
        'src/utils/codec.js',
        'src/utils/constants.js',
        'src/utils/format.js',
        // 'src/utils/anti-debug.js', // 已禁用反调试，无需混淆
        'src/composables/useWallpapers.js', // 数据加载逻辑和 URL 拼接
      ],
    }),
    // 生产环境：使用 externalGlobals 将外部依赖转换为全局变量
    // enforce: 'post' 确保在 auto-import 之后执行
    isProduction && {
      ...externalGlobals({
        'vue': 'Vue',
        'vue-demi': 'VueDemi',
        'vue-router': 'VueRouter',
      }),
      enforce: 'post',
    },
  ].filter(Boolean),
  base: '/', // 子域名部署使用根路径
  // 注入全局变量
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/styles/variables" as *;`,
      },
    },
    // CSS 优化配置
    postcss: {
      plugins: [
        // 自动添加浏览器前缀
        // autoprefixer 默认已包含
      ],
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    // CSS 代码分割
    cssCodeSplit: true,
    // 使用 esbuild 压缩（更快）
    minify: 'esbuild',
    rollupOptions: {
      // 排除不需要打包的依赖（使用 CDN）- 仅生产环境
      external: isProduction ? ['vue', 'vue-demi', 'vue-router'] : [],
      output: {
        // 指定全局变量名（对应 CDN 中的全局变量）
        globals: {
          'vue': 'Vue',
          'vue-demi': 'VueDemi',
          'vue-router': 'VueRouter',
        },
        manualChunks: {
          // 保留这些库的分包配置（不使用 CDN）
          'element-plus': ['element-plus'],
          'vant': ['vant'],
          'gsap': ['gsap'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
