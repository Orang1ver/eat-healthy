@echo off
chcp 65001 >nul
title 部署到 GitHub Pages
cd /d "%~dp0"

rem ASCII-only wrapper on purpose:
rem cmd cannot reliably parse a .bat containing UTF-8 Chinese (it reads bytes, so
rem multibyte chars can break quote pairing and even run text fragments as commands).
rem All real logic lives in scripts/deploy.mjs, which handles UTF-8 correctly.

node scripts\deploy.mjs
if errorlevel 1 goto fail

echo.
pause
exit /b 0

:fail
echo.
echo  Deploy failed. Please send the output above to ZCode.
echo.
pause
exit /b 1
