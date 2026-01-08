# PWA (Progressive Web App) 部署指南

## 📱 什么是 PWA？

PWA（Progressive Web App）是一种使用 Web 技术构建的应用，可以像原生应用一样安装到设备上。

## ✨ PWA 特性

### 已实现功能
✅ **可安装** - 可以安装到桌面和手机主屏幕
✅ **离线缓存** - 静态资源本地缓存
✅ **自动更新** - Service Worker 自动检测更新
✅ **应用图标** - 支持多种尺寸的图标
✅ **启动画面** - 自定义启动体验
✅ **快捷方式** - 快速访问常用功能

### 待完善功能
⏳ **应用图标** - 需要准备真实的图标文件
⏳ **离线浏览** - 缓存用户浏览过的壁纸
⏳ **推送通知** - 每日壁纸推送
⏳ **后台同步** - 后台下载壁纸

---

## 🚀 快速开始

### 1. 准备图标文件

在 `public/` 目录下创建以下图标文件：

```
public/
├── icon-96.png      # 96x96 - 快捷方式图标
├── icon-144.png     # 144x144 - 平板图标
├── icon-192.png     # 192x192 - 标准图标
└── icon-512.png     # 512x512 - 高清图标
```

**图标要求**:
- 格式: PNG (推荐透明背景)
- 背景: 使用 `#6366f1` (主题色) 作为背景色
- 设计: 简洁、易识别的壁纸图标

### 2. 构建项目

```bash
# 开发环境（不支持 PWA 功能）
pnpm dev

# 生产构建（生成 PWA）
pnpm build
```

### 3. 本地测试 PWA

```bash
# 安装 http-server
pnpm add -g http-server

# 进入构建目录
cd dist

# 启动本地服务器（支持 HTTPS）
# 注意：PWA 需要 HTTPS 环境，本地测试需要使用 HTTPS 服务器
http-server -S -C cert.pem -K key.pem .
```

### 4. 安装 PWA

#### Chrome/Edge (PC)
1. 访问网站
2. 点击地址栏的 "安装" 图标
3. 点击 "安装" 按钮

#### Chrome (Android)
1. 访问网站
2. 点击浏览器菜单
3. 点击 "添加到主屏幕"

#### Safari (iOS)
1. 访问网站
2. 点击分享按钮
3. 滚动到 "添加到主屏幕"
4. 点击 "添加"

---

## 📦 部署

### 部署到 GitHub Pages

```bash
# 构建项目
pnpm build

# 推送到 GitHub
git add .
git commit -m "feat: add PWA support"
git push origin feature/pwa

# 合并到 main 分支
git checkout main
git merge feature/pwa
git push origin main
```

### 部署到 Vercel

```bash
# Vercel 会自动检测并部署
vercel --prod
```

### 部署到 Netlify

```bash
netlify deploy --prod
```

---

## 🔧 配置说明

### manifest.json

应用清单文件，定义应用的基本信息：

```json
{
  "name": "Wallpaper Gallery",
  "short_name": "Wallpaper",
  "description": "精选高清4K壁纸",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8f9fa",
  "theme_color": "#6366f1",
  "icons": [...]
}
```

### vite.config.js (PWA 配置)

```javascript
VitePWA({
  registerType: 'autoUpdate', // 自动更新
  workbox: {
    // 缓存策略
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
        handler: 'CacheFirst', // 优先使用缓存
        options: {
          cacheName: 'cdn-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 天
          },
        },
      },
    ],
  },
})
```

---

## 📊 缓存策略

### CacheFirst (缓存优先)
- 适用于: CDN 资源、静态图片
- 优点: 快速加载
- 缺点: 需要设置过期时间

### NetworkFirst (网络优先)
- 适用于: API 请求、动态数据
- 优点: 获取最新数据
- 缺点: 网络慢时加载慢

### StaleWhileRevalidate (后台更新)
- 适用于: HTML、CSS、JS
- 优点: 快速展示，后台更新
- 缺点: 可能短暂显示旧数据

---

## 🛠️ 开发工具

### PWA 调试

#### Chrome DevTools
1. 打开 DevTools (F12)
2. 切换到 "Application" 标签
3. 左侧选择 "Service Workers"
4. 查看状态、缓存内容

#### Lighthouse 审计
1. 打开 DevTools (F12)
2. 切换到 "Lighthouse" 标签
3. 选择 "Progressive Web App"
4. 点击 "Analyze page load"

### Service Worker 调试

```javascript
// 在浏览器控制台
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg)
  reg.update() // 强制更新
})

// 查看缓存
caches.keys().then(keys => {
  keys.forEach(key => {
    console.log('Cache:', key)
  })
})
```

---

## 📝 常见问题

### Q: PWA 无法安装？

**A: 检查以下内容**:
1. ✅ 是否使用 HTTPS（或 localhost）
2. ✅ manifest.json 是否正确配置
3. ✅ 图标文件是否存在
4. ✅ Service Worker 是否正常注册

### Q: 更新不生效？

**A: 手动更新 Service Worker**:
```javascript
// 在浏览器控制台执行
navigator.serviceWorker.getRegistration().then(reg => {
  reg.unregister()
  location.reload()
})
```

### Q: 离线无法访问？

**A: 检查缓存策略**:
1. ✅ 确认静态资源已缓存
2. ✅ 检查 workbox 配置
3. ✅ 查看浏览器缓存

### Q: 图标不显示？

**A: 检查图标文件**:
1. ✅ 文件名是否正确
2. ✅ 文件格式是否为 PNG
3. ✅ 尺寸是否符合要求

---

## 📈 性能优化

### 预缓存策略
```javascript
workbox: {
  // 预缓存关键资源
  precacheEntries: [
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
  ],
}
```

### 缓存清理
```javascript
// 定期清理过期缓存
expiration: {
  maxEntries: 100,
  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 天
}
```

---

## 🎯 进阶功能

### 1. 离线浏览

缓存用户浏览过的壁纸：

```javascript
// 在用户查看壁纸时缓存
async function cacheWallpaper(url) {
  const cache = await caches.open('wallpaper-cache')
  await cache.add(url)
}
```

### 2. 后台同步

使用 Background Sync API：

```javascript
// 注册同步事件
navigator.serviceWorker.ready.then(reg => {
  reg.sync.register('sync-wallpapers')
})
```

### 3. 推送通知

使用 Push API：

```javascript
// 请求通知权限
Notification.requestPermission().then(permission => {
  if (permission === 'granted') {
    new Notification('新壁纸推荐！')
  }
})
```

---

## 📚 参考资料

- [PWA 官方文档](https://web.dev/progressive-web-apps/)
- [Vite PWA 插件](https://vite-pwa-org.netlify.app/)
- [Workbox 文档](https://developers.google.com/web/tools/workbox)
- [MDN - PWA](https://developer.mozilla.org/zh-CN/docs/Web/Progressive_web_apps)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**最后更新**: 2025-01-08
**版本**: v1.0
**分支**: feature/pwa
