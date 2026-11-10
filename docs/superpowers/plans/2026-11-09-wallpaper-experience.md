# Wallpaper Experience Implementation Plan

> 最终范围更新（2026-11-10）：用户取消“设备”和“发现筛选”两组扩展功能。设备适配、场景预览、颜色/比例/风格/用途筛选及相关索引已移除。下文对应任务为历史设计，不属于最终版本；最终发布范围以 docs/releases/v5.2.0.md 为准。新增网页与客户端独立更新通知。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement and review each task. User instructions override skill defaults requiring git commits, branches or deletion.

**Goal:** 完成首屏、图片可靠性、搜索、连续浏览、分享，以及设备适配、原生壁纸和精选专题八项已批准能力。

**Architecture:** Vue/Pinia 复用现有数据、统计和收藏。纯函数承担搜索、资源索引、设备匹配和分享身份。Cloudflare 提供受限图片与详情元信息入口。Pake 以独立 Rust 模块管理系统壁纸与持久化离线轮换。

**Tech Stack:** Vue 3, Pinia, Vite, Vitest, Cloudflare Pages Functions, Node, Rust/Tauri。

**Spec:** `docs/superpowers/specs/2026-11-09-wallpaper-experience-design.md`

## Global Constraints

- 本轮不创建分支、不提交或推送、不执行数据库迁移；所有代码与报告保留供审阅。
- 网站目录 `/Users/nuanxinpro/frontProject/gihtub/wallpaper/wallpaper-gallery`。
- Pake 目录 `output/crop-theme-fix-20261109/pake-checkout`，真实独立 git 仓库；不修改其通用 CLI 行为。
- 图片来源为当前白名单图床和 Bing；用户任意 URL 不得成为服务器或原生下载代理。
- 资源身份始终使用完整 asset key；保持统计成功条件与去重规则。
- 保留既有交互、主题、低动态设置、中文文案；小模块和最小必要改动。
- 浏览器验证屏蔽生产统计写请求；原生系统壁纸操作仅通过用户主动点击触发。
- 任务报告存于 `output/experience-20261109/`，记录修改文件、实际测试命令、结果及限制。

## Task 1: 紧凑首屏

**Files:** `src/components/home/HotTagsPanel.vue`, `src/components/common/feedback/AnnouncementBanner.vue`。
**Interfaces:** 现有 HotTagsPanel props 和 select 事件保持兼容。
- [ ] 桌面与手机均默认紧凑，热门摘要保留可用标签和展开入口；展开状态按系列记忆，读取存储异常可恢复。
- [ ] 压缩公告高度与区块边距，维持足够点击区域和清晰焦点。
- [ ] 运行改动源码 lint；浏览器验收与全局阶段合并，不新增只断言 CSS 文本的测试。
- [ ] 输出 `task-1-report.md`。

## Task 2: 图片、下载、裁剪可靠性

**Files:** `functions/images/[[path]].js`, `src/utils/wallpaper/imageDelivery.js`, 新 `src/utils/wallpaper/imageFetch.js`, `src/utils/common/format.js`, `src/composables/useWallpaperDownload.js`, `src/components/wallpaper/crop/index.vue`, `src/components/wallpaper/crop/shared/CropImageStage.vue`。
**Interfaces:** `fetchWallpaperImage(url, { signal, timeoutMs, maxBytes }) -> Promise<Blob>`；原有 `downloadFile` 返回状态保留。
- [ ] 先用失败测试覆盖超时响应体、取消、非图片、过大响应、来源回退、切图竞态。
- [ ] 自有入口新增受限原图路径；浏览器下载和裁剪复用可取消加载器，重试保持用户设置。
- [ ] 统计仍只在 browser-started/native-completed 时记录；取消和失败不计数。
- [ ] 跑关联图片、下载、媒体测试和 lint；输出 `task-2-report.md`。

## Task 3: 统一搜索与发现筛选

**Files:** 新 `src/utils/wallpaper/discovery.js`, `src/stores/filter.js`, `src/components/search/composables/useSearchSuggestions.js`, `src/components/wallpaper/filter/**`, `src/views/Home.vue`, 新 `scripts/generate-discovery-index.js`, `src/services/discoveryService.js`, `tests/discovery.test.js`。
**Interfaces:** `matchesWallpaperQuery(wallpaper, query)`；`getWallpaperDiscoveryFacets(wallpaper)`；生成 `public/data/discovery/index.json` 按 asset key 关联 `{ color, width, height, aspectRatio }`。索引加载失败时保留文本/已有筛选，不显示假的颜色匹配。
- [ ] 统一搜索规范化与匹配字段；建议与结果一致，多词行为可测试。
- [ ] 增加颜色、比例、风格和用途筛选及清除/无结果恢复；保持当前系列作用域。
- [ ] 从 `../nuanXinProPic` 的真实缩略图提取主色；使用缓存和有界并发生成索引，补齐本地与 CI 构建接线。
- [ ] 测试标签建议、大小写、组合筛选、索引缺失和重复文件名；输出 `task-3-report.md`。

## Task 4: 结果内导航与浏览恢复

**Files:** `src/composables/home/useWallpaperNavigator.js`, 新 `src/composables/home/useBrowseState.js`, `src/views/Home.vue`, `src/components/wallpaper/WallpaperGrid/composables/useGridPagination.js`, `tests/wallpaper-navigation.test.js`。
**Interfaces:** navigator 接收当前结果 getter；浏览状态使用 `q/category/subcategory/sort/format/resolution/color/ratio/style/use/image` 查询参数，值均白名单校验。
- [ ] 测试筛选顺序、重复文件名、边界导航和筛选变化时所选图片处理。
- [ ] 相邻预览最多两个，取消过期预加载；禁止为了预加载拉原图。
- [ ] 刷新/浏览器返回恢复查询、打开图片和列表位置，恢复前加载足够条目；避免 watch/router 循环。
- [ ] 输出 `task-4-report.md`。

## Task 5: 单图站内分享与可索引详情

**Files:** 新 `src/utils/wallpaper/share.js`, `src/views/WallpaperDetail.vue`, `functions/wallpaper/[[path]].js`, `src/router/index.js`, 各弹窗复制链接入口，详情数据生成脚本，`tests/wallpaper-share.test.js`。
**Interfaces:** `buildWallpaperSharePath(wallpaper, series)` 和 token 编解码使用完整 asset key；生成 `public/data/details/{bucket}.json`（64 个固定短文件名，桶内以完整 token 查找），网页与边缘元信息读取同一记录。长中文路径的 token 不作为磁盘文件名。
- [ ] 测试中文、特殊字符、跨系列同名、无效/过长 token 与注入文本。
- [ ] 独立详情显示图、下载、裁剪/设备入口、已有收藏与相关内容；刷新和复制站内链接可用。
- [ ] 服务端输出真实 title/description/og:image/canonical；找不到图有正确状态和返回入口。
- [ ] 验证一张真实记录的详情、分享元信息与无效链接；输出 `task-5-report.md`。

## Task 6: 设备匹配与使用场景预览

**Files:** 新 `src/stores/deviceProfile.js`, `src/utils/wallpaper/deviceFit.js`, `src/components/wallpaper/device/**`, 过滤/详情/裁剪入口，`tests/device-fit.test.js`。
**Interfaces:** device profile `{ id, name, width, height, kind, safeArea, focalPoint }`，尺寸限制 240..16384，持久化可恢复；`getDeviceFit(wallpaper, profile)` 返回清晰度与裁切比例。
- [ ] 设备预设、自定义分辨率、手动校正和“适合我的设备”筛选。
- [ ] 裁剪默认设备尺寸、可手动焦点和留白位置；图像显著区域建议保持可解释和可撤销。
- [ ] Windows 图标/任务栏、手机锁屏预览可切换；一键导出适配图，不放大后谎称高清。
- [ ] 验证尺寸边界、缺元数据、横竖屏、保存恢复和裁剪导出；输出 `task-6-report.md`。

## Task 7: 原生壁纸与离线轮换

**Files:** Pake 新 `src-tauri/src/app/wallpaper.rs` 与可拆分子模块，注册入口；网站新 `src/services/desktopWallpaperService.js`、原生操作控件与收藏轮换面板。
**Interfaces:** IPC `wallpaper_capabilities`, `wallpaper_apply`, `wallpaper_restore`, `wallpaper_configure_rotation`, `wallpaper_rotation_status`。数据 `{assetKey,url,title}`；状态含 supported/enabled/intervalMinutes/current/previous/lastError/cacheCount。
- [ ] 写可执行的纯策略测试：源站/URL/重定向校验、队列去重与上限、间隔边界、缓存恢复、失败不更新 current。
- [ ] Windows SystemParametersInfoW；macOS 固定 AppleScript 参数传入缓存文件；Linux 环境探测，仅支持明确已实现的桌面后端。
- [ ] 有界图片缓存、状态原子持久化、后台轮换、停止和上一张恢复；启动读取用户此前显式启用的设置，不新增系统自启动。
- [ ] 网页能力探测兼容旧壳；不可用时明确升级提示。收藏选取已有静态图，避免视频/动态图片伪支持。
- [ ] 编译与测试报告区分本机、Windows、浏览器模拟；输出 `task-7-report.md`。

## Task 8: 精选专题与配套内容

**Files:** 新 `src/content/collections.js`, `src/utils/wallpaper/collections.js`, `src/views/Collections.vue`, `src/views/CollectionDetail.vue`，路由与紧凑入口，`tests/collections.test.js`。
**Interfaces:** 专题 `{slug,title,description,coverKey,items:[assetKey],pairs:[{desktopKey,mobileKey}],sourceNotes}`；清单以真实身份引用，失效条目过滤但不伪造配对。
- [ ] 建立至少三个真实精选主题，并提供可确认主题一致的电脑/手机配套分组；内容挑选与来源说明人工核对。
- [ ] 专题列表和详情可分享，支持设备筛选、下载、已有收藏；首页入口不挤回首屏图片区。
- [ ] 相关推荐基于当前内容、标签与设备匹配，排除当前图、重复图及不适配内容。
- [ ] 校验清单引用、重复项、缺失元数据与分享；输出 `task-8-report.md`。

## Final integration

- [ ] 每项完成独立 spec/quality 审查，记录及修复实际问题。
- [ ] 运行全量 Vitest、生产构建与改动源码 lint；生成数据可重复运行。
- [ ] 一次桌面/手机浏览器批量验收全部关键流程，按实际问题修复后一次确认。
- [ ] 记录原生编译、测试边界及系统权限；未经明确许可不实际改用户系统壁纸。
- [ ] 提供可审阅结果和新版本发布方案；全部准备完成后再确认提交/发布。
