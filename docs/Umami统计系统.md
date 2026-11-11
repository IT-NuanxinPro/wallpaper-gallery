# Umami Analytics 统计系统

## 概述

本项目使用 [Umami](https://umami.is/) 作为网站流量统计工具，用于追踪整体访问趋势和用户行为。

**Umami 优势：**

- ✅ 开源免费
- ✅ 注重隐私（不使用 Cookie，符合 GDPR）
- ✅ 轻量级（脚本仅 2KB）
- ✅ 国内访问友好
- ✅ 支持自定义事件追踪

**与 Supabase 的分工：**

| 工具     | 用途                     | 数据粒度     |
| -------- | ------------------------ | ------------ |
| Umami    | 整体流量、趋势、用户行为 | 事件名称计数 |
| Supabase | 具体壁纸的下载/预览统计  | 详细记录     |

---

## 配置方法

### 1. 注册 Umami Cloud

访问 [Umami Cloud](https://cloud.umami.is) 注册账号并创建网站。

### 2. 集成脚本

在 `index.html` 中添加：

```html
<script defer src="https://cloud.umami.is/script.js" data-website-id="你的Website ID"></script>
```

### 3. 获取 API Key（可选）

如需通过 API 获取数据，在 Umami 后台生成 API Key。

---

## 已追踪的事件

| 事件名称             | 说明            | 追踪数据                                 |
| -------------------- | --------------- | ---------------------------------------- |
| `wallpaper_download` | 壁纸下载        | filename, category, series, format, size |
| `wallpaper_preview`  | 壁纸预览        | filename, category                       |
| `search`             | 搜索            | query, results                           |
| `series_switch`      | 系列切换        | from, to                                 |
| `view_mode_change`   | 视图模式切换    | mode                                     |
| `filter_apply`       | 筛选应用        | type, value                              |
| `theme_change`       | 主题切换        | theme                                    |
| `diy_avatar_click`   | DIY头像工具点击 | source, target_url                       |
| `today_pick_click`   | 今日精选点击    | filename, category                       |
| `back_to_top`        | 返回顶部        | scroll_position                          |
| `image_crop`         | 图片裁剪        | action, ...                              |
| `pagination`         | 分页            | page, series, category                   |
| `fullscreen_toggle`  | 全屏切换        | action                                   |

### 代码位置

事件追踪函数定义在 `src/utils/analytics.js`，主要集成点：

| 组件/文件                    | 追踪事件                              |
| ---------------------------- | ------------------------------------- |
| `WallpaperModal.vue`         | wallpaper_download, wallpaper_preview |
| `PortraitWallpaperModal.vue` | wallpaper_download, wallpaper_preview |
| `SearchBar.vue`              | search                                |
| `useWallpaperType.js`        | series_switch                         |
| `useViewMode.js`             | view_mode_change                      |

---

## 开发与调试

### 开发环境

开发环境不发送数据到 Umami，只在控制台打印日志：

```
📊 [Analytics] wallpaper_download { filename: 'image.jpg', category: 'anime', ... }
```

### 生产环境验证

1. 部署后访问网站并操作
2. 登录 Umami Cloud
3. 选择对应网站
4. 查看 Events 页面

---

## 添加新事件

### 步骤 1：定义追踪函数

在 `src/utils/analytics.js` 中添加：

```javascript
export function trackNewEvent(data) {
  trackEvent('new_event_name', {
    field1: data.field1,
    field2: data.field2,
  })
}
```

### 步骤 2：在组件中调用

```vue
<script setup>
import { trackNewEvent } from '@/utils/analytics'

function handleAction() {
  // 业务逻辑
  doSomething()
  // 追踪事件
  trackNewEvent({ field1: 'value1', field2: 'value2' })
}
</script>
```

---

## API 使用

### 获取事件统计

```bash
curl -s "https://api.umami.is/v1/websites/{websiteId}/metrics?startAt={timestamp}&endAt={timestamp}&type=event" \
  -H "x-umami-api-key: 你的API Key"
```

**返回示例：**

```json
[
  { "x": "wallpaper_preview", "y": 1079 },
  { "x": "wallpaper_download", "y": 284 },
  { "x": "filter_apply", "y": 633 }
]
```

### 注意事项

⚠️ **Umami Cloud 免费版限制：**

- 只返回事件名称的总次数
- 无法获取事件携带的详细数据（如具体哪个壁纸被下载）
- 这就是为什么我们额外使用 Supabase 来记录详细统计

---

## 最佳实践

### 事件命名

- 使用小写字母和下划线：`wallpaper_download`
- 动词+名词形式：`button_click`, `form_submit`

### 事件数据

- 只追踪必要数据
- 不追踪隐私信息
- 每个事件不超过 5 个字段

### 追踪时机

- 在操作**成功完成后**追踪
- 例如下载事件应在下载成功后追踪

---

## 相关链接

- [Umami 官方文档](https://umami.is/docs)
- [Umami Cloud Dashboard](https://cloud.umami.is)
- [Umami API 文档](https://umami.is/docs/api)
