#!/bin/bash

# --- 1. 获取图床仓库最新的 CDN 版本 ---
echo "🔍 Fetching latest CDN version..."
LATEST_TAG=$(curl -s "https://api.github.com/repos/IT-NuanxinPro/nuanXinProPic/tags" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['name'] if data else 'v1.2.17')")

if [ -z "$LATEST_TAG" ] || [ "$LATEST_TAG" == "null" ]; then
  LATEST_TAG="v1.0.4"
  echo "⚠️ Failed to get tag from API, using fallback: $LATEST_TAG"
else
  echo "✅ Got latest CDN version: $LATEST_TAG"
fi

# --- 2. 修改 constants.js 中的版本号 ---
echo "📦 Updating src/utils/constants.js to version: $LATEST_TAG"
sed -i "s/export const CDN_VERSION = '[^']*'/export const CDN_VERSION = '$LATEST_TAG'/" src/utils/constants.js

# --- 3. 拉取图床仓库数据 (nuanXinProPic) ---
echo "🚚 Cloning nuanXinProPic repository..."
# 使用深度为 1 的克隆以加快速度
git clone --depth 1 https://github.com/IT-NuanxinPro/nuanXinProPic.git temp_nuanXinProPic

# --- 4. 准备 public/data 目录并同步数据 ---
echo "📂 Synchronizing data..."
mkdir -p public/data

if [ -d "temp_nuanXinProPic/data" ]; then
  # 同步 desktop/mobile/avatar 数据
  for series in desktop mobile avatar; do
    if [ -d "temp_nuanXinProPic/data/$series" ]; then
      echo "  Copying folder: $series..."
      cp -r "temp_nuanXinProPic/data/$series" public/data/
    fi
    if [ -f "temp_nuanXinProPic/data/$series.json" ]; then
      echo "  Copying file: $series.json..."
      cp "temp_nuanXinProPic/data/$series.json" public/data/
    fi
  done

  # 同步 Bing 数据
  if [ -d "temp_nuanXinProPic/bing/meta" ]; then
    echo "  Copying Bing meta data..."
    mkdir -p public/data/bing
    cp -r temp_nuanXinProPic/bing/meta/* public/data/bing/
  fi
  echo "✅ Data synchronized successfully"
else
  echo "⚠️ temp_nuanXinProPic/data not found! Attempting fallback generate..."
  # 如果你的项目环境支持执行 pnpm，可以在这里调用
  # pnpm generate
fi

# --- 5. 清理临时文件 ---
echo "🧹 Cleaning up..."
rm -rf temp_nuanXinProPic

echo "🚀 Pre-build process completed!"