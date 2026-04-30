<div align="center">
  <img src="https://wallpaper.061129.xyz/favicon.svg" width="120" height="120" alt="Wallpaper Gallery Logo" />
  <h1>Wallpaper Gallery</h1>
  <p>一个专注精选 4K 高清壁纸质感与浏览体验的壁纸项目，覆盖电脑、手机、头像、动态壁纸与每日 Bing 壁纸场景</p>

  <p>
    <a href="https://wallpaper.061129.xyz"><img src="https://img.shields.io/badge/Deployed_with-Cloudflare_Pages-f38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages"></a>
    <img src="https://img.shields.io/badge/Vue-3.5-4fc08d?style=flat-square&logo=vue.js&logoColor=white" alt="Vue 3">
    <img src="https://img.shields.io/badge/Vite-7.0-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite 7">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License">
  </p>
  
  <p>
    <a href="https://wallpaper.061129.xyz" target="_blank">🌐 访问体验站</a> | 
    <a href="https://zread.ai/IT-NuanxinPro/wallpaper-gallery" target="_blank">项目文档在线解析</a> |
    <a href="https://wallpaper-gallery-architecture.061129.xyz/" target="_blank">🏗️ 架构在线文档</a> |
    <a href="https://linux.do" target="_blank">🤝 鸣谢社区 LINUX DO</a> |
    <a href="#-特性">✨ 功能亮点</a> | 
    <a href="#-技术栈">🛠️ 技术栈实现</a>
  </p>
</div>

> 不追求内容堆砌，也不与鱼龙混杂的壁纸站混在一起。  
> 更看重精选、清晰度、系列划分与完整浏览体验。

## ✨ 特性

适合直接使用，也适合作为个人内容站、壁纸站或前端展示项目继续扩展。

### 🎨 核心功能

- **高清壁纸展示** - 支持 16K/8K/5K/4K 及更高分辨率壁纸
- **五大系列** - 电脑壁纸、手机壁纸、头像、动态壁纸、每日 Bing 壁纸
- **部署友好** - 默认可直接 fork、同步线上数据并部署，无需先搭建图床
- **账号体系与个人中心** - 支持登录、注册、认证回调、账号资料查看与安全设置
  - 支持 `GitHub`、`Google`、`Linux.do` OAuth 登录
  - 支持邮箱密码登录、启用密码、更新密码
  - 支持第三方账号绑定 / 解绑与头像同步
  - 第三方授权跳转与邮箱注册完成后都会切换到专属的 Auth Flow Panel，提供「正在跳转」「验证邮件已发送」「授权失败」等清晰提示，避免误触。
- **个人壁纸库（Library）** - 提供 `收藏夹` 与 `我的喜欢` 两个独立入口
  - 支持跨系列聚合查看与筛选
  - 移动端仅展示手机壁纸与头像分区
  - 卡片操作会根据当前 tab 自动收口，减少误操作
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
- **动态壁纸专区** - 提供视频壁纸独立路由与详情弹窗
  - 支持视频元数据展示、循环播放与下载
  - 视频资源优先走 `img.061129.xyz`，避免大文件依赖 GitHub CDN
  - 电脑动态壁纸、手机动态壁纸、朋友圈封面三类内容统一归档到 `video` 系列
  - 通过 `category=desktop / mobile / social-cover` 区分具体子系列
  - 三类动态壁纸统一复用现有筛选、路由与用户交互体系
- **智能裁剪与真机预览** - 电脑壁纸支持智能裁剪；手机壁纸与头像支持真机显示模式
  - 自动适配屏幕分辨率，提供多种比例预设与自定义尺寸
  - 支持实时预览、沉浸式全屏预览与高质量导出
  - 手机壁纸与头像系列统一支持 iPhone 外观预览
- **智能搜索** - 实时搜索建议、关键词高亮、回车确认搜索
- **热门模块** - 首页按系列展示热门分类与热门关键词
  - 热门分类点击后直接切换筛选
  - 热门关键词点击后直接进入搜索
  - 桌面端支持悬停预览热门标签关联壁纸
  - 移动端支持紧凑栅格布局与展开 / 收起
- **Bing 搜索优化** - 针对 Bing 系列做专门交互处理
  - 月份热门词点击后直接切换月份
  - 中文单图热门词点击后直接定位对应壁纸
  - 手动搜索时自动取消当前月份限制
  - 清空搜索后恢复到当前月份浏览状态
- **多种排序** - 按时间、热门、大小、名称排序
- **动态分类** - 自动从壁纸数据中提取分类，按数量排序
- **格式筛选** - 按 JPG/PNG 格式筛选
- **分辨率筛选** - 仅电脑壁纸系列支持，按 16K/8K/5K+/4K+/4K/2K/超清/高清/标清精确筛选
- **一键下载** - 图片下载原图，视频下载原始视频文件
- **喜欢 / 收藏交互** - 登录后支持即时标记与跨页面状态同步
  - 首页卡片提供始终可见的状态角标
  - 首页筛选栏内显示 `已喜欢` / `已收藏` 汇总
  - 操作成功和取消操作均有明确提示反馈

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
  - 收藏夹仅保留手机壁纸 / 头像标签，更符合移动端使用场景
- **用户偏好记忆** - 记住用户的系列选择、排序方式、视图模式
- **本地缩略图** - 预生成 WebP 缩略图，首页加载更快
- **深色模式细节补齐** - 手机壁纸弹窗、头像弹窗、标签与操作状态统一适配深色主题
- **认证反馈面板** - OAuth 跳转前后使用 Lottie Loading / Success 面板、注册后显示邮箱验证提示，PC 与移动端都能第一时间获知登录是否成功。

### 📊 数据统计

- **浏览量统计** - 记录每张壁纸的浏览次数
- **下载量统计** - 记录每张壁纸的下载次数
- **用户交互统计** - 记录喜欢数、收藏数，并在首页与 Library 中回显
- **热门排序** - 基于浏览量的热门壁纸排序
- **热门轮播** - 首页展示最受欢迎的壁纸
- **热门标签导出** - 基于浏览量、下载量与系列数据生成热门分类 / 热门关键词
- **Supabase 后端** - 使用 Supabase 存储统计、认证与用户交互数据，支持原子递增

### 🌱 使用体验

- **默认可运行** - Fork 后同步一次线上数据即可本地启动
- **文档齐全** - 提供 Fork 部署指南、统计系统说明与架构页
- **渐进增强** - 不配置 Supabase 时仍可浏览壁纸；配置后可启用登录、收藏、喜欢与个人壁纸库
- **适合二开** - 组件、stores、services 与 utils 已按职责拆分

## 🎯 项目定位

- 面向个人壁纸站、内容展示站和开源作品集场景。
- 优先保证视觉体验、浏览性能和 fork 后可维护性。
- 当前仓库同时包含前端展示、数据同步、热门标签导出与统计接入能力。

### 🧭 路由与导航

- **智能重定向** - 首次访问根据设备类型自动跳转到推荐系列
- **偏好优先** - 用户明确选择的系列优先于设备推荐
- **循环检测** - 防止路由守卫产生无限循环
- **历史优化** - 使用 replace 避免污染浏览历史
- **账户路由** - 新增 `/login`、`/signup`、`/auth/callback`、`/account`、`/library`

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
| 部署 | Cloudflare Pages (全球分发)|
| CI/CD | GitHub Actions (高性能构建)|
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
pnpm build:seo        # 构建并生成预渲染 SEO 页面
pnpm preview          # 预览构建结果

# 数据同步
pnpm sync             # 从线上 CDN 同步最新数据
pnpm export:hot-tags  # 导出热门标签数据

# 代码质量
pnpm lint             # 检查代码规范
pnpm lint:fix         # 自动修复代码问题
pnpm test             # 运行测试
```

### 数据来源

所有壁纸数据统一从线上 CDN / 图床仓库导出结果拉取：
- **CDN 地址**：`https://wallpaper.061129.xyz/data`
- **数据系列**：desktop（电脑壁纸）、mobile（手机壁纸）、avatar（头像）、video（动态壁纸）、bing（每日 Bing）
- **动态壁纸子系列**：`video/desktop`（电脑动态壁纸）、`video/mobile`（手机动态壁纸）、`video/social-cover`（朋友圈封面）
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

5. **部署到 Cloudflare Pages**
   - 项目已配置 GitHub Actions + Cloudflare Pages 自动部署
   - 推送到 `main` 分支会自动触发部署
   - 或在 Actions 页面手动触发部署

### 数据说明

- ✅ **无需配置图床**：数据自动从线上 CDN 拉取
- ✅ **自动更新**：每天 UTC 18:00（北京时间次日 02:00）自动同步最新数据
- ✅ **完整数据**：包含所有壁纸、分类、元数据
- ✅ **热门标签数据**：包含热门分类与热门关键词统计，可直接用于首页热门模块
- ✅ **开箱即用**：Fork 后直接可用，无需额外配置

### 可选配置

#### 启用登录、喜欢 / 收藏与统计功能（可选）

如果需要启用账号登录、个人中心、收藏夹、我的喜欢，以及浏览量 / 下载量统计，需要配置 Supabase：

1. **创建 Supabase 项目**
   - 访问 [Supabase](https://supabase.com/) 创建免费项目
   - 获取 Project URL、anon public key 和 service role key

2. **配置 GitHub Secrets**
   - 进入仓库 **Settings** → **Secrets and variables** → **Actions**
   - 添加以下 Secrets：
     - `VITE_SUPABASE_URL`：你的 Supabase Project URL
     - `VITE_SUPABASE_ANON_KEY`：你的 Supabase anon public key
     - `SUPABASE_SERVICE_ROLE_KEY`：用于同步壁纸资源与后台任务，请勿暴露到前端

3. **创建数据库表**
   - 参考 [Fork 部署指南](docs/Fork部署指南.md) 中的 SQL 脚本

4. **本地开发环境变量**
   - 可参考 `.env.example`
   - 本地启用账号能力时需要配置：
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - 本地执行 `pnpm sync:assets` 时额外需要：
     - `SUPABASE_SERVICE_ROLE_KEY`

5. **执行前确认数据源是最新的**
   - `pnpm sync:assets` 会把当前 `public/data` 解析出的全部资产全量 `upsert` 到远端 `wallpaper_assets`
   - 动态壁纸同步到远端时统一使用 `series='video'`，再通过 `category` 标记 `desktop / mobile / social-cover`
   - 这不是“只补新增”的脚本，错误或过旧的本地 `public/data` 会覆盖远端元数据
   - 推荐做法：
     - 先执行 `pnpm sync` 或使用 CI 从最新 `nuanXinProPic/data` 拷贝数据
     - 再执行 `pnpm sync:assets`
   - 如果你只是想排查线上数据库状态，优先做只读查询，不要直接执行同步脚本

**注意**：这些能力都是渐进增强，不配置也不影响网站基础浏览与下载。

#### 其他可选配置

详细配置请参阅 **[Fork 部署指南](docs/Fork部署指南.md)**，包含：

- ✅ 网站分析配置（Umami / Cloudflare）
- ✅ 自定义域名配置
- ✅ Cloudflare 缓存配置
- ✅ 常见问题解答

## 📁 项目结构

```text
wallpaper-gallery/
├── .github/workflows/        # GitHub Actions 配置
│   ├── deploy.yml            # 自动构建部署
│   └── export-stats.yml      # 统计数据导出
├── public/
│   └── data/                 # 壁纸数据 JSON（从 CDN 同步）
│       ├── desktop/          # 电脑壁纸分类数据
│       ├── mobile/           # 手机壁纸分类数据
│       ├── avatar/           # 头像分类数据
│       ├── video/            # 动态壁纸分类数据
│       │   ├── desktop.json  # 电脑动态壁纸
│       │   ├── mobile.json   # 手机动态壁纸
│       │   └── social-cover.json # 朋友圈封面
│       ├── bing/             # 每日 Bing 壁纸数据
│       └── stats/            # 热门统计数据
├── scripts/
│   ├── config/               # 脚本配置
│   ├── sync-data.js          # 数据同步脚本（从 CDN 拉取）
│   ├── export-stats.js       # 统计数据导出脚本
│   ├── export-hot-tags.js    # 热门标签导出脚本
│   ├── supabase-init.sql     # 新项目一键初始化 SQL
│   ├── supabase-migration.sql      # 统计结构迁移脚本
│   └── supabase-retire-legacy.sql  # 旧结构下线脚本
├── docs/
│   ├── Fork部署指南.md       # Fork 用户部署指南
│   ├── Supabase统计系统.md   # Supabase 统计架构说明
│   └── ...
├── WORKFLOW.md               # 开发工作流程说明
├── src/
│   ├── assets/styles/        # 全局样式（Sass）
│   ├── components/
│   │   ├── avatar/           # 头像相关组件
│   │   │   ├── DiyAvatarBanner.vue       # DIY 头像横幅
│   │   │   └── AvatarMakerModal/         # 头像制作弹窗
│   │   │       ├── index.vue             # 主弹窗
│   │   │       ├── composables/          # 弹窗业务逻辑（useAvatarMakerWorkflow）
│   │   │       ├── panel/               # 控制面板
│   │   │       ├── preview/             # iPhone 预览
│   │   │       ├── shared/              # 裁剪区域等共享组件
│   │   │       └── source/              # 图片来源面板
│   │   ├── common/
│   │   │   ├── feedback/     # 反馈组件（Loading、通知、横幅）
│   │   │   ├── form/         # 通用表单控件
│   │   │   ├── navigation/   # 导航组件（返回顶部、分页）
│   │   │   └── ui/           # 基础 UI 组件（WallpaperSeriesIcon 等）
│   │   ├── login/            # 登录体验与认证场景
│   │   │   ├── AuthExperience.vue       # 登录 / 注册统一体验页
│   │   │   └── LoginCharacterScene.vue  # 登录动效场景
│   │   ├── home/             # 首页组件
│   │   │   ├── HomeModalHost.vue         # 弹窗宿主
│   │   │   ├── MobileSeriesNotice.vue    # 移动端系列提示
│   │   │   └── HotTagsPanel.vue          # 热门标签面板
│   │   ├── layout/
│   │   │   ├── AppHeader.vue             # 顶栏主组件
│   │   │   └── header/
│   │   │       ├── mobile/              # 移动端抽屉、搜索弹窗
│   │   │       └── theme/               # 主题切换器
│   │   ├── search/           # 搜索模块
│   │   │   ├── index.vue                # 搜索栏主组件
│   │   │   ├── composables/             # useSearchSuggestions
│   │   │   └── shared/                  # 搜索建议面板
│   │   └── wallpaper/        # 壁纸相关组件
│   │       ├── card/                    # 壁纸卡片（CardInfo、CardMedia）
│   │       ├── crop/                    # 智能裁剪（7 个子组件）
│   │       ├── filter/                  # 筛选系统
│   │       │   ├── index.vue            # 筛选主组件
│   │       │   ├── desktop/             # 桌面端筛选控件
│   │       │   ├── mobile/              # 移动端筛选栏与弹窗
│   │       │   ├── fields/              # 日期选择器、分类下拉框
│   │       │   └── shared/              # FilterSummary、ViewModeToggle
│   │       ├── PortraitWallpaperModal/  # 竖屏壁纸弹窗
│   │       │   ├── desktop/             # 桌面端弹窗
│   │       │   ├── mobile/              # 移动端弹窗
│   │       │   └── shared/              # 共享组件（PhoneFrame、ModalInfo 等）
│   │       ├── WallpaperGrid/           # 壁纸网格
│   │       │   ├── index.vue            # 网格主组件
│   │       │   ├── composables/         # 动画、分页、触摸模式
│   │       │   └── shared/              # 空状态、加载状态
│   │       └── WallpaperModal/          # 横屏壁纸弹窗
│   │           ├── desktop/             # 桌面端弹窗
│   │           └── shared/              # BingWallpaperInfo
│   ├── composables/          # 组合式函数
│   │   ├── header/           # useHeaderNavSlider
│   │   ├── home/             # useHomeDataLoader、useHomeSeriesSync、useWallpaperNavigator
│   │   ├── useInteraction.js # 壁纸喜欢 / 收藏交互封装
│   │   ├── useDevice.js      # 设备检测
│   │   ├── useTheme.js       # 主题管理
│   │   ├── useViewMode.js    # 视图模式
│   │   ├── useScrollLock.js  # 滚动锁定
│   │   └── ...
│   ├── services/             # 服务层
│   │   ├── interactionService.js        # 喜欢 / 收藏 / Library 数据服务
│   │   ├── userActivityService.js       # 用户行为相关服务
│   │   └── wallpaper/                  # 壁纸数据获取与解码
│   ├── stores/               # Pinia 状态管理
│   │   ├── auth.js           # 用户认证与资料状态
│   │   ├── interaction.js    # 喜欢 / 收藏 / 统计状态
│   │   └── ...
│   ├── router/               # Vue Router 路由配置
│   ├── views/                # 页面视图
│   │   ├── Home.vue          # 首页
│   │   ├── About.vue         # 关于页
│   │   ├── Login.vue         # 登录页
│   │   ├── Signup.vue        # 注册页
│   │   ├── AuthCallback.vue  # 认证回调页
│   │   ├── Account.vue       # 账号中心
│   │   ├── Library.vue       # 收藏夹 / 我的喜欢
│   │   └── NotFound.vue      # 404 页
│   ├── workers/              # Web Worker
│   └── utils/                # 工具函数（按领域分类）
│       ├── auth/             # 认证与身份工具
│       ├── avatar/           # 头像制作工具
│       ├── cache/            # LRU 缓存
│       ├── common/           # 通用工具（analytics、codec、format、sorting）
│       ├── config/           # 常量配置
│       ├── filter/           # 筛选默认值
│       ├── integrations/     # 第三方集成（Supabase）
│       ├── platform/         # 平台适配（flexible）
│       └── wallpaper/        # 壁纸相关（errors、transformers）
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

### 热门标签数据说明

热门模块数据位于 `public/data/stats/hot-tags-*.json`，按系列拆分：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `tag` | string | 标签文本 |
| `score` | number | 综合热度分数 |
| `views` | number | 浏览量 |
| `downloads` | number | 下载量 |
| `wallpaperCount` | number | 关联壁纸数量 |
| `series` | string[] | 标签所属系列 |
| `topWallpapers` | string[] | 热门预览壁纸文件名列表 |

说明：
- 电脑 / 手机 / 头像系列中，热门分类会优先映射到分类筛选，其他标签进入搜索。
- Bing 系列中，月份标签会映射到月份筛选，单图中文标签会直接定位到对应壁纸。
- Bing 手动搜索时会自动取消当前月份限制；清空搜索后再恢复到当前月份。
- 热门标签数据可通过 `pnpm export:hot-tags` 重新导出。

## 📱 五大系列

| 系列 | 路由 | 设备可见性 | 宽高比 | 数据来源 |
| --- | --- | --- | --- | --- |
| 电脑壁纸 | `/desktop` | PC 端 | 16:10 | 自有图床 |
| 动态壁纸 | `/video` | PC / 平板优先 | 16:9 / 9:16 | 图床导出 + R2 资源 |
| 手机壁纸 | `/mobile` | 移动端 | 9:16 | 自有图床 |
| 头像 | `/avatar` | 全设备 | 1:1 | 自有图床 |
| 每日 Bing 壁纸 | `/bing` | PC / 平板优先 | 16:9 | Bing CDN |

- PC 端显示：电脑壁纸 + 动态壁纸 + Bing + 手机壁纸 + 头像
- 平板端显示：电脑壁纸 + 动态壁纸 + Bing + 手机壁纸 + 头像
- 移动端默认显示：手机壁纸 + 头像
- Bing、动态壁纸和电脑壁纸在移动端可通过直达路由访问，但界面会给出大屏浏览提示
- 动态壁纸系列下再细分为：电脑、手机、朋友圈封面三个子系列

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
- **高性能混合构建** - 移除 Cloudflare 侧冗余的 Git 克隆逻辑，利用 GitHub Actions 强力算力同步图床数据，缩短构建耗时 80%。
- **无感 CDN 刷新** - 部署成功后 Cloudflare 自动完成全球节点缓存刷新。

## 📊 SEO 优化

- **结构化数据** - Schema.org 标记，增强搜索引擎理解
- **Sitemap** - 自动生成站点地图
- **搜索引擎提交** - 支持百度主动推送、Google Search Console
- **SPA 路由优化** - 通过 Cloudflare _redirects 解决单页应用刷新 404 问题，确保所有路径返回 200 OK，极大地提升搜索引擎抓取成功率。
- **全球边缘加速** - 基于 Cloudflare 全球网络，首屏加载速度提升 50% 以上。
 
## ☕ 赞赏支持

如果这个项目对你有帮助，欢迎请作者喝杯咖啡 ☕

本项目完全开源免费，所有壁纸资源均可自由使用。维护开源项目需要投入大量时间和精力，你的支持是我持续更新的动力！

感谢每一位支持者 ❤️

## 📄 License

MIT
