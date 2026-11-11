<div align="center">
  <img src="https://wallpaper.061129.xyz/favicon.svg" width="96" height="96" alt="Wallpaper Gallery Logo" />
  <h1>Wallpaper Gallery</h1>
  <p>电脑壁纸、手机壁纸、头像、动态壁纸与每日 Bing 壁纸的浏览、预览与收藏工具。</p>
  <p>
    <a href="https://wallpaper.061129.xyz/">在线体验</a> ·
    <a href="docs/README.md">项目文档</a> ·
    <a href="https://github.com/IT-NuanxinPro/wallpaper-gallery/releases">版本记录</a> ·
    <a href="https://github.com/IT-NuanxinPro/wallpaper-gallery/releases/tag/desktop">桌面客户端下载</a>
  </p>
</div>

本文于 **2026-11-11** 按网站 **v5.5.0 工作区**更新；发布状态以 GitHub Releases 为准。网站与桌面安装包分别版本化，当前桌面清单为 **v5.3.0**。

## 功能

- 五个壁纸系列，所有设备均可访问；电脑横图、手机竖图、头像方图分别展示。
- 点击卡片进入真实详情页，独立“预览”入口保留快速查看；分享地址可直接访问、刷新和新标签页打开。
- 分类、排序、关键词、格式与分辨率筛选按系列提供；热门标签支持分类定位与 Bing 历史图片精确搜索。
- 各壁纸分类共用公告、介绍和热门标签，只切换下方内容；列表按需追加，返回详情前的列表时恢复筛选和滚动位置。
- 详情支持笔记本、平板、双折叠、三折叠、带鱼屏、本机比例和重播，手机系列使用独立设备工具栏；头像详情为方形。“继续发现”只显示图片，沿用各系列比例。
- 动态视频静音循环播放，实际播放前显示统一加载动画，拒播或失败时可重试。动态列表目前只展示电脑用途，其他用途的既有分享链接保留。
- 详情实时读取浏览、喜欢、收藏、下载汇总，成功互动后刷新；加载失败或无统计记录显示 `—`，真实零显示 `0`。
- 新增公开主页，账号本人可选择公开收藏/喜欢，并关注其他已公开用户；旧资料默认保持私人。
- 登录、个人中心、喜欢与收藏夹；GitHub、Google、Linux.do 等登录方式取决于部署方的 Supabase 配置。
- 原图下载、电脑静态图片裁剪、头像制作，以及浅色、深色、跟随系统和定时主题。
- 桌面客户端提供受支持静态图片的系统壁纸设置、本地图片管理与保存目录选择，具体能力由安装包和操作系统决定。

## 系列与路由

| 系列 | 路由 | 列表及推荐图比例 | 资源来源 |
| --- | --- | --- | --- |
| 电脑壁纸 | `/desktop`，首页 `/` 同样展示电脑系列 | 16:10 | 图床仓库 |
| 手机壁纸 | `/mobile` | 9:16 | 图床仓库 |
| 头像 | `/avatar` | 1:1 | 图床仓库 |
| 每日 Bing | `/bing` | 16:9 | Bing 官方图片服务 |
| 动态壁纸 | `/video` | 电脑视频 16:9 | R2 图片与视频域名 |

详情路由为 `/wallpaper/{token}`。首页不会按设备自动跳转，卡片裁切比例不代表原文件分辨率。

Bing 预览请求 `1920x1080`，下载使用 `UHD`；当前列表与详情共用 3840 × 2160 的 UHD 请求规格，保留已有明确尺寸。其他图片依据自身元数据展示，不把所有壁纸都标成 4K。

## 本地运行

使用 Node.js 22 和 pnpm 9，与 CI 保持一致。

```sh
git clone https://github.com/IT-NuanxinPro/wallpaper-gallery.git
cd "wallpaper-gallery"
pnpm install --frozen-lockfile
pnpm dev
```

仓库已有 `public/data`，可以直接启动。需要拉取最新图床元数据时执行 `pnpm sync`；它会覆盖本地数据并重新生成详情目录，不会同步数据库。

可参考 [环境变量示例](.env.example) 创建 `.env.local`。不配置 Supabase 仍可浏览图片；登录、账号互动和实时单图统计依赖对应服务。`VITE_*` 会进入浏览器构建，禁止用它存放服务端密钥。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | Vite 本地开发，默认端口 5173 |
| `pnpm sync` | 从图床 GitHub Raw 同步元数据，更新详情 |
| `pnpm build:metadata` / `pnpm generate:details` | 生成详情桶、系列推荐目录与 sitemap |
| `pnpm test` | Vitest 回归检查 |
| `pnpm lint` | 检查代码规范 |
| `pnpm build:seo` | 生成元数据、生产构建和公共页预渲染，正式部署使用此命令 |
| `pnpm preview` | 预览 Vite 构建及本地图片入口，不模拟详情边缘函数 |
| `pnpm export:hot-tags` | 根据本地元数据和统计快照生成热门标签 |

`pnpm sync:assets` 会写入远程资源表并将缺失资源标记移除，是维护操作，不是日常启动命令。它需要完整最新数据及服务端权限，详见 [部署指南](docs/Fork部署指南.md)。

## 数据与统计

- 元数据来自 [nuanXinProPic](https://github.com/IT-NuanxinPro/nuanXinProPic)；普通系列读取 `data/`，Bing 读取 `bing/meta/`。图片资源并未打包到本仓库。
- 列表先展示最新切片，再补齐完整分类；Bing 按年份加载。筛选和非默认排序等待所需数据完整，避免只对切片给出结果。
- 静态资源身份使用完整规范路径，Bing 使用日期键；`displayTitle` 只负责展示，不能通过改文件名修复显示文字。
- 缩略图、预览图默认走本站 `/images/`，固定代理公开图源；Bing 和视频保持独立来源。
- 列表排名优先使用完整统计快照；详情按当前资源键读取 Supabase 公开聚合视图。
- 浏览是有效预览次数，下载是已发起次数，均不等于独立人数；收藏数量也不直接称为去重人数。完整定义见 [统计口径](docs/统计口径与迁移.md)。

## 部署与搜索

网站由 GitHub Actions 构建并发布至 Cloudflare Pages，包含静态页面和 Pages Functions：

| 路径 | 服务方式 |
| --- | --- |
| 首页、分类及关于 | 构建时预渲染 |
| `/wallpaper/*` | 边缘详情正文、标题、canonical、结构化数据 |
| `/images/*` | 固定图源图片入口 |
| `/api/desktop-release` | 桌面安装包清单 |

无效或不存在的详情返回真实 404，临时读取失败返回 503；不使用全站 `/* → 200` 重写。可抓取页面和 sitemap 是收录基础，不保证 Google 或百度立即收录。

Fork 不会继承 Cloudflare、Supabase 或 OAuth 设置。默认部署工作流含数据库资源同步与统计导出，**不能只填 Cloudflare 凭据就直接运行全部步骤**。完整配置见 [Fork 部署指南](docs/Fork部署指南.md)。

网站版本由 `package.json` 和构建生成的 `public/version.json` 管理；安装包清单为 `public/desktop-release.json`，原生代码和构建位于 [Pake](https://github.com/IT-NuanxinPro/Pake)。网页更新不必重建安装包。

## 技术与目录

Vue 3.5、Vue Router 4、Pinia、Vite 7、Element Plus、Vant、GSAP、Sass、Supabase 和 Cloudflare Pages。Vue 等启动依赖随站点构建，不依赖外部 CDN 脚本启动。

```text
src/views/                 页面与共享浏览布局
src/components/            卡片、预览、筛选、详情操作和通用反馈
src/composables/            浏览恢复、媒体加载、下载与统计生命周期
src/services/              数据、认证、互动与平台接口
src/stores/                Pinia 状态与系列缓存
src/utils/                 资源身份、媒体规格、统计和 SEO 规则
server/                    边缘函数共享处理逻辑
functions/                 Pages Functions 入口
build/                     Vite 插件
scripts/                   数据生成、导出与数据库维护
public/data/               元数据、详情目录与统计快照
.github/workflows/         网站、版本、桌面和统计工作流
docs/                      当前指南与历史版本说明
```

维护入口见 [文档索引](docs/README.md)。最新变更见 [GitHub Releases](https://github.com/IT-NuanxinPro/wallpaper-gallery/releases)。

## 许可与致谢

代码采用 [MIT License](LICENSE)。第三方壁纸、头像、视频及 Bing 内容的授权独立于代码许可，不能据此推断可自由再分发或商用，详见 [版权与内容说明](COPYRIGHT.md)。

感谢开源依赖维护者、内容创作者和 [LINUX DO](https://linux.do/) 社区的反馈与支持。
