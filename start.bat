@echo off
chcp 65001 >nul
title Industry Tycoon

echo ========================================
echo   Industry Tycoon
echo   Victoria 3 Style Business Simulation
echo ========================================
echo.

:: Check pnpm
where pnpm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pnpm not found, please install pnpm first
    echo Run: npm install -g pnpm
    pause
    exit /b 1
)

:: Check node_modules
if not exist "node_modules" (
    echo [INFO] First run, installing dependencies...
    call pnpm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Check if shared package is built
if not exist "packages\shared\dist" (
    echo [INFO] Building shared package...
    call pnpm --filter @scc/shared build
    if errorlevel 1 (
        echo [ERROR] Failed to build shared package
        pause
        exit /b 1
    )
)

:: Check if game-core package is built
if not exist "packages\game-core\dist" (
    echo [INFO] Building game-core package...
    call pnpm --filter @scc/game-core build
    if errorlevel 1 (
        echo [ERROR] Failed to build game-core package
        pause
        exit /b 1
    )
)

echo [START] Starting server and client...
echo.
echo   Server: http://localhost:3002
echo   Client: http://localhost:5173
echo.
echo   Press Ctrl+C to stop all services
echo ========================================
echo.

:: Start server and client in new windows
start "SCC Server" cmd /c "cd packages\server && pnpm dev"
timeout /t 2 >nul
start "SCC Client" cmd /c "cd packages\client && pnpm dev"

:: Wait for client to start then open browser
echo [INFO] Waiting for services to start...
timeout /t 3 >nul
echo [INFO] Opening browser...
start http://localhost:5173

echo.
echo [INFO] Services started!
echo.
echo   - Server window: SCC Server
echo   - Client window: SCC Client
echo   - Browser: http://localhost:5173
echo.
echo Close this window will NOT stop services.
echo You need to close server and client windows manually.
echo.
pause