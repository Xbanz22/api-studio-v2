#!/bin/bash

echo "🚀 API Studio - Starting..."

# Kalau BUKAN git repo, clone ulang
if [ ! -d ".git" ]; then
  echo "📦 Cloning repository (fresh)..."
  rm -rf /home/container/* /home/container/.[!.]* 2>/dev/null
  git clone https://github.com/Xbanz22/api-studio-v2.git /home/container 2>&1
fi

# Pull update
echo "🔄 Pulling latest..."
git fetch origin main 2>&1
git reset --hard origin/main 2>&1

# Install deps
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install --no-audit --no-fund
fi

# Build backend
echo "🔨 Building backend..."
npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs 2>&1
[ -f "db-adapter.cjs" ] && cp db-adapter.cjs dist/db-adapter.cjs

# Download cloudflared kalau belum ada
if [ ! -f "./cloudflared" ]; then
  echo "📥 Downloading cloudflared..."
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ./cloudflared
  chmod +x ./cloudflared
fi

# Jalanin cloudflared di background
echo "🌐 Starting cloudflared tunnel..."
./cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARED_TOKEN" > /tmp/cloudflared.log 2>&1 &
sleep 5
tail -20 /tmp/cloudflared.log

# Start server
echo "✅ Starting server on port $PORT..."
node dist/server.cjs
