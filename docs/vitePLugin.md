# Vite 自定义插件

校对日期：2026-11-11。当前实际启用情况以 [vite.config.js](../vite.config.js) 为准。沿用原文件名以兼容已有链接。

| 插件 | 状态 | 作用 |
| --- | --- | --- |
| [vite-plugin-image-proxy.js](../build/vite-plugin-image-proxy.js) | 开发与 preview 启用 | 挂载 `/images/*`，与 Pages 共用图片请求校验及响应逻辑 |
| [vite-plugin-version.js](../build/vite-plugin-version.js) | 已注册，生产构建写文件 | 从 `package.json` 取网站版本，生成北京时间 `buildTime` 与 `public/version.json` |
| [vite-plugin-obfuscate.js](../build/vite-plugin-obfuscate.js) | 仅生产启用 | 对 `src/utils/common/codec.js`、`src/utils/config/constants.js`、`src/utils/common/format.js` 做构建混淆 |
| [vite-plugin-cdn.js](../build/vite-plugin-cdn.js) | 未导入、未启用 | 早期注入外部 Vue/Router 脚本的遗留文件，不应按旧示例重新开启 |

Vue、Vue Router、Pinia 等启动依赖随网站发布。混淆只改变产物可读性，不是加密、访问控制或存放密钥的方式。

## 图片入口

Vite 中间件和边缘 Function 共用 [server/image-proxy.js](../server/image-proxy.js)。本地缓存为内存缓存，重启清空；上线后缓存由 Cloudflare 提供。路径、容量和错误语义见 [图片入口部署](图片入口部署.md)。

## 版本文件

`package.json` 是网站语义版本来源；`buildStart` 在生产模式写入 `public/version.json` 并随 `dist` 发布。前端通过该文件发现网页更新。构建时间会变化，因此发布前应检查版本号及这份生成文件。

网站版本不决定桌面安装包版本。安装包信息来自 `public/desktop-release.json` 与对应 API，网页和原生更新由现有版本检查逻辑分别处理。

## 生产构建

`pnpm build:seo` 依次执行详情数据生成、Vite 构建和公共页面预渲染。Brotli 压缩、组件按需导入属于配置中使用的第三方插件，详情关键 CSS 内联由 [scripts/prerender.js](../scripts/prerender.js) 负责，不属于 CDN 注入。

修改插件后按范围验证：图片入口运行对应代理测试；版本插件检查 `dist/version.json`；涉及 HTML 或样式时检查预渲染页、详情 SSR 与客户端接管后的布局。
