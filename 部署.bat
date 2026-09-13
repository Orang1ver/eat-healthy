@echo off
chcp 65001 >nul
title 部署到 GitHub Pages
cd /d "%~dp0"

echo.
echo  ============================================
echo   部署「今天吃什么呀」到 GitHub Pages
echo  ============================================
echo.

set BASE_PATH=/eat-healthy

echo [1/3] 构建静态站点（子路径 %BASE_PATH%）...
call npm run build
if errorlevel 1 goto fail

echo.
echo [2/3] 准备发布产物...
cd out
if not exist .nojekyll type nul > .nojekyll
if not exist .git git init -b gh-pages -q
git add -A
git commit -q -m "deploy: %date% %time%" 2>nul

echo.
echo [3/3] 推送到 gh-pages...
git push --force https://github.com/Orang1ver/eat-healthy.git gh-pages
if errorlevel 1 goto fail
cd ..

echo.
echo  ✅ 部署完成！约 30-60 秒后生效：
echo     https://orang1ver.github.io/eat-healthy/
echo.
echo  建议再跑一次验证（在 Git Bash 里）：
echo     python scripts\verify-subpath.py
echo.
pause
exit /b 0

:fail
cd /d "%~dp0"
echo.
echo  ❌ 出错了，请把上面的输出发给 ZCode 看
echo.
pause
exit /b 1
