# 手机独立运行（已部署）

## ✅ 线上地址

**https://orang1ver.github.io/eat-healthy/**

手机浏览器打开 → 添加到主屏幕 → 全屏 App，完全独立于电脑。

> 代码仓库：https://github.com/Orang1ver/eat-healthy

### 手机首次设置（数据只存本机，需各设备各做一次）

1. 右上角 ⚙️ 填入 DeepSeek API Key
2. 💪 健康小屋 → 填档案（年龄/身高/体重/活动量/目标）
3. 🍱 我的菜单库 → 截图导入学校食堂菜单

---

## 这个版本是什么

**纯前端应用**：没有服务端、没有数据库。数据存手机浏览器 localStorage，AI 请求由浏览器直接发往 DeepSeek。
因此可以完整静态导出（`npm run build` → `out/`，约 1.1 MB），丢到任意静态托管即可。

---

## 改完代码怎么重新部署

```bash
cd "C:/Users/StarRiver/Desktop/code/今天吃什么呀"

# 1. 提交源码
git add -A && git commit -m "..."

# 2. 用子路径构建（仓库名要和 BASE_PATH 一致）
MSYS_NO_PATHCONV=1 BASE_PATH=/eat-healthy npm run build
#   CMD/PowerShell 下用：set BASE_PATH=/eat-healthy && npm run build

# 3. 发布 out/ 到 gh-pages 分支
cd out && git add -A && git commit -m "deploy"
git push --force https://github.com/Orang1ver/eat-healthy.git gh-pages
```

> `out/` 里已经有独立的 git 仓库（gh-pages 分支），第 3 步直接复用即可。
> Pages 约 30~60 秒后自动重建。

---

## ⚠️ 两个必须知道的坑（都已在项目里修好，重装/重建时别丢掉）

**1. `public/.nojekyll` 不能删**
GitHub Pages 默认跑 Jekyll，而 Jekyll **会忽略下划线开头的目录**。
Next.js 的资源全在 `_next/` 下，少了这个文件，页面能打开但所有 JS/CSS 404（白屏）。

**2. `public/sw.js` 必须纳入版本管理**
老版本用 next-pwa 自动生成 `public/sw.js`，所以 `.gitignore` 里把它排除了。
现在 Service Worker 是手写的，若被忽略，部署产物就没有离线能力。

---

## 其它部署方式

### Cloudflare Pages（国内通常比 GitHub Pages 稳）
注册 https://dash.cloudflare.com/ → Workers & Pages → Create → Pages → Upload assets → 把 `out/` 拖进去。
注意：**根路径部署，不要设 `BASE_PATH`**。

### 只在家里/宿舍用（零部署，但电脑要开着）
双击 `启动.bat`，手机连同一 WiFi 访问黑窗口里的 `Network: http://192.168.x.x:3000`。
校园网若有 AP 隔离会失效——此时让电脑连手机热点。

---

## 常见问题

**打开是白屏 / 资源 404**
检查 `BASE_PATH` 与实际访问路径是否一致：GitHub Pages 地址形如 `https://用户名.github.io/仓库名/`，
所以 `BASE_PATH` 必须是 `/仓库名`；Cloudflare 上传方式在根路径，不要设 `BASE_PATH`。
另外确认 `out/.nojekyll` 存在。

**添加到主屏幕后图标空白**
确认 `out/icons/icon-192.png`、`icon-512.png` 存在（项目已提供）。

**AI 报 401 / Key 无效**
⚙️ 里检查 Key 是否有空格。Key 仅用于 DeepSeek 官方接口。

**截图识别报错**
走的是 `deepseek-flash` 视觉模型，需要 Key 有该模型权限。
可先用文字导入；或改 `NEXT_PUBLIC_DEEPSEEK_VISION_MODEL` 后重新构建。

**手机和电脑数据不一样**
正常：数据存在各自浏览器里，不跨设备同步。
