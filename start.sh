#!/bin/bash

echo "========================================"
echo "排砖宝项目启动脚本"
echo "========================================"
echo ""

echo "[1/3] 检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi
node --version
echo "✅ Node.js 已安装"
echo ""

echo "[2/3] 检查 Python 版本..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 未安装，请先安装 Python 3.11+"
    exit 1
fi
python3 --version
echo "✅ Python 已安装"
echo ""

echo "[3/3] 检查 pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，正在安装..."
    npm install -g pnpm
fi
pnpm --version
echo "✅ pnpm 已安装"
echo ""

echo "========================================"
echo "开始安装依赖"
echo "========================================"
echo ""

echo "[前端] 安装前端依赖..."
pnpm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
echo "✅ 前端依赖安装完成"
echo ""

echo "[后端] 安装后端依赖..."
cd backend
if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装 Python 依赖..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
echo "✅ 后端依赖安装完成"
cd ..
echo ""

echo "========================================"
echo "安装完成！"
echo "========================================"
echo ""
echo "接下来请手动启动服务："
echo ""
echo "[前端] 在项目根目录运行："
echo "  pnpm --filter @tilelayout/web dev"
echo "  访问: http://localhost:3000"
echo ""
echo "[后端] 在 backend 目录运行："
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  uvicorn main:app --reload --port 8000"
echo "  访问: http://localhost:8000/api/docs"
echo ""
echo "[数据库] 使用 Docker 启动："
echo "  docker-compose up -d postgres"
echo ""
echo "详细文档请查看："
echo "  - DEVELOPMENT_REPORT.md"
echo "  - ARCHITECTURE.md"
echo "  - README.md"
echo ""
