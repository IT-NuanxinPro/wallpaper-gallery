# 项目文档

校对日期：2026-11-11。适用网站 v5.5.0 工作区、桌面清单 v5.3.0；是否已发布以 [GitHub Releases](https://github.com/IT-NuanxinPro/wallpaper-gallery/releases) 为准。

## 当前维护文档

| 文档 | 解决的问题 |
| --- | --- |
| [项目说明](../README.md) | 功能、路由、本地运行和主要代码入口 |
| [Fork 部署指南](Fork部署指南.md) | Cloudflare、GitHub Actions、域名和 Supabase 配置边界 |
| [Supabase 统计系统](Supabase统计系统.md) | 当前表、事件写入、单图读取和快照链路 |
| [统计口径与迁移](统计口径与迁移.md) | 指标含义、完整资源身份、历史迁移限制 |
| [图片入口部署](图片入口部署.md) | `/images/` 路径、原图与预览限制、缓存和回退 |
| [Umami 统计系统](Umami统计系统.md) | 网站分析配置、真实调用事件及调试边界 |
| [Vite 自定义插件](vitePLugin.md) | 当前启用插件与停用的 CDN 注入逻辑 |
| [版权与内容说明](../COPYRIGHT.md) | 代码许可与第三方媒体授权的区别 |

## 版本历史与本地过程文件

版本说明统一查看 [GitHub Releases](https://github.com/IT-NuanxinPro/wallpaper-gallery/releases)。

`output/`、`docs/releases/` 和 `docs/superpowers/` 是本地验证产物、发布草稿和开发过程文档，已从仓库跟踪范围移除。本地文件继续保留；它们不作为开源项目的部署入口。

发布流水线在没有本地版本说明时自动生成新 Release 的说明，已有 Release 的正文保持不变。

[旧架构展示页](wallpaper-gallery-architecture/index.html) 是独立 HTML 文档，其线上副本不会随主站 Markdown 自动更新。它未在本轮重写，不作为当前配置依据，也不直接删除。

`COPYRIGHT.md` 和数据库迁移、回滚 SQL 继续维护在仓库中。

## 后续维护

- 功能或路由调整：同步项目说明及相关专题指南。
- 发布版本：在 GitHub Release 维护版本说明，核对网站与安装包版本范围。
- 数据库或接口改变：同时更新系统结构和指标口径，区分源码约定与实际线上审计结果。
- 本地计划、截图与验证输出保持在忽略目录中，不加入公开仓库。
