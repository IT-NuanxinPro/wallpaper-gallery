import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // 文件读取
  readLocalFile: filePath => ipcRenderer.invoke('read-local-file', filePath),

  // 核心功能
  downloadImage: (url, filename) => ipcRenderer.invoke('download-image', url, filename),
  setWallpaper: url => ipcRenderer.invoke('set-wallpaper', url),
  openWallpaperFolder: () => ipcRenderer.invoke('open-wallpaper-folder'),

  // 更新功能
  updateWallpaperData: () => ipcRenderer.invoke('update-wallpaper-data'),
  openExternal: url => ipcRenderer.invoke('open-external', url),

  // 环境判断
  isElectron: true,
  // eslint-disable-next-line node/prefer-global/process
  platform: process.platform, // 'darwin', 'win32', 'linux'
})
