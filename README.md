# Wallpaper Gallery

一个高雅大气的壁纸展示网站，基于 Vue 3 + Vite 7 构建。

## 特性

### 核心功能

- **高清壁纸展示** - 支持 4K 及更高分辨率壁纸
- **智能搜索** - 实时搜索建议、关键词高亮、回车确认搜索
- **多种排序** - 按时间、大小、名称排序
- **格式筛选** - 按 JPG/PNG 格式筛选
- **一键下载** - 直接下载原图

### 视图与浏览

- **多视图模式** - 网格视图、列表视图、瀑布流视图自由切换
- **全屏浏览** - 沉浸式全屏浏览模式，ESC 退出
- **无限滚动** - 智能分页加载，滚动自动加载更多
- **今日精选** - 每日随机推荐精选壁纸

### 用户体验

- **主题切换** - 深色/浅色主题，自动跟随系统
- **响应式设计** - 完美适配桌面端和移动端
- **流畅动画** - GSAP 驱动的精致过渡动画
- **回到顶部** - 平滑滚动回到页面顶部
- **本地缩略图** - 预生成 WebP 缩略图，首页加载更快

## 技术栈

- **框架**: Vue 3.5 (Composition API + script setup)
- **构建工具**: Vite 7
- **UI 组件**: Element Plus
- **动画**: GSAP
- **样式**: Sass
- **部署**: GitHub Pages + GitHub Actions

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生成壁纸数据
npm run generate

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 部署

项目配置了 GitHub Actions 自动部署：

1. 推送代码到 `main` 分支
2. GitHub Actions 自动构建并部署到 GitHub Pages
3. 访问 `https://<username>.github.io/wallpaper-gallery/`

### 首次部署配置

1. 进入仓库 **Settings** → **Pages**
2. **Source** 选择 **GitHub Actions**
3. 推送代码触发部署

## 项目结构

```text
wallpaper-gallery/
├── .github/workflows/    # GitHub Actions 配置
├── public/
│   └── data/            # 壁纸数据 JSON（构建时生成）
├── scripts/
│   └── generate-data.js # 数据生成脚本
├── src/
│   ├── assets/styles/   # 全局样式（Sass）
│   ├── components/      # Vue 组件
│   │   ├── common/      # 通用组件（搜索、筛选、回到顶部等）
│   │   ├── home/        # 首页组件（今日精选）
│   │   ├── layout/      # 布局组件（头部、底部）
│   │   └── wallpaper/   # 壁纸相关组件
│   ├── composables/     # 组合式函数
│   └── utils/           # 工具函数
└── index.html
```

## 数据源

壁纸数据来自 [IT-NuanxinPro/nuanXinProPic](https://github.com/IT-NuanxinPro/nuanXinProPic) 图床仓库。

### 图片加载策略

| 场景 | 图片来源 | 说明 |
| --- | --- | --- |
| 首页列表 | `thumbnail/` 目录 | WebP 格式缩略图，400px 宽，加载快速 |
| 今日精选 | `wallpaper/` 目录 | 原图展示，21:9 宽屏比例 |
| 详情预览 | `wallpaper/` 目录 | 原图，支持下载 |

**降级策略**：缩略图加载失败时自动切换到 [wsrv.nl](https://wsrv.nl) 代理服务生成缩略图，确保图片始终可用。

缩略图由图床仓库的 GitHub Actions 自动生成，无需依赖第三方图片代理服务。

## License

MIT
