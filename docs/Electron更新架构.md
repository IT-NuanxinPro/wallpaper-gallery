# Electron 更新架构设计

## 📐 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    nuanXinProPic (图床仓库)                   │
│                                                               │
│  main 分支                                                    │
│  ├── data/desktop.json                                       │
│  ├── data/mobile.json                                        │
│  ├── data/avatar.json                                        │
│  ├── bing/meta/                                              │
│  └── Git Tags: v1.1.29, v1.1.30, v1.1.31...                 │
│                    ↓                                          │
│              (打 tag 即发布新数据版本)                         │
└─────────────────────────────────────────────────────────────┘
                         ↓
                         ↓ (GitHub API 检测)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│            wallpaper-gallery (前端仓库)                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ main 分支 (Web + H5)                                 │   │
│  │ ├── deploy.yml (不动)                                │   │
│  │ └── 部署到 GitHub Pages                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ feature/desktop-app 分支 (Electron)                  │   │
│  │ ├── build-electron.yml                               │   │
│  │ ├── package.json (electronVersion: "1.0.0")          │   │
│  │ └── public/electron-version.json                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         ↓
                         ↓ (构建时使用最新 tag)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Electron 应用 (用户端)                       │
│                                                               │
│  启动时检查:                                                  │
│  1. 应用版本 (electron-version.json)                         │
│  2. 数据版本 (GitHub API 获取最新 tag)                       │
│                                                               │
│  发现更新:                                                    │
│  - 应用更新 → 提示下载新版本                                 │
│  - 数据更新 → 一键下载最新 tag 的数据                        │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 三种版本管理

### 1. Web 版本 (main 分支)
- **版本号**: `package.json` 的 `version` (如 2.10.0)
- **版本文件**: `public/version.json`
- **更新方式**: 修改版本号 → 推送 main 分支 → 自动部署
- **用户检查**: Web 环境启动 5 秒后检查
- **状态**: ✅ 不动，保持现有流程

### 2. Electron 应用版本 (feature/desktop-app 分支)
- **版本号**: `package.json` 的 `electronVersion` (如 1.0.0)
- **版本文件**: `public/electron-version.json`
- **更新方式**: 修改版本号 → 打 tag → GitHub Actions 构建
- **用户检查**: Electron 启动 3 秒后检查
- **更新行为**: 提示用户下载新版本

### 3. 壁纸数据版本 ⭐️
- **版本来源**: 图床仓库的 Git Tag (如 v1.1.30)
- **检查方式**: GitHub API (`/repos/IT-NuanxinPro/nuanXinProPic/tags`)
- **更新方式**: 图床仓库打 tag
- **用户检查**: Electron 启动 3 秒后 + 每小时检查
- **更新行为**: 一键下载最新 tag 的数据文件

## 📝 详细流程

### 流程 1: 图床数据更新（最常见）

```bash
# 在 nuanXinProPic 仓库
cd nuanXinProPic

# 1. 添加新壁纸到 data/ 目录
git add data/
git commit -m "feat: 新增 100 张壁纸"

# 2. 打 tag（版本号递增）
git tag v1.1.30 -m "新增 100 张壁纸"
git push origin main --tags

# 3. 完成！Electron 用户会自动检测到更新
```

**Electron 用户体验：**
1. 应用启动或每小时检查时，发现新 tag `v1.1.30`
2. 显示通知："发现壁纸数据更新 v1.1.30"
3. 用户点击"立即更新"
4. 自动下载最新数据文件
5. 提示"更新成功，请重启应用"
6. 重启后看到最新壁纸

### 流程 2: Electron 应用更新（功能更新）

```bash
# 在 wallpaper-gallery 仓库的 feature/desktop-app 分支
cd wallpaper-gallery
git checkout feature/desktop-app

# 1. 修改应用版本号
# package.json
{
  "electronVersion": "1.0.1"
}

# public/electron-version.json
{
  "version": "1.0.1",
  "buildTime": "2026-01-25T12:00:00.000Z",
  "changelog": "修复壁纸设置问题，优化性能"
}

# 2. 提交并打 tag
git add package.json public/electron-version.json
git commit -m "chore: bump electron version to 1.0.1"
git push origin feature/desktop-app

# 3. 打 tag 触发构建
git tag v1.0.1 -m "Release v1.0.1"
git push --tags

# 4. GitHub Actions 自动构建并发布到 Releases
```

**Electron 用户体验：**
1. 应用启动时检测到新版本 `v1.0.1`
2. 显示通知："发现新版本 v1.0.1 - 修复壁纸设置问题，优化性能"
3. 用户点击"下载更新"
4. 打开 GitHub Releases 页面
5. 下载并安装新版本

### 流程 3: Web 版本更新（不影响 Electron）

```bash
# 在 wallpaper-gallery 仓库的 main 分支
cd wallpaper-gallery
git checkout main

# 1. 修改 Web 版本号
# package.json
{
  "version": "2.10.1"
}

# public/version.json
{
  "version": "2.10.1",
  "buildTime": "2026-01-25T12:00:00.000Z"
}

# 2. 提交并推送
git add package.json public/version.json
git commit -m "chore: bump web version to 2.10.1"
git push origin main

# 3. GitHub Actions 自动部署到 GitHub Pages
```

**Web 用户体验：**
- 访问网站时检测到新版本
- 显示更新提示
- 点击刷新即可

## 🔧 技术实现

### Electron 构建流程 (build-electron.yml)

```yaml
1. 获取图床最新 tag
   ↓
2. 更新 CDN_VERSION 常量
   ↓
3. Checkout 图床仓库（使用最新 tag）
   ↓
4. 复制数据文件到 public/data/
   ↓
5. 构建 Electron 应用
   ↓
6. 上传构建产物
   ↓
7. (如果是 tag) 创建 GitHub Release
```

### Electron 数据更新检查

```javascript
// 1. 获取图床最新 tag
const response = await fetch('https://api.github.com/repos/IT-NuanxinPro/nuanXinProPic/tags')
const tags = await response.json()
const latestTag = tags[0].name // "v1.1.30"

// 2. 对比本地版本
const localVersion = localStorage.getItem('wallpaper_data_version') // "1.1.29"

// 3. 发现更新
if (compareVersions(latestTag, localVersion) > 0) {
  showUpdateNotification()
}
```

### Electron 数据下载

```javascript
// 使用最新 tag 下载数据
const dataUrl = `https://raw.githubusercontent.com/IT-NuanxinPro/nuanXinProPic/${latestTag}/data/desktop.json`

// 下载所有数据文件
await downloadDataFile(dataUrl, localPath)

// 保存版本号
localStorage.setItem('wallpaper_data_version', latestTag.replace(/^v/, ''))
```

## 📊 版本号对应关系

| 组件 | 版本号 | 文件位置 | 更新频率 |
|------|--------|----------|----------|
| Web 应用 | 2.10.0 | package.json `version` | 低 |
| Electron 应用 | 1.0.0 | package.json `electronVersion` | 低 |
| 壁纸数据 | v1.1.30 | 图床仓库 Git Tag | 高 |

## ✅ 优势

1. **极简管理**: 数据版本直接使用图床 tag，无需额外维护
2. **独立更新**: 三个版本完全独立，互不影响
3. **用户友好**: Electron 用户一键更新数据，无需重装应用
4. **自动化**: 图床打 tag 即可，Electron 自动检测
5. **版本一致**: 数据版本与 CDN 版本完全一致
6. **减少发布**: 只有重大功能更新才需要发布新应用版本

## 🎯 最佳实践

### 日常壁纸更新（最常见）
```bash
# 在图床仓库
git tag v1.1.31 -m "新增壁纸"
git push --tags
# 完成！Electron 用户会自动收到更新提示
```

### Electron 功能更新（偶尔）
```bash
# 在前端仓库 feature/desktop-app 分支
# 修改 electronVersion → 打 tag
git tag v1.0.2
git push --tags
# GitHub Actions 自动构建发布
```

### Web 功能更新（偶尔）
```bash
# 在前端仓库 main 分支
# 修改 version → 推送
git push origin main
# GitHub Actions 自动部署
```

## 🚨 注意事项

1. **图床 tag 命名**: 必须遵循 `v1.1.30` 格式（v + 语义化版本号）
2. **Electron tag 命名**: 必须遵循 `v1.0.1` 格式
3. **分支隔离**: main 和 feature/desktop-app 完全独立
4. **构建数据**: Electron 构建时使用图床最新 tag 的数据
5. **用户数据**: Electron 用户可随时更新到最新 tag 的数据

## 📱 用户更新体验

### 场景 1: 图床新增壁纸
```
图床打 tag v1.1.31
    ↓
Electron 检测到更新
    ↓
显示通知："发现新壁纸 v1.1.31"
    ↓
用户点击"立即更新"
    ↓
下载最新数据（30秒内完成）
    ↓
提示"更新成功，请重启"
    ↓
重启后看到最新壁纸 ✨
```

### 场景 2: Electron 应用更新
```
开发者打 tag v1.0.2
    ↓
GitHub Actions 构建
    ↓
发布到 Releases
    ↓
Electron 检测到新版本
    ↓
显示通知："发现新版本 v1.0.2"
    ↓
用户点击"下载更新"
    ↓
打开 GitHub Releases
    ↓
下载并安装新版本 ✨
```

## 🔍 故障排查

### 问题 1: Electron 检测不到数据更新
- 检查图床仓库是否有新 tag
- 检查 GitHub API 是否可访问
- 查看 localStorage 中的 `wallpaper_data_version`

### 问题 2: 数据下载失败
- 检查网络连接
- 检查 GitHub raw 文件是否可访问
- 查看 Electron 控制台错误日志

### 问题 3: 构建时数据不是最新的
- 检查 build-electron.yml 是否正确获取最新 tag
- 检查 Checkout 步骤是否使用了正确的 ref
