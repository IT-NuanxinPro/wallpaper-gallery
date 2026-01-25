#!/bin/bash

# 生成 Electron 应用图标
# 需要安装 ImageMagick: brew install imagemagick (macOS)

set -e

SOURCE_ICON="public/icon-192.png"
BUILD_DIR="build"

# 检查源图标是否存在
if [ ! -f "$SOURCE_ICON" ]; then
  echo "❌ Error: Source icon not found: $SOURCE_ICON"
  exit 1
fi

# 创建 build 目录
mkdir -p "$BUILD_DIR"

echo "🎨 Generating app icons..."

# 检查是否安装了 ImageMagick
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
  echo "⚠️ ImageMagick not found. Please install it:"
  echo "   macOS: brew install imagemagick"
  echo "   Ubuntu: sudo apt-get install imagemagick"
  exit 1
fi

# 使用 magick 命令（ImageMagick 7+）或 convert（旧版本）
MAGICK_CMD="magick"
if ! command -v magick &> /dev/null; then
  MAGICK_CMD="convert"
fi

# 生成 Windows .ico (包含多个尺寸)
echo "📦 Generating Windows icon (.ico)..."
$MAGICK_CMD "$SOURCE_ICON" -resize 256x256 \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 -alpha on -colors 256 "$BUILD_DIR/icon.ico"

echo "✅ Windows icon generated: $BUILD_DIR/icon.ico"

# 生成 macOS .icns
echo "📦 Generating macOS icon (.icns)..."

# 创建临时目录
ICONSET_DIR="$BUILD_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# 生成各种尺寸的 PNG
$MAGICK_CMD "$SOURCE_ICON" -resize 16x16 "$ICONSET_DIR/icon_16x16.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 32x32 "$ICONSET_DIR/icon_16x16@2x.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 32x32 "$ICONSET_DIR/icon_32x32.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 64x64 "$ICONSET_DIR/icon_32x32@2x.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 128x128 "$ICONSET_DIR/icon_128x128.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 256x256 "$ICONSET_DIR/icon_128x128@2x.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 256x256 "$ICONSET_DIR/icon_256x256.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 512x512 "$ICONSET_DIR/icon_256x256@2x.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 512x512 "$ICONSET_DIR/icon_512x512.png"
$MAGICK_CMD "$SOURCE_ICON" -resize 1024x1024 "$ICONSET_DIR/icon_512x512@2x.png"

# 使用 iconutil 生成 .icns (仅 macOS)
if command -v iconutil &> /dev/null; then
  iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"
  echo "✅ macOS icon generated: $BUILD_DIR/icon.icns"
else
  echo "⚠️ iconutil not found (macOS only). Skipping .icns generation."
fi

# 清理临时文件
rm -rf "$ICONSET_DIR"

echo "🎉 Icon generation complete!"
echo "📂 Generated files:"
ls -lh "$BUILD_DIR"/icon.*
