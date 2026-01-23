@echo off
chcp 65001 >nul 2>&1
title Supply Chain Commander
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Supply Chain Commander
echo   Victoria 3 Style Business Simulation
echo ========================================
echo.

:: ========================================
:: Step 1: Check Node.js
:: ========================================
echo [1/6] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js not found!
    echo.
    echo Please install Node.js v20 or higher:
    echo   Download: https://nodejs.org/
    echo   Recommended: LTS version
    echo.
    echo After installation, run this script again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1" %%a in ('node -v') do set NODE_VERSION=%%a
echo       Node.js version: %NODE_VERSION%

:: ========================================
:: Step 2: Check/Install pnpm
:: ========================================
echo [2/6] Checking pnpm...
where pnpm >nul 2>&1
if errorlevel 1 (
    echo       pnpm not found, installing...
    call npm install -g pnpm@latest
    if errorlevel 1 (
        echo [ERROR] Failed to install pnpm!
        pause
        exit /b 1
    )
    echo       pnpm installed!
) else (
    for /f "tokens=1" %%a in ('pnpm -v') do set PNPM_VERSION=%%a
    echo       pnpm version: !PNPM_VERSION!
)

:: ========================================
:: Step 3: Create .env file if not exists
:: ========================================
echo [3/6] Checking config files...
if not exist "packages\server\.env" (
    if exist "packages\server\.env.example" (
        echo       Creating .env config file...
        copy "packages\server\.env.example" "packages\server\.env" >nul
        echo       Config file created!
        echo.
        echo ========================================
        echo   NOTE: LLM API can be configured in-game
        echo   Click Settings button after startup
        echo ========================================
        echo.
    )
) else (
    echo       Config file exists
)

:: Create data directory if not exists
if not exist "packages\server\data" (
    mkdir "packages\server\data"
)

:: ========================================
:: Step 4: Install dependencies
:: ========================================
echo [4/6] Checking dependencies...
if not exist "node_modules" (
    echo       First run, installing dependencies...
    echo       This may take a few minutes...
    call pnpm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo       Dependencies installed!
) else (
    echo       Dependencies already installed
)

:: ========================================
:: Step 5: Build shared packages
:: ========================================
echo [5/6] Checking build status...
set NEED_BUILD=0

if not exist "packages\shared\dist" set NEED_BUILD=1
if not exist "packages\game-core\dist" set NEED_BUILD=1

if %NEED_BUILD%==1 (
    echo       Building project...
    
    if not exist "packages\shared\dist" (
        echo       - Building shared module...
        call pnpm --filter @scc/shared build
        if errorlevel 1 (
            echo [ERROR] Failed to build shared module!
            pause
            exit /b 1
        )
    )
    
    if not exist "packages\game-core\dist" (
        echo       - Building game-core module...
        call pnpm --filter @scc/game-core build
        if errorlevel 1 (
            echo [ERROR] Failed to build game-core module!
            pause
            exit /b 1
        )
    )
    
    echo       Build completed!
) else (
    echo       Project already built
)

:: ========================================
:: Step 6: Start services
:: ========================================
echo [6/6] Starting game services...
echo.
echo ========================================
echo   Server: http://localhost:3002
echo   Client: http://localhost:5173
echo.
echo   Press Ctrl+C to stop services
echo ========================================
echo.

:: Start server in new window
start "SCC Server" cmd /k "cd packages\server && pnpm dev"

:: Wait for server to initialize
echo Starting server...
timeout /t 3 >nul

:: Start client in new window
start "SCC Client" cmd /k "cd packages\client && pnpm dev"

:: Wait for client to start
echo Starting client...
timeout /t 4 >nul

:: Open browser
echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo   Game started successfully!
echo.
echo   If browser did not open, visit:
echo   http://localhost:5173
echo.
echo   Service windows:
echo   - SCC Server
echo   - SCC Client
echo.
echo   Closing this window will NOT stop
echo   the game. Close Server and Client
echo   windows to fully exit.
echo ========================================
echo.
pause