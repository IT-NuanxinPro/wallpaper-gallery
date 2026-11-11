# Vite 自定义插件

本目录包含项目使用的自定义 Vite 插件。

## 📁 插件列表

### 1. vite-plugin-cdn.js

**功能**: 在生产环境构建时注入 CDN 脚本,并移除 Import Map

**用途**:
- 将 Vue、Vue Router 等依赖从 CDN 加载,减小打包体积
- 自动移除开发环境的 Import Map
- 在正确位置注入 CDN 脚本

**使用**:
```javascript
import { cdnPlugin } from './build/vite-plugin-cdn.js'

export default defineConfig({
  plugins: [
    cdnPlugin({
      css: [],
      js: [
        'https://unpkg.com/vue@3.5.24/dist/vue.global.prod.js',
        'https://unpkg.com/vue-router@4.6.4/dist/vue-router.global.prod.js',
      ],
    }),
  ],
})
```

**默认 CDN**:
- Vue 3.5.24
- Vue Demi 0.14.10
- Vue Router 4.6.4

---

### 2. vite-plugin-version.js

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

### 3. vite-plugin-obfuscate.js

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
        'src/utils/codec.js',        // 加密解密
        'src/utils/constants.js',    // 常量配置
        'src/utils/format.js',       // URL 构建
      ],
    }),
  ],
})
```

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
