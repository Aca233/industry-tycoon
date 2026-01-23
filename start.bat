@echo off
chcp 65001 >nul
title Supply Chain Commander - 供应链指挥官
setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║       Supply Chain Commander - 供应链指挥官                ║
echo ║       Victoria 3 Style Business Simulation                  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: ========================================
:: Step 1: Check Node.js
:: ========================================
echo [1/6] 检查 Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [错误] 未检测到 Node.js！
    echo.
    echo 请先安装 Node.js v20 或更高版本:
    echo   下载地址: https://nodejs.org/
    echo   推荐安装 LTS (长期支持版本)
    echo.
    echo 安装完成后，请重新运行此脚本。
    echo.
    pause
    exit /b 1
)

:: Check Node.js version (need v20+)
for /f "tokens=1" %%a in ('node -v') do set NODE_VERSION=%%a
echo       Node.js 版本: %NODE_VERSION%

:: ========================================
:: Step 2: Check/Install pnpm
:: ========================================
echo [2/6] 检查 pnpm...
where pnpm >nul 2>&1
if errorlevel 1 (
    echo       pnpm 未安装，正在安装...
    call npm install -g pnpm@latest
    if errorlevel 1 (
        echo [错误] pnpm 安装失败！
        pause
        exit /b 1
    )
    echo       pnpm 安装完成！
) else (
    for /f "tokens=1" %%a in ('pnpm -v') do set PNPM_VERSION=%%a
    echo       pnpm 版本: !PNPM_VERSION!
)

:: ========================================
:: Step 3: Create .env file if not exists
:: ========================================
echo [3/6] 检查配置文件...
if not exist "packages\server\.env" (
    if exist "packages\server\.env.example" (
        echo       创建 .env 配置文件...
        copy "packages\server\.env.example" "packages\server\.env" >nul
        echo       配置文件已创建！
        echo.
        echo ╔══════════════════════════════════════════════════════════════╗
        echo ║  提示: LLM API 可以在游戏内设置                              ║
        echo ║  启动后点击左侧 ⚙️ 设置按钮配置 OpenAI/Gemini API             ║
        echo ╚══════════════════════════════════════════════════════════════╝
        echo.
    )
) else (
    echo       配置文件已存在
)

:: Create data directory if not exists
if not exist "packages\server\data" (
    mkdir "packages\server\data"
)

:: ========================================
:: Step 4: Install dependencies
:: ========================================
echo [4/6] 检查依赖...
if not exist "node_modules" (
    echo       首次运行，正在安装依赖（可能需要几分钟）...
    call pnpm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败！
        pause
        exit /b 1
    )
    echo       依赖安装完成！
) else (
    echo       依赖已安装
)

:: ========================================
:: Step 5: Build shared packages
:: ========================================
echo [5/6] 检查编译状态...
set NEED_BUILD=0

if not exist "packages\shared\dist" set NEED_BUILD=1
if not exist "packages\game-core\dist" set NEED_BUILD=1

if %NEED_BUILD%==1 (
    echo       正在编译项目（首次运行需要较长时间）...
    
    :: Build shared package
    if not exist "packages\shared\dist" (
        echo       - 编译 shared 模块...
        call pnpm --filter @scc/shared build
        if errorlevel 1 (
            echo [错误] shared 模块编译失败！
            pause
            exit /b 1
        )
    )
    
    :: Build game-core package
    if not exist "packages\game-core\dist" (
        echo       - 编译 game-core 模块...
        call pnpm --filter @scc/game-core build
        if errorlevel 1 (
            echo [错误] game-core 模块编译失败！
            pause
            exit /b 1
        )
    )
    
    echo       编译完成！
) else (
    echo       项目已编译
)

:: ========================================
:: Step 6: Start services
:: ========================================
echo [6/6] 启动游戏服务...
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  服务器地址: http://localhost:3002                          ║
echo ║  游戏地址:   http://localhost:5173                          ║
echo ║                                                              ║
echo ║  按 Ctrl+C 可以停止服务                                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Start server in new window
start "SCC Server" cmd /k "cd packages\server && pnpm dev"

:: Wait for server to initialize
echo 正在启动服务器...
timeout /t 3 >nul

:: Start client in new window
start "SCC Client" cmd /k "cd packages\client && pnpm dev"

:: Wait for client to start
echo 正在启动客户端...
timeout /t 4 >nul

:: Open browser
echo 正在打开浏览器...
start http://localhost:5173

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  ✓ 游戏已启动！                                              ║
echo ║                                                              ║
echo ║  如果浏览器没有自动打开，请手动访问:                         ║
echo ║  http://localhost:5173                                       ║
echo ║                                                              ║
echo ║  服务窗口:                                                   ║
echo ║  - SCC Server (服务器)                                       ║
echo ║  - SCC Client (客户端)                                       ║
echo ║                                                              ║
echo ║  关闭此窗口不会停止游戏，                                    ║
echo ║  需要关闭 Server 和 Client 窗口才能完全退出。                ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause