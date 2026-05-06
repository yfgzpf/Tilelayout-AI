@echo off
echo ========================================
echo 排砖宝项目启动脚本
echo ========================================
echo.

echo [1/3] 检查 Node.js 版本...
node --version
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js 18+
    pause
    exit /b 1
)
echo ✅ Node.js 已安装
echo.

echo [2/3] 检查 Python 版本...
python --version
if errorlevel 1 (
    echo ❌ Python 未安装，请先安装 Python 3.11+
    pause
    exit /b 1
)
echo ✅ Python 已安装
echo.

echo [3/3] 检查 pnpm...
pnpm --version
if errorlevel 1 (
    echo ❌ pnpm 未安装，正在安装...
    npm install -g pnpm
)
echo ✅ pnpm 已安装
echo.

echo ========================================
echo 开始安装依赖
echo ========================================
echo.

echo [前端] 安装前端依赖...
call pnpm install
if errorlevel 1 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 前端依赖安装完成
echo.

echo [后端] 安装后端依赖...
cd backend
if not exist venv (
    echo 创建 Python 虚拟环境...
    python -m venv venv
)

echo 激活虚拟环境...
call venv\Scripts\activate

echo 安装 Python 依赖...
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 后端依赖安装完成
cd ..
echo.

echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 接下来请手动启动服务：
echo.
echo [前端] 在项目根目录运行：
echo   pnpm --filter @tilelayout/web dev
echo   访问: http://localhost:3000
echo.
echo [后端] 在 backend 目录运行：
echo   cd backend
echo   venv\Scripts\activate
echo   uvicorn main:app --reload --port 8000
echo   访问: http://localhost:8000/api/docs
echo.
echo [数据库] 使用 Docker 启动：
echo   docker-compose up -d postgres
echo.
echo 详细文档请查看：
echo   - DEVELOPMENT_REPORT.md
echo   - ARCHITECTURE.md
echo   - README.md
echo.
pause
