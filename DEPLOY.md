# 部署到手机（独立运行，不依赖电脑）

这个版本是**纯前端应用**：没有服务端、没有数据库，所有数据存在手机浏览器的 localStorage 里，AI 请求由浏览器直接发往 DeepSeek。
所以只要把 `out/` 这个静态目录放到任意一个能上网的地方，手机就能独立使用。

构建产物：`npm run build` → `out/`（约 1.1 MB）

---

## 方案 A：GitHub Pages（已用 GitHub 的话最省事）

> ⚠️ 国内部分网络访问 `*.github.io` 不稳定甚至打不开。先在手机浏览器试一下能否打开
> https://orang1ver.github.io/ ，能打开再走这个方案。

1. 在 GitHub 上新建一个仓库，例如 `eat-healthy`（Public）
2. 本地把这个项目推上去：

```bash
cd "C:/Users/StarRiver/Desktop/code/今天吃什么呀"
git remote add mine https://github.com/Orang1ver/eat-healthy.git
git push mine main
```

3. 用子路径构建（**仓库名要和 BASE_PATH 一致**）：

```bash
# Git Bash 下必须加 MSYS_NO_PATHCONV=1，否则 /eat-healthy 会被当成 Windows 路径
MSYS_NO_PATHCONV=1 BASE_PATH=/eat-healthy npm run build

# CMD / PowerShell 下：
# set BASE_PATH=/eat-healthy && npm run build
```

4. 发布 `out/` 到 `gh-pages` 分支：

```bash
cd out
git init -b gh-pages
git add -A
git commit -m "deploy"
git push --force https://github.com/Orang1ver/eat-healthy.git gh-pages
```

5. 仓库 Settings → Pages → Source 选 `gh-pages` 分支 → 保存
6. 手机打开 `https://orang1ver.github.io/eat-healthy/` → 添加到主屏幕

---

## 方案 B：Cloudflare Pages（国内访问通常比 GitHub Pages 稳）

1. 打开 https://dash.cloudflare.com/ ，注册/登录
2. Workers & Pages → Create → Pages → **Upload assets**
3. 项目名随意（如 `eat-healthy`），把 `out/` 整个目录拖进去上传
4. 得到 `https://eat-healthy.pages.dev`，手机打开 → 添加到主屏幕

> 注意：Cloudflare Pages 上传方式部署在**根路径**，用默认构建即可（**不要**设 `BASE_PATH`）。

---

## 方案 C：只在家里/宿舍用（零部署，但电脑要开着）

电脑上双击 `启动.bat`，手机连同一个 WiFi，访问黑窗口里显示的
`Network: http://192.168.x.x:3000`。电脑关机就不能用了。

> 校园网若有 AP 隔离（同 WiFi 设备禁止互访），此方案会失效——此时让电脑连手机热点。

---

## 部署后手机上的首次设置

1. 右上角 ⚙️ 填入 DeepSeek API Key
2. 💪 健康小屋 → 填档案（年龄/身高/体重/活动量/目标）
3. 🍱 我的菜单库 → 截图导入学校食堂的菜单
4. 之后就能正常推荐了

> 数据存在各自浏览器里，**不会跨设备同步**：手机和电脑是两套独立数据。
> 换手机或清除浏览器数据后，需要重新导入菜单库。

---

## 常见问题

**Q：手机上打开是白屏 / 资源 404？**
多半是 `BASE_PATH` 和实际访问路径不一致。GitHub Pages 的访问地址形如
`https://用户名.github.io/仓库名/`，所以 `BASE_PATH` 必须是 `/仓库名`；
Cloudflare Pages 上传方式在根路径，不要设 `BASE_PATH`。

**Q：添加到主屏幕后图标是空白？**
确认 `out/icons/icon-192.png` 和 `icon-512.png` 存在（本项目已提供）。

**Q：AI 报 401 / Key 无效？**
在 ⚙️ 里检查 Key 是否填对；Key 只能用于 DeepSeek 官方接口，注意不要有多余空格。

**Q：截图识别报错？**
截图识别走 `deepseek-flash` 视觉模型，需要你的 Key 有该模型权限；若报模型不存在，
可在设置里换回文字导入，或在 `.env.example` 里改 `NEXT_PUBLIC_DEEPSEEK_VISION_MODEL` 后重新构建。
