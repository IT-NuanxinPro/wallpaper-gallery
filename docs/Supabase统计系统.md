# Supabase 统计系统

校对日期：2026-11-11，适用网站 v5.5.0 工作区。指标含义与历史数据边界见 [统计口径与迁移](统计口径与迁移.md)。

## 当前链路

| 用途 | 当前实现 |
| --- | --- |
| 浏览、下载写入 | `record_wallpaper_event` RPC，事件 ID 幂等与会话预览去重 |
| 资源目录 | `wallpaper_assets`，按规范完整 `asset_key` 关联 |
| 累计统计 | `image_stats`，唯一维度为 `(series, image_id)` |
| 事件与期间统计 | `wallpaper_stat_events`、`wallpaper_daily_stats`、`wallpaper_stats_config` |
| 喜欢 | `user_wallpaper_likes`，账号与资源关系 |
| 收藏 | `user_collections`、`user_collection_items`，账号的收藏夹及条目 |
| 下载历史 | `user_download_history`，登录用户有效下载事件由服务端同事务写入 |
| 详情实时读取 | `image_stats_with_asset_key` 公开聚合视图，按单个完整键等值查询 |
| 列表与榜单 | `get_stats_page` 全量分页导出到 `public/data/stats/hot-*.json` |

`increment_view`、`increment_download`、`get_hot_stats` 属于历史接口，不是当前浏览器写入或导出入口。统计 v2 迁移已撤销普通客户端对旧递增函数的执行权限。

## 单张详情

[wallpaperStatsService.js](../src/services/wallpaperStatsService.js) 仅使用公开 anon 凭据读取当前资源，不读取用户个人记录，也不使用 service role。

```text
GET /rest/v1/image_stats_with_asset_key
  ?select=asset_key,total_views,total_downloads,total_likes,total_collects,updated_at
  &asset_key=eq.<完整资源键>
  &limit=1
```

响应必须匹配当前键，计数必须是非负整数。空记录、读取失败和加载中显示 `—`；服务端明确返回的零显示 `0`。不能把“没有行”推测成已知零。

[useWallpaperStats.js](../src/composables/useWallpaperStats.js) 在切图和卸载时取消旧请求并隔离迟到响应。喜欢、收藏操作返回成功，或预览、下载事件返回 `accepted` 后刷新对应图片；统计请求不阻塞媒体首屏。

SSR 输出相同四列占位，客户端再读取数据库。列表使用快照，详情使用实时查询，两处短期数值不同可能是更新时间差异。

## 事件与用户关系

[wallpaperEventService.js](../src/services/wallpaperEventService.js) 发送 `p_event_id`、`p_asset_key`、`p_event_type`、`p_session_id`。网络错误、429 和 5xx 有限重试，重试复用事件 ID；同会话同资源的预览在 10 分钟内去重。

图片解码成功或视频实际播放后才记录预览。下载区分 `browser-started`、`native-completed`、`opened-fallback`，只有前两种记录下载事件。

[interactionService.js](../src/services/interactionService.js) 通过登录会话操作喜欢和收藏关系；`user_wallpaper_likes` 的账号/资源主键限制一人一图一条喜欢。收藏关联收藏夹，同一账号可能有多个收藏夹，所以 UI 使用“收藏数”，不能未经核验就称“收藏人数”。

2026-11-11 已通过 Supabase MCP 只读对账：156 条喜欢和 55 条收藏与聚合计数差异均为 0，未发现同账号同图跨收藏夹重复。该结果是当次快照，不代表未来始终一致；没有执行清零或重算。

## 导出与缓存

[scripts/export-stats.js](../scripts/export-stats.js) 调用 `get_stats_page`，按 `asset_key` 游标读取到空页，校验总行数和周/月边界后统一替换快照。不能再以旧 Top 500 结果作为全部壁纸统计。

- [export-stats.yml](../.github/workflows/export-stats.yml)：计划每天北京时间 01:30 导出并提交统计目录；GitHub 调度可能延迟。
- [deploy.yml](../.github/workflows/deploy.yml)：在部署前同步最新资源，再导出统计及热门标签。
- 列表静态缓存与页面缓存有延迟；详情实时读取绕过这一层静态缓存。
- 热门标签衡量近期内容与累计互动权重，规则见 [统计口径](统计口径与迁移.md)，不代表用户搜索次数。

## 配置与维护边界

浏览器只配置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。服务端 `SUPABASE_SERVICE_ROLE_KEY` 仅用于经授权的资源同步，不得写入 `VITE_*` 或提交仓库。

[旧初始化脚本](../scripts/supabase-init.sql) 与 [旧用户系统脚本](../scripts/supabase-user-system.sql) 只是基础和历史结构，**不是当前 v5.x 数据库的一键完整安装程序**。已有站点应先检查实际表、权限、关系触发器与迁移历史，不能重复运行旧初始化来“修复”当前统计。

统计 v2 迁移主体依赖暂存映射与完整目录，必须由准备脚本配套生成；流程见 [统计口径与迁移](统计口径与迁移.md)。本次网页发布没有新增数据库结构迁移。

排查优先顺序：完整资源键 → 资源是否 active → 事件请求结果 → 聚合行与关系记录 → 快照时间。不要通过制造生产互动或重置计数来验证页面。
