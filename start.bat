@echo off
chcp 65001 >nul
title Industry Tycoon - 一键启动

echo ========================================
echo   Industry Tycoon - 工业大亨
echo   Victoria 3 Style Business Simulation
echo ========================================
echo.

:: 检查 pnpm
where pnpm >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 pnpm，请先安装 pnpm
    echo 运行: npm install -g pnpm
    pause
    exit /b 1
)

:: 检查 node_modules
if not exist "node_modules" (
    echo [信息] 首次运行，正在安装依赖...
    call pnpm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo [启动] 正在启动服务器和客户端...
echo.
echo   服务器: http://localhost:3002
echo   客户端: http://localhost:5173
echo.
echo   按 Ctrl+C 停止所有服务
echo ========================================
echo.

:: 启动服务器和客户端
start "SCC Server" cmd /c "cd packages\server && pnpm dev"
timeout /t 2 >nul
start "SCC Client" cmd /c "cd packages\client && pnpm dev"

:: 等待客户端启动后自动打开浏览器
echo [信息] 等待服务启动...
timeout /t 3 >nul
echo [信息] 正在打开浏览器...
start http://localhost:5173

echo.
echo [信息] 服务已启动完毕！
echo.
echo   - 服务器窗口: SCC Server
echo   - 客户端窗口: SCC Client
echo   - 浏览器: http://localhost:5173
echo.
echo 关闭此窗口不会停止服务，需要手动关闭服务器和客户端窗口
echo.
pause