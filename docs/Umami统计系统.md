# Umami 网站分析

校对日期：2026-11-11。Umami 用于网站流量和行为分析；壁纸详情的四项数字来自 Supabase，不能把两套数据视为完全相同。

## 配置

[src/main.js](../src/main.js) 读取 `VITE_UMAMI_WEBSITE_ID`，配置存在时动态加载 `https://cloud.umami.is/script.js`。无需再向 `index.html` 重复插入同一脚本。

```dotenv
VITE_UMAMI_WEBSITE_ID=你的网站ID
```

该值在构建时生效。Fork 时检查 `.env.production` 并换为自己的 ID，或移除以停用。网站 ID 是公开标识，管理 API Key 不应进入前端。

事件统一通过 [src/utils/common/analytics.js](../src/utils/common/analytics.js) 发送：生产环境且 `window.umami` 可用时调用，开发环境仅打印自定义事件日志。注意这不等于开发环境绝不加载 Umami 脚本：入口只检查 ID，有配置时仍会加载服务脚本。

## 当前真实调用事件

| 事件 | 触发位置/含义 |
| --- | --- |
| `wallpaper_preview` | 图片就绪或视频播放后，Supabase 预览事件返回 `accepted`；携带完整资源键 |
| `wallpaper_download` | 浏览器下载已发起或原生保存返回成功；不代表浏览器已最终落盘 |
| `search` | 搜索组件提交；`results` 当前是建议条目数，不是数据库完整搜索命中数 |
| `filter_apply` | 筛选组件应用排序、格式、分辨率、分类等条件 |
| `theme_change` | 主题切换 |
| `diy_avatar_click` | 打开外部 DIY 头像工具 |
| `back_to_top` | 返回顶部操作 |
| `image_crop` | 裁剪打开、完成或取消 |

代码仍保留 `series_switch`、`pagination`、`fullscreen_toggle` 的辅助函数，但本次检查未找到实际调用点，不能写成当前正在统计的事件。旧 `view_mode_change` 和 `today_pick_click` 不属于当前事件列表。

## 与 Supabase 的分工

- Umami 服务脚本负责其网站分析数据，浏览器拦截和网络失败可能使事件缺失。
- Supabase 维护资源目录、用户关系、预览/下载事件和累计/期间统计。
- 详情展示读取 Supabase 公开汇总，不访问 Umami API。
- 下载分析事件与数据库写入为不同请求，不能用两边数字是否完全相等判断计数正确性。

## 调试与扩展

先检查构建时网站 ID、脚本是否加载、当前事件是否有实际调用，再去 Umami 控制台看结果。不要在生产批量制造浏览或下载来测试计数。

新增事件复用 `trackEvent`，在真实业务结果产生后触发；只提交必要的业务字段，避免个人资料、凭据和完整认证 URL。包装器捕获同步及异步错误；遇到包含 429 的错误时，本页后续分析调用会停用，不影响壁纸操作。

费用、套餐、API 能力及数据保留以 [Umami 官方文档](https://umami.is/docs) 为准，不在项目文档中固定第三方免费套餐限制或网络可达性承诺。
