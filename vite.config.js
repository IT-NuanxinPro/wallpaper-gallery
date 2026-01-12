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
import { cdnPlugin } from './build/vite-plugin-cdn.js'
import { obfuscatePlugin } from './build/vite-plugin-obfuscate.js'
import { versionPlugin } from './build/vite-plugin-version.js'

// 是否生产环境
const isProduction = process.env.NODE_ENV === 'production'

// 读取 package.json 版本号
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
const APP_VERSION = pkg.version
const BUILD_TIME = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 版本文件更新
    versionPlugin({
      version: APP_VERSION,
      buildTime: BUILD_TIME,
    }),
    // CDN 注入
    cdnPlugin(),
    // 自动导入
    AutoImport({
      resolvers: [ElementPlusResolver(), VantResolver()],
    }),
    // 组件自动注册
    Components({
      resolvers: [ElementPlusResolver(), VantResolver()],
    }),
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
      ],
    }),
    // 生产环境：使用 externalGlobals 将外部依赖转换为全局变量
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
