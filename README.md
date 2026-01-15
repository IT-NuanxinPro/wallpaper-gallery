# Wallpaper Gallery

一个高雅大气的壁纸展示网站，基于 Vue 3 + Vite 7 构建，完美适配桌面端和移动端。

## ✨ 特性

### 🎨 核心功能

- **高清壁纸展示** - 支持 16K/8K/5K/4K 及更高分辨率壁纸
- **四大系列** - 电脑壁纸、手机壁纸、头像、每日 Bing 壁纸
- **头像自制工具** - PC 端专属在线头像制作功能
  - 本地上传或在线链接导入图片
  - 智能裁剪与实时预览（基于 Cropper.js）
  - 圆形/方形头像切换，方形支持自定义圆角
  - 自定义输出尺寸（100px-1000px）
  - iPhone 真机预览效果
  - 高质量 PNG 格式输出
- **每日 Bing 壁纸** - 从 2019年6月至今约 2400+ 张必应精选壁纸
  - 按年度分片加载，性能优异
  - 直连 Bing CDN，无需额外存储
- **智能裁剪** - PC 端电脑壁纸智能裁剪功能
  - 自动适配当前屏幕分辨率
  - 多种比例预设（16:9、21:9、16:10、4:3、iPad、iPhone、安卓全面屏等）
  - 自定义分辨率输入
  - 实时预览 + 沉浸式全屏预览
  - 原图质量输出选项
- **真机显示模式** - 手机壁纸和头像系列专属
  - 手机壁纸：模拟 iPhone 14 Pro 外观（Dynamic Island 灵动岛动画、状态栏、Home 指示器）
  - 头像系列：简洁 iPhone 框架（无灵动岛，突出头像展示）
  - 电脑端和手机端统一支持
  - 流畅的进入动画（GSAP 硬件加速）
- **竖屏壁纸弹窗** - 移动端专属竖屏壁纸预览体验
  - 高级感渐变设计（紫蓝渐变 #667eea → #764ba2）
  - 头像弹窗支持圆形/方形切换
  - 滚动锁定防止穿透
- **头像制作弹窗** - PC 端专属头像自制工具
  - 拖拽上传或在线链接导入
  - 实时裁剪预览与形状切换
  - 自定义尺寸与圆角设置
  - iPhone 真机预览效果
  - 一键下载高质量头像
- **智能搜索** - 实时搜索建议、关键词高亮、回车确认搜索
- **多种排序** - 按时间、热门、大小、名称排序
- **动态分类** - 自动从壁纸数据中提取分类，按数量排序
- **格式筛选** - 按 JPG/PNG 格式筛选
- **分辨率筛选** - 仅电脑壁纸系列支持，按 16K/8K/5K+/4K+/4K/2K/超清/高清/标清精确筛选
- **一键下载** - 直接下载原图

### 🖼️ 视图与浏览

- **多视图模式**
  - 桌面端：网格/列表/瀑布流，支持 GSAP Flip 动画丝滑切换
  - 移动端：网格/列表，支持手势左右滑动切换视图
- **丝滑切换动画** - 基于 GSAP Flip 插件的视图模式切换动画，卡片平滑形变过渡
- **移动端 Flex 瀑布流** - 采用 Flex + JS 分列算法
- **导航滑块动画** - 系列切换时背景滑块平滑过渡，避免元素抖动
- **动态宽高比** - 根据系列自动适配卡片比例（电脑16:10、手机9:16、头像1:1、Bing 16:9）
- **全屏浏览** - 沉浸式全屏浏览模式，ESC 退出
- **移动端无限滚动** - 滚动到底部自动加载更多
- **今日精选** - 每日随机推荐精选壁纸（仅电脑壁纸系列）
- **3D 热门轮播** - 首页 3D 卡片轮播展示热门壁纸（下线）
- **分页条数切换** - 支持 10/20/30/50 条每页，实时切换

### 💫 用户体验

- **高级感 UI 设计** - 紫蓝渐变主题色（#667eea → #764ba2）、丝滑动画
- **版本检测与更新提示** - 自动检测新版本，优雅的底部提示栏
- **智能设备检测** - 综合 User Agent、触摸支持、屏幕尺寸判断设备类型
- **主题切换** - 深色/浅色/跟随系统/定时自动切换
- **响应式设计** - 完美适配桌面端和移动端，支持 2K/4K 大屏优化
- **欢迎横幅** - 首页精美渐变横幅，可关闭并记住状态
- **移动端优化**
  - 底部筛选弹窗
  - 顶部搜索弹窗
  - 侧边导航抽屉
  - 手势滑动切换视图
  - 移除 backdrop-filter 提升滚动性能
  - 滚动锁定防止弹窗穿透
- **用户偏好记忆** - 记住用户的系列选择、排序方式、视图模式
- **本地缩略图** - 预生成 WebP 缩略图，首页加载更快

### 📊 数据统计

- **浏览量统计** - 记录每张壁纸的浏览次数
- **下载量统计** - 记录每张壁纸的下载次数
- **热门排序** - 基于浏览量的热门壁纸排序
- **热门轮播** - 首页展示最受欢迎的壁纸
- **Supabase 后端** - 使用 Supabase 存储统计数据，支持原子递增

### 🧭 路由与导航

- **智能重定向** - 首次访问根据设备类型自动跳转到推荐系列
- **偏好优先** - 用户明确选择的系列优先于设备推荐
- **循环检测** - 防止路由守卫产生无限循环
- **历史优化** - 使用 replace 避免污染浏览历史

## 🛠️ 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Vue 3.5 (Composition API + script setup) |
| 构建工具 | Vite 7 |
| UI 组件 | Element Plus (PC端 + Bing 日期选择) + Vant (移动端) |
| 动画 | GSAP + Flip 插件 |
| 图片裁剪 | Cropper.js |
| 样式 | Sass + postcss-pxtorem (移动端适配) |
| 路由 | Vue Router 4 |
| 状态管理 | Pinia |
| 数据统计 | Supabase (PostgreSQL) |
| 部署 | GitHub Pages (生产) / Vercel (测试) |
| CDN 加速 | Cloudflare + jsDelivr |
| 统计分析 | Cloudflare Web Analytics + Umami |

### 构建优化

- **CDN 外部化** - Vue / Vue Router / vue-demi 通过 CDN 加载（UMD 全局变量模式）
- **代码分割** - Element Plus / Vant / GSAP 独立分包
- **Brotli 压缩** - 静态资源预压缩，体积减少 70%+
- **敏感代码混淆** - 关键业务逻辑混淆保护

### CDN 缓存优化

- **精准缓存控制** - 每张图片使用独立的 `cdnTag` 版本标签
- **增量更新** - 新增图片不影响已有图片的 CDN 缓存
- **时间戳备份** - 图片首次添加时间自动记录，确保 `cdnTag` 稳定不变
- **自动化流程** - GitHub Actions 自动恢复时间戳、生成 cdnTag、构建部署

## 🚀 快速开始

### 首次运行

```bash
# 1. 克隆项目
git clone https://github.com/your-username/wallpaper-gallery.git
cd wallpaper-gallery

# 2. 安装依赖
pnpm install

# 3. 同步数据（从线上 CDN）
pnpm sync

# 4. 启动开发服务器
pnpm dev
```

### 常用命令

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm preview          # 预览构建结果

# 数据同步
pnpm sync             # 从线上 CDN 同步最新数据

# 代码质量
pnpm lint             # 检查代码规范
pnpm lint:fix         # 自动修复代码问题
pnpm test             # 运行测试
```

### 数据来源

所有壁纸数据统一从线上 CDN 拉取：
- **CDN 地址**：`https://wallpaper.061129.xyz/data`
- **数据系列**：desktop（电脑壁纸）、mobile（手机壁纸）、avatar（头像）、bing（每日 Bing）
- **更新方式**：GitHub Actions 自动部署
- **本地缓存**：数据会缓存在 `public/data` 目录，支持离线开发

## 📦 Fork 部署指南

### 快速部署（推荐）

Fork 本项目后，无需任何配置即可使用：

1. **Fork 仓库**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   ```

2. **克隆到本地**
   ```bash
   git clone https://github.com/your-username/wallpaper-gallery.git
   cd wallpaper-gallery
   ```

3. **安装依赖并同步数据**
   ```bash
   pnpm install
   pnpm sync
   ```

4. **启动开发**
   ```bash
   pnpm dev
   ```

5. **部署到 GitHub Pages**
   - 项目已配置 GitHub Actions 自动部署
   - 推送到 `main` 分支会自动触发部署
   - 或在 Actions 页面手动触发部署

### 数据说明

- ✅ **无需配置图床**：数据自动从线上 CDN 拉取
- ✅ **自动更新**：每天 UTC 18:00（北京时间次日 02:00）自动同步最新数据
- ✅ **完整数据**：包含所有壁纸、分类、元数据
- ✅ **开箱即用**：Fork 后直接可用，无需额外配置

### 可选配置

#### 启用统计功能（可选）

如果需要启用浏览量/下载量统计功能，需要配置 Supabase：

1. **创建 Supabase 项目**
   - 访问 [Supabase](https://supabase.com/) 创建免费项目
   - 获取 Project URL 和 anon public key

2. **配置 GitHub Secrets**
   - 进入仓库 **Settings** → **Secrets and variables** → **Actions**
   - 添加以下 Secrets：
     - `VITE_SUPABASE_URL`：你的 Supabase Project URL
     - `VITE_SUPABASE_ANON_KEY`：你的 Supabase anon public key

3. **创建数据库表**
   - 参考 [Fork 部署指南](docs/Fork部署指南.md) 中的 SQL 脚本

**注意**：统计功能完全可选，不配置也不影响网站正常使用。

#### 其他可选配置

详细配置请参阅 **[Fork 部署指南](docs/Fork部署指南.md)**，包含：

- ✅ 网站分析配置（Umami / Cloudflare）
- ✅ 自定义域名配置
- ✅ Cloudflare 缓存配置
- ✅ 常见问题解答

## 📁 项目结构

```text
wallpaper-gallery/
├── .github/workflows/    # GitHub Actions 配置
│   ├── deploy.yml        # 自动构建部署
│   └── export-stats.yml  # 统计数据导出
├── public/
│   └── data/             # 壁纸数据 JSON（从 CDN 同步）
│       ├── desktop/      # 电脑壁纸分类数据
│       ├── mobile/       # 手机壁纸分类数据
│       ├── avatar/       # 头像分类数据
│       ├── bing/         # 每日 Bing 壁纸数据
│       └── stats/        # 热门统计数据
├── scripts/
│   ├── sync-data.js      # 数据同步脚本（从 CDN 拉取）
│   ├── export-stats.js   # 统计数据导出脚本
│   └── supabase-migration.sql  # 数据库迁移脚本
├── docs/
│   ├── Fork部署指南.md   # Fork 用户部署指南
│   └── ...               # 其他文档
├── WORKFLOW.md           # 开发工作流程说明
├── src/
│   ├── assets/styles/    # 全局样式（Sass）
│   ├── components/       # Vue 组件
│   │   ├── common/       # 通用组件
│   │   │   ├── feedback/     # 反馈提示组件（Loading、通知、横幅等）
│   │   │   ├── form/         # 表单控件（日期选择器、下拉框、筛选面板等）
│   │   │   ├── navigation/   # 导航组件（返回顶部、分页、抽屉等）
│   │   │   └── ui/           # 基础 UI 组件（动画数字、环境徽章等）
│   │   ├── home/         # 首页组件
│   │   ├── layout/       # 布局组件
│   │   └── wallpaper/    # 壁纸相关组件
│   │       ├── PortraitWallpaperModal/  # 竖屏壁纸弹窗（手机/头像系列）
│   │       ├── WallpaperGrid/           # 壁纸网格（含骨架屏）
│   │       └── WallpaperModal/          # 横屏壁纸弹窗（电脑/Bing系列）
│   ├── composables/      # 组合式函数（useScrollLock 等）
│   ├── services/         # 服务层（统计服务等）
│   ├── stores/           # Pinia 状态管理
│   ├── router/           # Vue Router 路由配置
│   ├── views/            # 页面视图组件
│   │   └── demo/         # Demo 演示页面（IPhoneDemo、MacBookDemo）
│   └── utils/            # 工具函数和常量
└── index.html
│       ├── desktop/      # 电脑壁纸分类数据
│       ├── mobile/       # 手机壁纸分类数据
│       ├── avatar/       # 头像分类数据
│       ├── bing/         # 每日 Bing 壁纸数据
│       └── stats/        # 热门统计数据
├── scripts/
│   ├── generate-data.js  # 数据生成脚本（含 cdnTag 生成）
│   ├── export-stats.js   # 统计数据导出脚本
│   └── supabase-migration.sql  # 数据库迁移脚本
├── docs/
│   ├── Fork部署指南.md   # Fork 用户部署指南
│   └── ...               # 其他文档
├── src/
│   ├── assets/styles/    # 全局样式（Sass）
│   ├── components/       # Vue 组件
│   │   ├── avatar/       # 头像相关组件
│   │   │   ├── AvatarMakerBanner.vue      # 头像制作入口横幅
│   │   │   ├── DiyAvatarBanner.vue        # DIY 头像横幅
│   │   │   └── AvatarMakerModal/          # 头像制作弹窗
│   │   │       ├── index.vue              # 主弹窗组件
│   │   │       ├── ControlPanel.vue       # 控制面板（形状、尺寸、下载）
│   │   │       ├── CropperArea.vue        # 图片裁剪区域
│   │   │       ├── ImageSourcePanel.vue   # 图片来源面板（上传/链接）
│   │   │       └── PhonePreview.vue       # iPhone 预览组件
│   │   ├── common/       # 通用组件
│   │   ├── common/       # 通用组件
│   │   │   ├── feedback/     # 反馈提示组件（Loading、通知、横幅等）
│   │   │   ├── form/         # 表单控件（日期选择器、下拉框、筛选面板等）
│   │   │   ├── navigation/   # 导航组件（返回顶部、分页、抽屉等）
│   │   │   └── ui/           # 基础 UI 组件（动画数字、环境徽章等）
│   │   ├── home/         # 首页组件
│   │   ├── layout/       # 布局组件
│   │   └── wallpaper/    # 壁纸相关组件
│   │       ├── PortraitWallpaperModal/  # 竖屏壁纸弹窗（手机/头像系列）
│   │       ├── WallpaperGrid/           # 壁纸网格（含骨架屏）
│   │       └── WallpaperModal/          # 横屏壁纸弹窗（电脑/Bing系列）
│   ├── composables/      # 组合式函数（useScrollLock 等）
│   ├── services/         # 服务层（统计服务等）
│   ├── stores/           # Pinia 状态管理
│   ├── router/           # Vue Router 路由配置
│   ├── views/            # 页面视图组件
│   │   └── demo/         # Demo 演示页面（IPhoneDemo、MacBookDemo）
│   └── utils/            # 工具函数和常量
│       └── avatar-maker.js  # 头像制作工具函数
└── index.html
```

### 壁纸数据字段说明

每张壁纸的 JSON 数据包含以下字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一标识符 |
| `filename` | string | 文件名 |
| `category` | string | 分类名称 |
| `subcategory` | string? | 二级分类（可选） |
| `path` | string | 原图相对路径 |
| `thumbnailPath` | string | 缩略图相对路径 |
| `previewPath` | string? | 预览图相对路径（可选） |
| `size` | number | 文件大小（字节） |
| `format` | string | 图片格式（JPG/PNG） |
| `createdAt` | string | 首次添加时间（ISO 8601） |
| `cdnTag` | string? | CDN 版本标签（用于精准缓存控制） |
| `resolution` | object? | 分辨率信息（可选） |
| `tags` | string[] | 搜索标签 |

## 📱 四大系列

| 系列 | 路由 | 设备可见性 | 宽高比 | 数据来源 |
| --- | --- | --- | --- | --- |
| 电脑壁纸 | `/desktop` | PC 端 | 16:10 | 自有图床 |
| 手机壁纸 | `/mobile` | 移动端 | 9:16 | 自有图床 |
| 头像 | `/avatar` | 全设备 | 1:1 | 自有图床 |
| 每日 Bing 壁纸 | `/bing` | 全设备 | 16:9 | Bing CDN |

- PC 端显示：电脑壁纸 + Bing + 头像
- 移动端显示：手机壁纸 + Bing + 头像

## 🎯 性能优化

- **CDN 外部化** - Vue / Vue Router / vue-demi 通过 unpkg CDN 加载
- **CSS 内联** - 关键 CSS 内联到 HTML，加快首屏渲染
- **CLS 优化** - 图片占位符、滚动条预留空间，避免布局偏移
- **图片优化** - WebP 格式、缩略图预生成、懒加载、首屏图片高优先级加载
- **代码分割** - 路由级别代码分割，按需加载；Element Plus / Vant / GSAP 独立分包
- **预连接** - DNS 预解析、预连接到 CDN 域名（jsDelivr、Bing CDN、图片代理服务）
- **Brotli 压缩** - 静态资源预压缩，体积减少 70%+
- **2K/4K 大屏适配** - 容器最大宽度递增（1600/2000/2400px）
- **Cloudflare 缓存** - 部署后自动清除缓存，确保用户及时获取更新
- **Web Worker** - 大数据解码在 Worker 线程执行，避免阻塞主线程
- **分类按需加载** - 首屏只加载前3个分类，剩余分类后台加载
- **移动端性能优化** - 移除 backdrop-filter 模糊效果，提升滚动流畅度
- **路由守卫精简** - 从 ~80 行简化到 ~30 行，减少不必要的计算
- **内存泄漏修复** - 头像制作弹窗完善资源清理机制，防止 Image 对象和 Cropper 实例泄漏

## 📊 SEO 优化

- **结构化数据** - Schema.org 标记，增强搜索引擎理解
- **Sitemap** - 自动生成站点地图
- **搜索引擎提交** - 支持百度主动推送、Google Search Console

## ☕ 赞赏支持

如果这个项目对你有帮助，欢迎请作者喝杯咖啡 ☕

本项目完全开源免费，所有壁纸资源均可自由使用。维护开源项目需要投入大量时间和精力，你的支持是我持续更新的动力！

<p align="center">
  <img src="docs/sponsor-alipay.png" width="300" alt="支付宝" />
  <img src="docs/sponsor-wechat.png" width="300" alt="微信支付" />
</p>

感谢每一位支持者 ❤️

## 📄 License

MIT
