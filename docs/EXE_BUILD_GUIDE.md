# Windows EXE 打包指南 (Electron)

## 🖥️ 项目配置

### 应用信息
- **App Name**: Wallpaper Gallery
- **Version**: 1.3.4
- **Web 目录**: dist
- **框架**: Vue 3 + Vite 7

---

## 🚀 快速开始

### 1. 环境准备

#### 安装 Node.js (必需)
```bash
# 检查 Node.js 版本（需要 v16+）
node --version

# 如果版本过低，安装新版本
# 访问 https://nodejs.org/
```

### 2. 项目配置

#### 安装 Electron 依赖
```bash
cd wallpaper-gallery

# 安装 Electron 相关依赖
pnpm add -D electron electron-builder
```

#### 修改路由模式 (重要)

**当前问题**: Electron 使用 `file://` 协议，不支持 History 模式路由

**解决方案**: 改为 Hash 模式

修改 `src/router/index.js`:
```javascript
import { createRouter, createHashHistory } from 'vue-router'

const router = createRouter({
  history: createHashHistory(), // 改为 hash 模式
  routes
})
```

#### 创建 Electron 主进程

创建 `electron/main.js`:
```javascript
const { app, BrowserWindow } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // 加载 Web 应用
  mainWindow.loadFile('dist/index.html')

  // 开发环境打开 DevTools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
```

#### 创建预加载脚本

创建 `electron/preload.js`:
```javascript
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron
})
```

#### 配置 Electron Builder

修改 `package.json`:
```json
{
  "main": "electron/main.js",
  "build": {
    "appId": "com.wallpaper.gallery",
    "productName": "Wallpaper Gallery",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "electron/**/*",
      "dist/**/*",
      "package.json"
    ],
    "win": {
      "target": "nsis",
      "icon": "public/icon-192.png"
    },
    "mac": {
      "target": "dmg",
      "icon": "public/icon-192.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

---

## 📦 打包流程

### 步骤 1: 构建 Web 项目

```bash
# 构建 Web 项目
pnpm build
```

### 步骤 2: 开发模式测试

```bash
# 启动 Electron 开发模式
pnpm electron:dev
```

在 `package.json` 中添加脚本:
```json
{
  "scripts": {
    "electron:dev": "electron .",
    "electron:build": "electron-builder"
  }
}
```

### 步骤 3: 打包 EXE

```bash
# 打包 Windows EXE
pnpm electron:build --win

# 打包 macOS DMG
pnpm electron:build --mac

# 打包 Linux AppImage
pnpm electron:build --linux
```

**输出位置**:
- Windows: `dist-electron/Wallpaper Gallery Setup 1.3.4.exe`
- macOS: `dist-electron/Wallpaper Gallery-1.3.4.dmg`
- Linux: `dist-electron/Wallpaper Gallery-1.3.4.AppImage`

---

## 🎯 完整配置示例

### package.json
```json
{
  "name": "wallpaper-gallery",
  "version": "1.3.4",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "node scripts/generate-data.js && vite build",
    "electron:dev": "electron .",
    "electron:build": "electron-builder",
    "electron:build:win": "electron-builder --win",
    "electron:build:mac": "electron-builder --mac",
    "electron:build:linux": "electron-builder --linux"
  },
  "build": {
    "appId": "com.wallpaper.gallery",
    "productName": "Wallpaper Gallery",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "electron/**/*",
      "dist/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": [
            "x64"
          ]
        }
      ],
      "icon": "public/icon-192.png"
    },
    "mac": {
      "target": "dmg",
      "icon": "public/icon-192.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "installerIcon": "public/icon-192.png",
      "uninstallerIcon": "public/icon-192.png"
    }
  },
  "devDependencies": {
    "@capacitor/android": "8.0.0",
    "@capacitor/cli": "8.0.0",
    "@capacitor/core": "8.0.0",
    "electron": "^31.0.0",
    "electron-builder": "^25.1.8",
    "vite": "^7.2.4",
    "vite-plugin-pwa": "^1.2.0"
  }
}
```

---

## 🔧 进阶配置

### 1. 自动更新

安装 `electron-updater`:
```bash
pnpm add -D electron-updater
```

修改 `electron/main.js`:
```javascript
const { app, BrowserWindow, autoUpdater } = require('electron')

// 配置自动更新
const server = 'https://your-update-server.com'
const feed = `${server}/update/${process.platform}/${app.getVersion()}`

autoUpdater.setFeedURL(feed)

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  autoUpdater.checkForUpdates()
})
```

### 2. 系统托盘

修改 `electron/main.js`:
```javascript
const { Tray, Menu } = require('electron')
const path = require('path')

let tray

app.whenReady().then(() => {
  // 创建系统托盘
  tray = new Tray(path.join(__dirname, 'icon-16.png'))
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow.show() },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setToolTip('Wallpaper Gallery')
  tray.setContextMenu(contextMenu)
})
```

### 3. 菜单栏

修改 `electron/main.js`:
```javascript
const { Menu } = require('electron')

const template = [
  {
    label: '文件',
    submenu: [
      {
        label: '退出',
        accelerator: 'CmdOrCtrl+Q',
        click: () => app.quit()
      }
    ]
  },
  {
    label: '帮助',
    submenu: [
      {
        label: '关于',
        click: () => {
          // 显示关于对话框
        }
      }
    ]
  }
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)
```

---

## 📊 打包配置对比

| 配置项 | 值 | 说明 |
|--------|-----|------|
| appId | com.wallpaper.gallery | 应用唯一标识 |
| productName | Wallpaper Gallery | 应用显示名称 |
| output | dist-electron | 输出目录 |
| target (Windows) | nsis | Windows 安装程序 |
| target (macOS) | dmg | macOS 磁盘映像 |
| target (Linux) | AppImage | Linux 便携应用 |

---

## 🛠️ 常见问题

### Q: 打包后应用无法启动？
**A: 检查以下内容**:
1. ✅ 路由模式是否为 Hash 模式
2. ✅ dist 目录是否存在
3. ✅ electron/main.js 路径是否正确
4. ✅ package.json 的 main 字段是否正确

### Q: 打包体积过大？
**A: 优化建议**:
1. 排除不必要的文件
2. 使用 asar 压缩
3. 检查 node_modules 依赖

### Q: 路由无法正常工作？
**A: 使用 Hash 模式**:
```javascript
import { createRouter, createHashHistory } from 'vue-router'

const router = createRouter({
  history: createHashHistory(),
  routes
})
```

### Q: 开发模式 DevTools 无法打开？
**A: 检查 webPreferences**:
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true
}
```

---

## 📱 测试 EXE

### 1. 安装应用
双击 `dist-electron/Wallpaper Gallery Setup 1.3.4.exe`

### 2. 测试功能
- ✅ 应用启动
- ✅ 路由跳转
- ✅ 图片加载
- ✅ 响应式布局
- ✅ 性能测试

### 3. 检查日志
```bash
# Windows 日志位置
%APPDATA%\Wallpaper Gallery\logs

# 或在应用中查看
```

---

## 🚀 分发 EXE

### 方法一：直接分发
```bash
# 上传到服务器
scp dist-electron/Wallpaper\ Gallery\ Setup\ 1.3.4.exe user@server:/path/to/release/

# 生成下载链接
```

### 方法二：应用商店
- Microsoft Store
- 第三方应用商店

### 方法三：GitHub Releases
1. 创建 GitHub Release
2. 上传 EXE 文件
3. 发布 Release

---

## 📚 相关文档

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Electron Builder 文档](https://www.electron.build/)
- [Vue Router Hash 模式](https://router.vuejs.org/guide/essentials/history-mode.html#hash-mode)

---

## 🎯 快速开始命令

### 安装依赖
```bash
pnpm add -D electron electron-builder
```

### 开发模式
```bash
pnpm build
pnpm electron:dev
```

### 打包 EXE
```bash
pnpm electron:build:win
```

### 打包 DMG (macOS)
```bash
pnpm electron:build:mac
```

### 打包 AppImage (Linux)
```bash
pnpm electron:build:linux
```

---

**最后更新**: 2025-01-08
**分支**: feature/electron-desktop
**版本**: v1.0
