@echo off
chcp 65001 >nul
title 今天吃什么呀
cd /d "%~dp0"

echo.
echo   🥗 今天吃什么呀 —— 正在启动，浏览器稍后会自动打开...
echo   关闭本窗口即可停止服务。
echo.

start "" cmd /c "timeout /t 5 >nul & start http://localhost:3000"
npm run dev
