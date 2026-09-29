#!/bin/bash

# Kalau repo belum ke-clone, clone dulu
if [ ! -f "package.json" ]; then
  echo "📦 Cloning repository..."
  git clone https://github.com/Xbanz22/api-studio-v2.git . 2>&1
fi

# Install dependencies kalau belum ada
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install --no-audit --no-fund
fi

# Build backend kalau belum ada
if [ ! -f "dist/server.cjs" ]; then
  echo "🔨 Building backend..."
  npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
fi

# Start server
echo "✅ Starting server..."
node dist/server.cjs
