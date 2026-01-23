#!/bin/bash

# Supply Chain Commander - 供应链指挥官
# 一键启动脚本 (Linux/Mac)

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       Supply Chain Commander - 供应链指挥官                ║"
echo "║       Victoria 3 Style Business Simulation                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========================================
# Step 1: Check Node.js
# ========================================
echo -e "[1/6] 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo ""
    echo -e "${RED}[错误] 未检测到 Node.js！${NC}"
    echo ""
    echo "请先安装 Node.js v20 或更高版本:"
    echo "  macOS:  brew install node"
    echo "  Ubuntu: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  或访问: https://nodejs.org/"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v)
echo "      Node.js 版本: $NODE_VERSION"

# ========================================
# Step 2: Check/Install pnpm
# ========================================
echo "[2/6] 检查 pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "      pnpm 未安装，正在安装..."
    npm install -g pnpm@latest
    echo -e "      ${GREEN}pnpm 安装完成！${NC}"
else
    PNPM_VERSION=$(pnpm -v)
    echo "      pnpm 版本: $PNPM_VERSION"
fi

# ========================================
# Step 3: Create .env file if not exists
# ========================================
echo "[3/6] 检查配置文件..."
if [ ! -f "packages/server/.env" ]; then
    if [ -f "packages/server/.env.example" ]; then
        echo "      创建 .env 配置文件..."
        cp "packages/server/.env.example" "packages/server/.env"
        echo -e "      ${GREEN}配置文件已创建！${NC}"
        echo ""
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║  提示: LLM API 可以在游戏内设置                              ║"
        echo "║  启动后点击左侧 ⚙️ 设置按钮配置 OpenAI/Gemini API             ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo ""
    fi
else
    echo "      配置文件已存在"
fi

# Create data directory if not exists
mkdir -p "packages/server/data"

# ========================================
# Step 4: Install dependencies
# ========================================
echo "[4/6] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "      首次运行，正在安装依赖（可能需要几分钟）..."
    pnpm install
    echo -e "      ${GREEN}依赖安装完成！${NC}"
else
    echo "      依赖已安装"
fi

# ========================================
# Step 5: Build shared packages
# ========================================
echo "[5/6] 检查编译状态..."
NEED_BUILD=0

if [ ! -d "packages/shared/dist" ]; then
    NEED_BUILD=1
fi
if [ ! -d "packages/game-core/dist" ]; then
    NEED_BUILD=1
fi

if [ $NEED_BUILD -eq 1 ]; then
    echo "      正在编译项目（首次运行需要较长时间）..."
    
    # Build shared package
    if [ ! -d "packages/shared/dist" ]; then
        echo "      - 编译 shared 模块..."
        pnpm --filter @scc/shared build
    fi
    
    # Build game-core package
    if [ ! -d "packages/game-core/dist" ]; then
        echo "      - 编译 game-core 模块..."
        pnpm --filter @scc/game-core build
    fi
    
    echo -e "      ${GREEN}编译完成！${NC}"
else
    echo "      项目已编译"
fi

# ========================================
# Step 6: Start services
# ========================================
echo "[6/6] 启动游戏服务..."
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  服务器地址: http://localhost:3002                          ║"
echo "║  游戏地址:   http://localhost:5173                          ║"
echo "║                                                              ║"
echo "║  按 Ctrl+C 可以停止所有服务                                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "正在停止服务..."
    kill $SERVER_PID 2>/dev/null || true
    kill $CLIENT_PID 2>/dev/null || true
    echo "服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start server in background
echo "正在启动服务器..."
cd packages/server && pnpm dev &
SERVER_PID=$!
cd ../..

# Wait for server to initialize
sleep 3

# Start client in background
echo "正在启动客户端..."
cd packages/client && pnpm dev &
CLIENT_PID=$!
cd ../..

# Wait for client to start
sleep 4

# Open browser (macOS/Linux)
echo "正在打开浏览器..."
if command -v open &> /dev/null; then
    open http://localhost:5173
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173
else
    echo "请手动打开浏览器访问: http://localhost:5173"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✓ 游戏已启动！                                              ║"
echo "║                                                              ║"
echo "║  如果浏览器没有自动打开，请手动访问:                         ║"
echo "║  http://localhost:5173                                       ║"
echo "║                                                              ║"
echo "║  按 Ctrl+C 停止所有服务                                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Wait for background processes
wait