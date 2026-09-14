@echo off
chcp 65001 >nul
title 部署到 GitHub Pages
cd /d "%~dp0"

echo.
echo  ============================================
echo   部署「今天吃什么呀」到 GitHub Pages
echo  ============================================
echo.

rem 从 package.json 读取版本号（单一事实来源）
for /f "delims=" %%v in ('node -e "process.stdout.write(require('./package.json').version)"') do set APP_VERSION=%%v
if "%APP_VERSION%"=="" (
  echo  ❌ 读不到 package.json 里的 version，已中止
  pause
  exit /b 1
)
echo  版本号：v%APP_VERSION%
echo.

rem 校验 CHANGELOG.md 里写了这一版（防止改了代码忘了写日志）
node -e "const fs=require('fs');const v=require('./package.json').version;const s=fs.readFileSync('CHANGELOG.md','utf8');if(!s.includes('['+v+']')){console.log('  ⚠️  CHANGELOG.md 里没有 ['+v+'] 条目，建议先补更新日志');}else{console.log('  ✅ CHANGELOG.md 已含 ['+v+']');}"

set BASE_PATH=/eat-healthy

echo.
echo [1/3] 构建静态站点（子路径 %BASE_PATH%）...
call npm run build
if errorlevel 1 goto fail

echo.
echo [2/3] 准备发布产物（注入版本号 + .nojekyll）...
cd out
if not exist .nojekyll type nul > .nojekyll
rem 用 Node 替换 sw.js 里的版本占位符（PowerShell 的 Set-Content 会把 UTF-8 中文注释写成乱码）。
rem 全局替换 + 替换后校验：早期版本只替换第一处，且对已替换过的产物二次执行会静默失败。
node -e "const fs=require('fs');const v=require('../package.json').version;const d=new Date();const p=n=>String(n).padStart(2,'0');const b=d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'.'+p(d.getHours())+p(d.getMinutes());const f='sw.js';let s=fs.readFileSync(f,'utf8');if(!s.includes('__VERSION__')||!s.includes('__BUILD__')){console.error('  ❌ sw.js 里找不到 __VERSION__ / __BUILD__ 占位符，已中止');process.exit(1);}s=s.split('__VERSION__').join(v).split('__BUILD__').join(b);fs.writeFileSync(f,s,'utf8');console.log('  缓存版本：recipe-v'+v+'-'+b);"
if errorlevel 1 goto fail
if not exist .git git init -b gh-pages -q
git add -A
git commit -q -m "deploy: v%APP_VERSION%（%date% %time%）" 2>nul

echo.
echo [3/3] 推送到 gh-pages...
git push --force https://github.com/Orang1ver/eat-healthy.git gh-pages
if errorlevel 1 goto fail
cd ..

rem 给源码打发布标记（正规软件的发布标记；已存在则跳过）
git rev-parse -q --verify "refs/tags/v%APP_VERSION%" >nul 2>&1
if errorlevel 1 (
  git tag -a "v%APP_VERSION%" -m "发布 v%APP_VERSION%"
  echo   已打 tag v%APP_VERSION%
) else (
  echo   tag v%APP_VERSION% 已存在，跳过
)
git push origin "v%APP_VERSION%" 2>nul
git push mine "v%APP_VERSION%" 2>nul

echo.
echo  ✅ 已发布 v%APP_VERSION%，约 30-60 秒后生效：
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
