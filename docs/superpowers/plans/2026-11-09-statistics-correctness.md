# 统计正确性与资源身份修复

目标：完成用户截图六项问题，保留既有UI优化与累计历史，不提交、不建分支。生产迁移在本地测试与具体审阅完成后执行。

## 数据合同

- 静态/视频资源身份采用 `series:path:<规范化原始资源路径>`，路径每段先解码一次再编码，避免编码形式造成同图多键；Bing继续 `bing:bing-YYYY-MM-DD.jpg`。不能依赖图床顺序编号。
- `buildWallpaperAssetKey(wallpaperOrKey, series)` 接受资源对象、规范键或旧文件名；新写入必须用完整对象或规范键。
- 计数继续使用image_stats，`image_id`为asset_key去掉series前缀的后缀；导出带完整asset_key。唯一旧身份累计转到规范键；同名多图旧浏览/下载累计保留在旧行，不能复制或均分。既有用户关系跟随数据库原有source_path所代表资源。
- 新RPC `record_wallpaper_event(p_event_id uuid,p_asset_key text,p_event_type text,p_session_id uuid)` 返回accepted/duplicate。类型view/download；客户端重试复用event_id。预览按会话/资源10分钟窗口去重，下载只对重复事件ID去重。时间使用服务器时间。
- 每日聚合保存 `asset_key,day,views,downloads`，日期按Asia/Shanghai；周榜从周一/月榜从1号计到当前，按views+2*downloads，全部资源都可参与，与上传时间无关。历史累计不伪造每日分布。
- 下载结果明确区分browser-started/native-completed/opened-fallback。仅前两种记一次“下载已发起”；无法证明浏览器最后保存到磁盘。
- 公开读取统计使用分页RPC `get_stats_page(p_series text,p_after text default '',p_limit int default 500)`，返回asset_key、image_id、累计计数及week/month计数；按asset_key稳定游标，无Top500截断。

## 实施

- [ ] 资源身份及关系：统一helper，更新transform/store/library/interaction/sync消费，生成旧→新映射和重名历史保留方案，测试同名不同路径、编码与旧键兼容。
- [ ] 数据库：收紧profiles更新列；规范身份与FK迁移；事件幂等、日汇总、分页读RPC及旧接口兼容，限制权限/search_path/输入；本地Postgres兼容运行时测试。
- [ ] 下载与预览：固定异步开始对象，成功结果后计数；所有详情切图和加载/播放就绪时统一记录，短时去重及可靠重试。
- [ ] 导出与排名：分页全量、完整快照校验、导出失败非零退出；前端按asset_key查统计、视频统计恢复，周/月真正期间互动排名，显示统计开始与更新时间。
- [ ] 联合验证：全量测试、构建、独立审查；生产迁移前核对数据量和历史保留，迁移后校验权限、总量、身份唯一性与计数一致性。

## 历史与上线边界

旧重复文件名已经混合的统计无法还原单图精确值，必须明确保留为legacy累计。旧客户端兼容期不把不确定计数写入特定新资源。事件幂等解决重试重复，不宣称匿名session ID能阻止恶意刷量。源代码与新数据库应协调发布；未发布时不得声称前端已生效。
