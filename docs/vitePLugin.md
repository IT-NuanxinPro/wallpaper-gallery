# Vite 自定义插件

项目自定义 Vite 插件位于 `build/`，实际启用项以 `vite.config.js` 为准。

## 📁 插件列表

### 1. vite-plugin-version.js

**功能**: 在构建时自动更新 `public/version.json` 文件

**用途**:
- 自动记录应用版本号和构建时间
- 用于前端版本检测和更新提示

**使用**:
```javascript
import { versionPlugin } from './build/vite-plugin-version.js'

export default defineConfig({
  plugins: [
    versionPlugin({
      version: '1.0.0',
      buildTime: '2026-01-10 20:00:00',
      outputPath: 'public/version.json', // 可选,默认值
    }),
  ],
})
```

**生成文件示例** (`public/version.json`):
```json
{
  "version": "1.0.0",
  "buildTime": "2026-01-10 20:00:00"
}
```

---

### 2. vite-plugin-obfuscate.js

**功能**: 对敏感文件进行代码混淆

**用途**:
- 保护核心业务逻辑不被轻易查看
- 混淆加密/解密相关代码
- 增加逆向工程难度

**使用**:
```javascript
import { obfuscatePlugin } from './build/vite-plugin-obfuscate.js'

export default defineConfig({
  plugins: [
    obfuscatePlugin({
      include: [
        'src/utils/common/codec.js',  // 加密解密
        'src/utils/config/constants.js', // 常量配置
        'src/utils/common/format.js', // URL 构建
      ],
    }),
  ],
})
```

---

### 3. vite-plugin-image-proxy.js

开发服务器通过该插件提供站内图片入口，以本地代理复用图片来源校验和回退逻辑。生产入口由部署平台处理。

Vue、Vue Router、Pinia 等启动依赖由 Vite 分包并随站点发布；壁纸图片 CDN 与应用启动依赖是独立的加载链路。

---

## 🔧 开发建议

### 创建新插件

1. 在 `build/` 目录下创建新文件 `vite-plugin-xxx.js`
2. 使用以下模板:

```javascript
/**
 * 插件名称
 * 插件功能描述
 */

/**
 * 插件函数
 * @param {Object} options 配置选项
 * @returns {import('vite').Plugin}
 */
export function xxxPlugin(options = {}) {
  return {
    name: 'vite-plugin-xxx',
    // Vite 插件钩子
    // https://vitejs.dev/guide/api-plugin.html
  }
}

export default xxxPlugin
```

3. 在 `vite.config.js` 中导入并使用:

```javascript
import { xxxPlugin } from './build/vite-plugin-xxx.js'

export default defineConfig({
  plugins: [
    xxxPlugin({ /* options */ }),
  ],
})
```

---

## 📚 参考资料

- [Vite 插件 API](https://vitejs.dev/guide/api-plugin.html)
- [Rollup 插件钩子](https://rollupjs.org/plugin-development/)
- [插件开发指南](https://vitejs.dev/guide/api-plugin.html#plugin-api)

---

**创建时间**: 2026-01-10
**维护者**: 暖心
