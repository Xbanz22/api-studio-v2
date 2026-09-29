#!/bin/bash

echo "🚀 API Studio - Starting..."

# Install dependencies kalau belum ada
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install --no-audit --no-fund
fi

# Build backend kalau dist/server.cjs belum ada
if [ ! -f "dist/server.cjs" ]; then
  echo "🔨 Building backend..."
  npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
fi

# Copy db-adapter
[ -f "db-adapter.cjs" ] && cp db-adapter.cjs dist/db-adapter.cjs 2>/dev/null

# Start server
echo "✅ Starting server on port $PORT..."
node dist/server.cjs
