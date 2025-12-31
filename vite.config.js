import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { VantResolver } from '@vant/auto-import-resolver'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import compression from 'vite-plugin-compression'
import { obfuscatePlugin } from './build/vite-plugin-obfuscate.js'

// 是否生产环境
const isProduction = process.env.NODE_ENV === 'production'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
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
  ].filter(Boolean),
  base: '/', // 子域名部署使用根路径
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
      external: isProduction ? ['vue', 'vue-router', 'gsap'] : [],
      output: {
        // 指定全局变量名（对应 CDN 中的全局变量）
        globals: {
          'vue': 'Vue',
          'vue-router': 'VueRouter',
          'gsap': 'gsap',
        },
        manualChunks: {
          // 保留这些库的分包配置（不使用 CDN）
          'element-plus': ['element-plus'],
          'vant': ['vant'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
