# Android APK 打包指南 (Capacitor)

## 📱 项目配置

### 应用信息
- **App ID**: `com.wallpaper.gallery`
- **App Name**: `Wallpaper Gallery`
- **Web 目录**: `dist`
- **Android Scheme**: `https`

---

## 🚀 快速开始

### 1. 环境准备

#### 安装 Java JDK (必需)
```bash
# macOS
brew install openjdk@17

# 验证安装
java -version
```

#### 安装 Android Studio (必需)
1. 下载 Android Studio: https://developer.android.com/studio
2. 安装后，打开 Android Studio
3. 安装 SDK (API Level 33+)
4. 安装 Android SDK Build-Tools
5. 配置 ANDROID_HOME 环境变量

```bash
# macOS
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 添加到 ~/.zshrc 或 ~/.bash_profile
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.zshrc
source ~/.zshrc
```

### 2. 项目配置

#### capacitor.config.json
```json
{
  "appId": "com.wallpaper.gallery",
  "appName": "Wallpaper Gallery",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  },
  "android": {
    "allowMixedContent": true,
    "captureInput": true,
    "webContentsDebuggingEnabled": false
  }
}
```

---

## 📦 打包流程

### 步骤 1: 构建 Web 项目

```bash
# 构建 Web 项目
pnpm build

# 或使用 generate 命令（包含数据生成）
pnpm generate
```

### 步骤 2: 同步到 Android

```bash
# 同步 Web 资源到 Android
npx cap sync android

# 如果需要强制刷新
npx cap copy android
```

### 步骤 3: 打包 APK

#### 方法一：使用 Gradle (推荐)

```bash
# 进入 Android 目录
cd android

# Debug 版本（开发测试）
./gradlew assembleDebug

# Release 版本（发布）
./gradlew assembleRelease
```

**输出位置**:
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

#### 方法二：使用 Android Studio

1. 打开 Android Studio
2. 打开项目: `File -> Open` -> 选择 `android` 目录
3. 等待 Gradle 同步完成
4. 点击 `Build -> Build Bundle(s) / APK(s) -> Build APK(s)`

---

## 🔐 签名 APK (Release 版本)

### 创建签名密钥

```bash
# 生成签名密钥（有效期为 10000 天）
keytool -genkey -v -keystore wallpaper-gallery.keystore \
  -alias wallpaper-gallery \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 输入密钥库密码（记住这个密码！）
# 输入密钥密码（记住这个密码！）
# 填写证书信息（姓名、组织等）
```

### 配置签名

创建 `android/keystore.properties`:
```properties
storeFile=wallpaper-gallery.keystore
storePassword=你的密钥库密码
keyAlias=wallpaper-gallery
keyPassword=你的密钥密码
```

修改 `android/app/build.gradle`:
```gradle
android {
    // ... 其他配置

    signingConfigs {
        release {
            def keystorePropertiesFile = rootProject.file("keystore.properties")
            def keystoreProperties = new Properties()
            keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 打包签名的 APK

```bash
cd android
./gradlew assembleRelease
```

**输出位置**: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🎯 快速打包命令

### Debug 版本
```bash
pnpm build
npx cap sync android
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release 版本（未签名）
```bash
pnpm build
npx cap sync android
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Release 版本（已签名）
```bash
pnpm build
npx cap sync android
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

---

## 📊 APK 信息

### 文件大小
- Debug APK: ~20-30 MB
- Release APK: ~15-25 MB (压缩后)

### 包含内容
- Web 应用代码 (dist/)
- Capacitor Runtime
- Android 系统库

---

## 🛠️ 常见问题

### Q: Gradle 构建失败？
**A: 检查以下内容**:
1. ✅ Java JDK 是否已安装
2. ✅ ANDROID_HOME 是否已配置
3. ✅ Android SDK 是否已安装
4. ✅ 网络连接是否正常（Gradle 需要下载依赖）

### Q: APK 安装失败？
**A: 检查以下内容**:
1. ✅ APK 是否已签名（Release 版本）
2. ✅ 手机是否允许安装未知来源应用
3. ✅ Android 版本是否满足要求（API 21+）

### Q: 应用无法访问网络？
**A: 检查配置**:
```json
{
  "android": {
    "allowMixedContent": true
  }
}
```

---

## 📱 测试 APK

### 安装到设备
```bash
# 使用 ADB 安装
adb install android/app/build/outputs/apk/debug/app-debug.apk

# 卸载应用
adb uninstall com.wallpaper.gallery

# 查看日志
adb logcat | grep "wallpaper"
```

### 真机测试
1. 将 APK 传输到手机
2. 在手机上安装 APK
3. 测试应用功能
4. 检查性能和兼容性

---

## 🚀 上架 Google Play

### 1. 准备材料
- 应用图标 (512x512)
- 应用截图 (至少 2 张)
- 应用描述
- 隐私政策
- 签名的 APK 或 AAB

### 2. 创建 Google Play 开发者账号
1. 访问 https://play.google.com/console
2. 注册开发者账号（$25 美元一次性费用）
3. 创建应用

### 3. 上传应用
1. 填写应用信息
2. 上传 APK/AAB
3. 填写商店信息
4. 提交审核

### 4. 审核通过后发布
- 审核时间: 1-3 天
- 发布后即可下载

---

## 📚 相关文档

- [Capacitor Android 文档](https://capacitorjs.com/docs/android)
- [Android 官方文档](https://developer.android.com/)
- [Google Play 上架指南](https://support.google.com/googleplay/android-developer)

---

**最后更新**: 2025-01-08
**分支**: feature/capacitor-android
**版本**: v1.0
