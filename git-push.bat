@echo off
chcp 65001 > nul
echo ==========================================
echo        一键推送到 GitHub
echo ==========================================
echo.

:: 检查是否有未提交的更改
git status --porcelain > nul 2>&1
if errorlevel 1 (
    echo [错误] 当前目录不是 Git 仓库
    pause
    exit /b 1
)

:: 显示当前更改
echo [信息] 检查当前更改...
git status -s
echo.

:: 如果没有更改，提示并退出
for /f %%i in ('git status --porcelain') do set HAS_CHANGES=1
if not defined HAS_CHANGES (
    echo [信息] 没有需要提交的更改
    pause
    exit /b 0
)

:: 询问提交信息（默认值）
set /p COMMIT_MSG="请输入提交信息 (直接回车使用默认): "
if "%COMMIT_MSG%"=="" (
    :: 生成默认提交信息（带时间戳）
    for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set TODAY=%%a-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set NOW=%%a:%%b
    set COMMIT_MSG=更新代码 %TODAY% %NOW%
)

echo.
echo [步骤 1/3] 添加所有更改...
git add -A
if errorlevel 1 (
    echo [错误] git add 失败
    pause
    exit /b 1
)

echo [步骤 2/3] 提交更改: %COMMIT_MSG%
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo [警告] 提交失败或没有新更改
)

echo [步骤 3/3] 推送到远程仓库...
git push
if errorlevel 1 (
    echo.
    echo [错误] 推送失败！可能的原因：
    echo   - 网络连接问题
    echo   - 远程仓库有新的更改（需要先 pull）
    echo   - 没有推送权限
    echo.
    echo 尝试拉取远程更改...
    git pull --rebase
    if errorlevel 1 (
        echo [错误] 拉取失败，请手动解决冲突
        pause
        exit /b 1
    )
    echo 重新推送...
    git push
    if errorlevel 1 (
        echo [错误] 推送仍然失败
        pause
        exit /b 1
    )
)

echo.
echo ==========================================
echo        推送成功！
echo ==========================================
echo.
pause