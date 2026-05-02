# 壁纸库自定义版 - 部署说明

## 分支说明

| 分支 | 用途 |
|------|------|
| `main` | 跟踪上游 IT-NuanxinPro/wallpaper-gallery，只同步不修改 |
| `custom` | **生产分支**，所有自定义改动在此，CF Pages 绑定此分支 |

## 新增文件清单（不修改原有文件）

```
functions/
  api/
    file/[[path]].js     图片代理（隐藏 Bot Token，支持缩略图）
    wallpapers.js        壁纸列表接口（直查 D1）
    random.js            随机图接口
    admin/
      auth.js            管理员登录/验证
      config.js          API 配置读写
  admin.js               后台管理页面路由

src/
  services/imgbed/
    api.js               数据服务层（调用 /api/wallpapers）
  stores/
    imgbed.js            Pinia store（替代原 wallpaper store 数据加载）
  views/admin/
    index.html           后台管理界面（独立 HTML，无需构建）
```

## CF Pages 配置

### 1. 构建设置
| 项目 | 值 |
|------|----|
| 生产分支 | `custom` |
| 构建命令 | `npm install && npm run build` |
| 输出目录 | `dist` |

### 2. D1 数据库绑定
| 变量名 | 绑定 |
|--------|------|
| `DB` | 与 ImgBed 共用的同一个 D1 数据库 |

> ⚠️ 必须和 ImgBed 绑定同一个 D1，变量名必须是 `DB`

### 3. 环境变量
| 变量名 | 说明 |
|--------|------|
| `WG_BOT_TOKENS` | JSON 格式的 chatId→botToken 映射 |
| `ADMIN_USER` | 管理员用户名（默认 admin） |
| `ADMIN_PASS` | 管理员密码 |
| `ADMIN_SECRET` | JWT 签名密钥（32位以上随机字符串） |

**WG_BOT_TOKENS 示例：**
```json
{"-1003814998799":"TOKEN1","-1003777271568":"TOKEN2","-1003718954682":"TOKEN3"}
```

## 管理后台

访问 `/admin` 即可进入，功能包括：
- 📊 数据概览（各分类图片数量统计）
- ⚙️ API 配置（缩略图开关、默认筛选规则）
- 🧪 API 在线测试
- 🤖 Bot 配置说明

## API 接口速查

| 接口 | 参数 | 说明 |
|------|------|------|
| `GET /api/wallpapers` | orientation, style, color, tags, page, limit, random, thumb, thumb_width | 壁纸列表 |
| `GET /api/random` | type(url/img), orientation, style, color, thumb, w | 随机图 |
| `GET /api/file/<key>` | w(宽度), q(质量) | 图片代理 |
| `GET /admin` | — | 后台管理界面 |
| `POST /api/admin/auth` | {username, password} | 登录 |
| `GET /api/admin/verify` | Cookie | 验证会话 |
| `GET/POST /api/admin/config` | — | 读写 API 配置 |

## 与上游同步

```bash
# 添加上游（只需一次）
git remote add upstream https://github.com/IT-NuanxinPro/wallpaper-gallery.git

# 上游有更新时
git fetch upstream
git checkout main
git merge upstream/main
git push origin main

git checkout custom
git merge main
# 若有冲突只会在极少数文件产生，逐个解决即可
git push origin custom
```

## 前端接入方式

在需要展示壁纸的 Vue 组件中：

```js
import { useImgbedStore } from '@/stores/imgbed'

const store = useImgbedStore()

// 加载横图壁纸
await store.loadWallpapers({ orientation: 'horizontal' })

// 按风格筛选
await store.applyFilters({ style: '自然_风景', color: '偏蓝' })

// 获取随机壁纸用作背景
const bg = await store.getRandomWallpaper({ orientation: 'horizontal' })
// bg.thumbnailUrl → 缩略图（800px WebP）
// bg.url         → 原图
```
