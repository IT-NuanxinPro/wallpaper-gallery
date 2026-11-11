# Supabase 统计系统

## 当前状态

当前项目已经完成统计链路重构，前端与导出脚本都基于 `image_stats` + RPC 工作。

对外提供两份 SQL：

- `scripts/supabase-init.sql`
  给新项目 / fork 用户使用，整段复制执行即可
- `scripts/supabase-migration.sql`
  给已经存在旧统计结构的项目使用，用于迁移历史数据

现行链路：

- 前端写入：调用 `increment_view` / `increment_download`
- 数据落库：写入 `public.image_stats`
- 前端展示：优先读取 `public/data/stats/hot-*.json`
- 静态导出：调用 `get_hot_stats`
- 定时任务：`.github/workflows/export-stats.yml` 执行 `scripts/export-stats.js`

旧结构 `wallpaper_views` / `wallpaper_downloads` / `popular_wallpapers*` 仅用于历史迁移参考，不再是当前代码依赖。

## 当前数据库架构

### 1. 主表：`public.image_stats`

用途：存储每张图片的聚合统计结果，是当前线上唯一写入目标。

核心字段：

- `image_id`: 图片唯一标识
  使用非空白约束，避免写入空字符串
- `series`: 系列，如 `desktop` / `mobile` / `avatar` / `bing`
  使用 `CHECK` 约束限制取值，避免写入脏数据
- `category`: 分类
- `total_views`: 累计浏览数
- `total_downloads`: 累计下载数
- `last_viewed_at`: 最近一次浏览时间
- `last_downloaded_at`: 最近一次下载时间
- `created_at`: 该聚合记录首次创建时间
- `updated_at`: 最近一次被更新的时间

字段保护：

- `image_id` 不允许为空白字符串
- `total_views >= 0`
- `total_downloads >= 0`

时间字段约定：

- 所有时间字段继续使用 `TIMESTAMPTZ`
- 查询时如需按北京时间展示，使用 `AT TIME ZONE 'Asia/Shanghai'`
- 最终展示为固定格式时，使用 `to_char(..., 'YYYY-MM-DD HH24:MI:SS')`

示例：

```sql
SELECT
  image_id,
  to_char(updated_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS') AS updated_at_cn
FROM public.image_stats
ORDER BY updated_at DESC
LIMIT 20;
```

### 2. RPC：`increment_view`

用途：浏览量原子加一。

输入参数：

- `img_id`
- `series_name`
- `cat`

行为：

- 若 `image_id` 不存在，则新建聚合行
- 若已存在，则 `total_views + 1`
- 同步更新 `last_viewed_at` 和 `updated_at`

### 3. RPC：`increment_download`

用途：下载量原子加一。

输入参数：

- `img_id`
- `series_name`
- `cat`

行为：

- 若 `image_id` 不存在，则新建聚合行
- 若已存在，则 `total_downloads + 1`
- 同步更新 `last_downloaded_at` 和 `updated_at`

### 4. RPC：`get_hot_stats`

用途：导出某个系列的热门统计，供静态 JSON 生成脚本使用。

输入参数：

- `series_filter`
- `limit_count`

返回字段：

- `image_id`
- `total_views`
- `total_downloads`

## 代码中的实际依赖

当前代码里与统计相关的主要文件：

- `scripts/supabase-init.sql`
  面向新用户的简化初始化脚本
- `src/services/statsService.js`
  负责静态统计加载、RPC 写入、Supabase 兜底读取
- `src/utils/supabase.js`
  兼容层，实际转发到 `statsService`
- `scripts/export-stats.js`
  从 `get_hot_stats` 导出静态 JSON
- `scripts/supabase-migration.sql`
  新结构初始化与历史迁移脚本

结论：

- 代码中已经没有直接向 `wallpaper_views` / `wallpaper_downloads` 插入数据的逻辑
- 代码中也没有继续读取 `popular_wallpapers` 等旧视图的逻辑
- 当前统计以 `image_stats` 为唯一运行时真源

## 保留与清理建议

### 应保留

- `public.image_stats`
- `increment_view`
- `increment_download`
- `get_hot_stats`
- `scripts/supabase-init.sql`

### 可保留但仅作迁移参考

- `scripts/supabase-migration.sql`

说明：

- 这个脚本仍然引用旧表，是因为它负责“从旧结构迁移到新结构”
- 它不是运行时依赖，不代表项目仍在使用旧架构

### 可下线

以下对象如果你确认不再需要查看历史原始事件，可以下线：

- `public.wallpaper_views`
- `public.wallpaper_downloads`
- `public.view_stats`
- `public.download_stats`
- `public.popular_wallpapers`
- `public.popular_wallpapers_weekly`
- `public.popular_wallpapers_monthly`
- `public.wallpaper_stats_summary`

## 推荐的下线流程

建议分两步进行：

### 第一步：标记旧结构

执行 `scripts/supabase-retire-legacy.sql` 中的“标记阶段”SQL。

目的：

- 给旧对象增加注释
- 明确这些对象不再被当前代码使用
- 让后续维护时一眼看出哪些是遗留结构

### 第二步：确认后再删除

确认以下条件都满足后，再执行“删除阶段”SQL：

- 最近一段时间只观察 `image_stats`
- 不再依赖旧表里的逐条事件时间线
- 已完成必要备份

## 快速排查口径

如果你想确认“最近是否有统计写入”，优先看：

- `image_stats.updated_at`
- `image_stats.last_viewed_at`
- `image_stats.last_downloaded_at`

不要再以 `wallpaper_views` / `wallpaper_downloads` 是否持续增长作为当前架构是否正常的判断标准，因为当前前端已不再写入它们。

## 附：当前架构的一句话定义

当前项目的 Supabase 统计架构是：

`前端 RPC 写入 image_stats -> GitHub Actions 定时导出 hot-*.json -> 前端优先消费静态统计文件`
