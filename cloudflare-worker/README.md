# Cloudflare Workers APK 下载加速部署指南

## 📦 已完成的准备工作

✅ Worker 代码已准备：`cloudflare-worker/apk-download-proxy.js`
✅ app-version.json 已更新，指向加速域名

---

## 🚀 部署步骤

### 第 1 步：创建 Cloudflare Worker

1. 登录 Cloudflare Dashboard
   - 访问：https://dash.cloudflare.com
   - 选择你的账号和 `061129.xyz` 域名

2. 进入 Workers & Pages
   - 左侧菜单 → **Workers & Pages**
   - 点击 **Create application**

3. 选择部署方式
   - 点击 **"Create Worker"**
   - （或选择 **Direct Upload**）

4. 命名 Worker
   - 输入名称：`apk-download-proxy`
   - 点击 **Deploy**

### 第 2 步：上传 Worker 代码

1. 进入编辑器
   - 部署完成后，点击 **Edit code**

2. 替换代码
   - 删除默认的所有代码
   - 打开本地文件：`cloudflare-worker/apk-download-proxy.js`
   - **复制全部代码**
   - **粘贴到 Cloudflare 编辑器**

3. 保存并部署
   - 点击 **Deploy**
   - 等待部署完成（约 10 秒）

### 第 3 步：配置自定义域名

#### 方法 A：通过 Dashboard（推荐）

1. 进入 Worker 设置
   - 在 Worker 页面，点击 **Settings** 标签
   - 找到 **Triggers** 部分

2. 添加自定义域名
   - 点击 **Add Custom Domain**
   - 输入：`download.wallpaper.061129.xyz`
   - 点击 **Activate Domain**

3. 等待 DNS 生效
   - 通常 5-10 分钟完成
   - Cloudflare 会自动配置 DNS 记录

#### 方法 B：通过 DNS 配置

1. 添加 CNAME 记录
   - 进入 DNS → Records
   - 点击 **Add record**
   - Type: `CNAME`
   - Name: `download.wallpaper`
   - Target: `apk-download-proxy.workers.dev`
   - Proxy status: **Proxied**（橙色云朵图标）

2. 配置 Worker 路由
   - Workers & Pages → Triggers
   - 添加自定义域名：`download.wallpaper.061129.xyz`

---

## 🧪 测试部署

### 测试 1：验证 Worker 是否正常工作

1. 访问默认域名
   ```
   https://apk-download-proxy.workers.dev/IT-NuanxinPro/wallpaper-gallery/releases/download/v1.0.0/Wallpaper-Gallery-v1.0.0.apk
   ```

2. 检查响应
   - 应该开始下载 APK 文件
   - 或返回 404（文件不存在）

### 测试 2：验证自定义域名

1. 等待 DNS 生效（5-10 分钟）

2. 访问自定义域名
   ```
   https://download.wallpaper.061129.xyz/v1.0.0/Wallpaper-Gallery-v1.0.0.apk
   ```

3. 检查响应头（开发者工具）
   - 打开浏览器开发者工具（F12）
   - Network 标签
   - 找到下载请求
   - 查看响应头：
     - ✅ `cf-cache-status: HIT` 或 `MISS`
     - ✅ `cache-control: public, max-age=86400`

### 测试 3：测试下载速度

1. 清除浏览器缓存
2. 下载 APK 文件
3. 记录下载速度（应明显快于 GitHub 原始链接）

---

## 📝 Git 提操作

### 提交到 android 分支

```bash
git add cloudflare-worker/ public/app-version.json
git commit -m "feat: 添加 Cloudflare Workers 加速 APK 下载"
git push origin android
```

### 同步到 main 分支

```bash
git checkout main
git show android:public/app-version.json > public/app-version.json
git commit -m "chore: 同步 APK 下载加速配置"
git push origin main
```

---

## 🔧 配置说明

### URL 格式

**使用自定义域名：**
```
https://download.wallpaper.061129.xyz/{version}/{filename.apk}
```

**示例：**
```
https://download.wallpaper.061129.xyz/v1.0.0/Wallpaper-Gallery-v1.0.0.apk
```

### 缓存策略

- **缓存时长：** 24 小时（86400 秒）
- **缓存位置：** Cloudflare 全球 CDN 节点
- **缓存控制：** 通过 `Cache-Control` 头实现

### 支持的功能

✅ 断点续传（Range 请求）
✅ CORS 跨域支持
✅ 大文件下载（APK 通常 > 10MB）
✅ 自动重试机制
✅ 错误处理

---

## 📊 性能对比

### 预期性能提升

| 指标 | GitHub 原始链接 | Cloudflare Workers |
|------|---------------|------------------|
| 国内下载速度 | 50-200 KB/s | 1-5 MB/s |
| 首次响应时间 | 2-5 秒 | < 1 秒 |
| 稳定性 | 中等 | 高 |
| 跨域问题 | 可能存在 | 已解决 |

---

## 🔍 故障排查

### 问题 1：访问自定义域名 404

**原因：** DNS 未生效

**解决：**
1. 检查 DNS 记录是否已添加
2. 等待 5-10 分钟让 DNS 生效
3. 使用 `nslookup download.wallpaper.061129.xyz` 检查解析

### 问题 2：下载速度没有提升

**原因：** 文件未命中缓存

**解决：**
1. 等待第二次下载（第一次会 MISS，第二次会 HIT）
2. 检查响应头中的 `cf-cache-status`
3. 如果一直是 MISS，检查缓存配置

### 问题 3：Worker 报错

**原因：** 代码或配置错误

**解决：**
1. 检查 Worker 日志：Workers & Pages → apm-download-proxy → Logs
2. 确认代码已正确粘贴
3. 重新部署 Worker

---

## 📞 技术支持

如有问题，请检查：

1. **Cloudflare 状态页面：** https://www.cloudflarestatus.com
2. **Workers 文档：** https://developers.cloudflare.com/workers
3. **自定义域名文档：** https://developers.cloudflare.com/workers/platform/routing

---

## 🎉 完成！

部署完成后，你的 APK 下载将享受：

✅ 全球 CDN 加速
✅ 24 小时智能缓存
✅ 断点续传支持
✅ 专业域名体验

用户下载速度预计提升 **10-50 倍**！
