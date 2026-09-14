# 手机使用与部署

> ## ⚠️ 授权提醒
> 本项目是 **[@FishBone0v0](https://github.com/FishBone0v0) 的
> [AI-recipe-recommendation-system](https://github.com/FishBone0v0/AI-recipe-recommendation-system)**
> 的衍生版本。**原项目未附 LICENSE、未声明开源协议（默认保留所有权利）**，
> 因此本衍生版**不应公开分发**。下面的公开部署方式仅供个人自用参考；
> 若要长期公开使用，请先取得原作者许可，或直接使用原项目。

## ✅ 当前线上地址（个人自用）

**https://orang1ver.github.io/eat-healthy/**

代码仓库：https://github.com/Orang1ver/eat-healthy

---

# 一、iPhone 使用（家人照这个做）

## 1. 添加到主屏幕（必做）

iOS 不像安卓会自动提示安装，必须手动加一次：

1. **用 Safari 打开** `https://orang1ver.github.io/eat-healthy/`
   （微信/QQ 内置浏览器**没有**这个选项，一定用 Safari）
2. 点底部中间的 **分享** 按钮 ⬆️
3. 向下滑，选 **「添加到主屏幕」**
4. 起个名字（默认「今天吃什么」）→ 点「添加」
5. 桌面出现图标，以后**从图标打开**，就是全屏 App，没有浏览器地址栏

> 打开后首页顶部也会有一条引导横幅提醒你，照着做即可。

## 2. 首次设置（每台设备各做一次）

1. 右上角 **⚙️** → 填 **DeepSeek API Key**（在 platform.deepseek.com 注册后创建）
2. **💪 健康小屋** → 填性别/年龄/身高体重/活动量/目标 → 保存
3. **🍱 我的菜单库** → 把学校食堂菜单截图导进来（详见第三节）

> 数据只存在这台手机上，手机之间不同步。**给家人配的省事办法见第四节「数据备份」。**

## 3. 为什么一定要"添加到主屏幕"

| | 加主屏（推荐） | 只在 Safari 里用 |
|---|---|---|
| 数据保留 | ✅ 真实磁盘持久存储，**豁免** 7 天清除规则 | ⚠️ 7 天不访问会被清空 |
| 界面 | 全屏，无地址栏，有启动图 | 带浏览器地址栏 |
| 通知权限 | 可申请 | 不可申请 |

---

# 二、喝水 / 步数提醒（用 iPhone 快捷指令，零成本）

Web 推送在国内有硬限制（安卓依赖的 FCM 被墙，网页推送服务域名也被墙），
所以这里用 iPhone 自带的**快捷指令**做提醒，不引入任何服务器，也不上传你的数据。

**代价说清楚**：这种提醒是"盲提醒"——它不知道你今天实际喝了多少，
只是到点戳你一下。想知道"还差多少"，打开 App 看首页的「今日进度」卡片。

## 设置步骤（在 iPhone 上操作）

1. 打开 **「快捷指令」** App → 底部 **「自动化」** → 右上角 **＋**
2. 选 **「特定时间」** → 设为 **10:00** → 重复选 **「每天」**
3. 选 **「立即运行」**（不要选"运行前询问"，否则每次都要点确认）
4. 搜索并添加动作 **「显示通知」**，内容填：
   - 标题：`该喝水啦 💧`
   - 正文：`打开 App 看看今天还差几杯`
5. 保存。再照同样步骤加 **12:00 / 15:00 / 20:00** 的提醒
6. 再加一条 **18:00** 的走路提醒，正文写 `该走一走啦 🚶 看看今天还差多少步`

> 想让提醒更直接，可以在「显示通知」前面加一个 **「打开 App」** 动作指向本应用，
> 这样点通知就直接打开 App 看进度。

---

# 三、菜单库怎么快速建起来

在 **美团/饿了么/淘宝闪购/食堂小程序**里打开菜单页 → 截图 → 打开 App 的
**🍱 我的菜单库** → **Ctrl+V 粘贴**（手机上点「点击选择截图」从相册选）→
填商家名（可选）→ 点「让 AI 整理进菜单库」。

AI 会自动认出菜名和价格，并补上分类/口味/忌口标签。一次最多 5 张截图。
识别结果不满意可以单独删掉，或点「恢复示例库」重来。

---

# 四、数据备份与换机（重要）

数据只存在本机浏览器里。以下情况**必须**先导出备份：

- 换手机 / 换浏览器
- 清理浏览器数据、卸载重装 App
- 想把配置分享给家人（省去每家手工填 Key、重导菜单库）

## 导出

⚙️ 设置 → **「数据备份」** 页签 → 勾选是否包含 API Key → 「导出为文件」或「复制备份内容」

## 导入

把备份内容发给对方 → 对方在同一个页签的「从备份导入」里粘贴 →
选 **「合并导入」**（保留对方已有数据）或 **「覆盖导入」**（清空后整份替换）

> **给家人配置的最快路径**：你在自己手机上配好 Key + 档案 + 菜单库 →
> 导出（勾选包含 Key）→ 发给家人 → 家人粘贴导入 → 完成，一分钟搞定。

> ⚠️ 备份里含 API Key，等同于你的账号额度凭证，**别发到公开场合**。

---

# 五、版本管理（发版前必读）

版本号只有一个来源：**`package.json` 的 `version`**。

发一版要做的：

1. `npm version minor --no-git-tag-version`（新功能用 `minor`，修 bug 用 `patch`，不兼容改动用 `major`）
2. **在 `CHANGELOG.md` 顶部加一条**（不写的话 `部署.bat` 会警告）
3. 同步改 `app/lib/changelog.ts` 里的要点（App 设置页「本次更新内容」展示的就是它）
4. 跑 `部署.bat` —— 自动读版本、注入 Service Worker 缓存名、打 `vX.Y.Z` 的 git tag

发完之后，手机上：⚙️ 设置 →「版本」页签能看到 **版本号 + 构建时间**；
有新版本时首页顶部会出现 `✨ 发现新版本 1.0.0 → 1.0.1`。

---

# 六、改完代码怎么重新部署

## 方式 A：双击 `部署.bat`（推荐）

它会自动完成构建 → 准备产物 → 推送 gh-pages，约 1 分钟。完成后等 30~60 秒网站就更新了。

## 方式 B：手动命令

```bash
cd "C:/Users/StarRiver/Desktop/code/今天吃什么呀"

# 1. 提交源码
git add -A && git commit -m "..."

# 2. 用子路径构建（仓库名必须和 BASE_PATH 一致）
#    ⚠️ 这一步会清空并重建 out/，里面的 .git 也会没掉，所以第 3 步要重新 init
MSYS_NO_PATHCONV=1 BASE_PATH=/eat-healthy npm run build
#   CMD/PowerShell：set BASE_PATH=/eat-healthy && npm run build

# 3. 发布 out/ 到 gh-pages 分支（每次都要重新 init）
cd out
touch .nojekyll
git init -b gh-pages
git add -A && git commit -m "deploy"
git push --force https://github.com/Orang1ver/eat-healthy.git gh-pages
```

Pages 约 30~60 秒后自动重建。

> **改完务必点击验证一遍**：只测路由地址是不够的——之前正是这样漏掉了一个 bug
> （页面里用原生 `<a href="/health">` 跳转，漏掉了 basePath，部署到子路径后点击 404；
> 而直接访问路由地址却是 200，所以那种测法测不出来）。
>
> 仓库里已备好验证脚本，**解析页面里的真实链接并逐个访问**，等价于把每个按钮点一遍：
>
> ```bash
> MSYS_NO_PATHCONV=1 BASE_PATH=/eat-healthy npm run build
> mkdir -p /tmp/site && cp -r out /tmp/site/eat-healthy && (cd /tmp/site && python -m http.server 4177 &)
> python scripts/verify-subpath.py
> ```

## 改子路径时必须同步的 3 处（否则 404 或白屏）

| 位置 | 说明 |
|---|---|
| 仓库名 = `BASE_PATH` | GitHub Pages 地址是 `https://用户名.github.io/仓库名/`，两者必须一致 |
| `out/.nojekyll` 必须存在 | GitHub Pages 默认跑 Jekyll，**会忽略下划线开头的 `_next/` 目录**，缺了它页面能开但 JS/CSS 全 404（白屏）。源码里已放 `public/.nojekyll` 自动带入 |
| 站内跳转一律用 `<Link>` | Next.js **只给 `next/link` 的 `<Link>` 自动加 basePath**，原生 `<a href="/xxx">` 不会。ESLint 的 `no-html-link-for-pages` 规则会报错，**不要忽略它** |

---

# 七、其它部署方式

## Cloudflare Pages（国内通常比 GitHub Pages 稳）
注册 https://dash.cloudflare.com/ → Workers & Pages → Create → Pages → Upload assets → 把 `out/` 拖进去。
注意：**根路径部署，不要设 `BASE_PATH`**。

## 只在家里/宿舍用（零部署，但电脑要开着）
双击 `启动.bat`，手机连同一 WiFi 访问黑窗口里的 `Network: http://192.168.x.x:3000`。
校园网若有 AP 隔离会失效——此时让电脑连手机热点。

---

# 八、常见问题

**打开是白屏 / 资源 404**
`BASE_PATH` 与实际访问路径不一致，或 `out/.nojekyll` 缺失。见第五节表格。

**点击「健康小屋」「本周回顾」跳 404**
说明站内跳转用了原生 `<a>` 而不是 `<Link>`。这是本项目踩过的坑，见第五节。

**添加到主屏幕后图标空白 / 启动时闪白屏**
确认 `out/icons/` 有 192 与 512 图标、`out/splash/` 有启动图（项目已提供）。

**步数能不能自动同步？**
不能。微信运动只能在微信小程序里读取（网页调不到，且数据需后端解密）；
华为 Health Kit 只有 REST API，需要开发者账号审批 + 后端保存密钥；
小米手环没有面向第三方的开放 API。
另外 iOS 上已加到主屏的 App 与 Safari 的存储互相隔离，也无法用快捷指令"写进去"。
若要真自动，只能做原生 App（iOS 用 HealthKit、安卓用 Health Connect），那是另一个量级的工程。
当前 App 内提供了档位快选 / 滑块 / 直接输入，几秒能填完。

**喝水/步数提醒能不能推送？**
见第二节。国内 Web 推送受限，用 iPhone 快捷指令替代。

**AI 报 401 / Key 无效**
⚙️ 里检查 Key 是否有空格。Key 仅用于 DeepSeek 官方接口。

**截图识别报错**
走的是 `deepseek-flash` 视觉模型，需要 Key 有该模型权限。
可先用文字导入；或改 `NEXT_PUBLIC_DEEPSEEK_VISION_MODEL` 后重新构建。

**手机和电脑数据不一样**
正常：数据存在各自浏览器里，不跨设备同步。用第四节备份迁移。
