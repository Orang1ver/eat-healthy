# AGENTS.md —— 「今天吃什么呀」项目约定（接手前必读）

> 这份文件是给**任何在此项目上工作的 agent**（Codex / Claude / 其他）看的。
> 用户是中文母语者，请用**中文**汇报。

---

## 0. 一句话背景

一个**纯前端**的健康饮食助手（AI 推荐 + 健康打卡 + 食堂/外卖菜单库）。
数据全部存**浏览器 localStorage**，没有服务端、没有数据库、没有 API 路由。
构建产物是静态站点，部署在 GitHub Pages 的**子路径** `/eat-healthy/` 下。

⚠️ **授权状态**：本项目是上游 [FishBone0v0/AI-recipe-recommendation-system](https://github.com/FishBone0v0/AI-recipe-recommendation-system)
的衍生版，上游**未附 LICENSE**（默认保留所有权利）。**仅供个人自用，不得公开分发或商用。**
README 顶部的授权声明不要删除。

---

## 1. 工作流程（用户明确要求，务必遵守）

用户**平时就在用这个程序**，所以不要直接改他正在用的目录。

```bash
REPO="C:/Users/StarRiver/Desktop/code/今天吃什么呀"
DEV="C:/Users/StarRiver/Desktop/code/今天吃什么呀.dev"

# 1) 开分支 + 独立 worktree（路径必须是绝对路径）
git -C "$REPO" worktree add "$DEV" -b feat/<简短名字>

# 2) 所有编辑、构建、测试都在 worktree 里做（先 npm install）
cd "$DEV" && npm install

# 3) 自检全绿后才回主目录合并
git -C "$REPO" merge --no-ff feat/<名字>

# 4) 收尾：清 worktree + 分支，然后推送（见第 2 节）
git -C "$REPO" worktree remove "$DEV" && git -C "$REPO" branch -d feat/<名字>
```

踩过的坑：
- worktree 路径传相对路径会被建到仓库目录**内部**，后续命令找不到
- 报 `Device or resource busy` 时，先把 shell 的 cwd 切出该目录再删
- 自检：`npm run lint` + 构建（见第 5 节）

---

## 2. 推送目标（最容易错，先看这里）

| remote | 地址 | 能否推 |
|---|---|---|
| **`mine`** | `https://github.com/Orang1ver/eat-healthy.git` | ✅ **源码推这个**（分支 `main`） |
| `origin` | 上游原作者仓库 | ❌ **没有权限，绝对不要推** |

```bash
GIT_TERMINAL_PROMPT=0 git -C "$REPO" push mine main
```

> 若报 `Could not resolve host: github.com`：用户机器上的 Steam++（Watt Toolkit）
> 没在运行。它一退出就会还原 hosts，导致 github.com 走被污染的国内 DNS 而解析失败。
> **这不是代码问题**，让用户打开 Steam++ 即可，说明清楚后等恢复再推。

发布静态站点用一键脚本（会用 `package.json` 的版本号注入 SW 缓存名并打 tag）：

```bash
cd "$REPO" && node scripts/deploy.mjs     # 或双击 部署.bat
```

---

## 3. 数据安全（红线）

- **用户的数据全在浏览器 localStorage**，key 前缀 `recipe.`。改数据结构时**必须考虑老用户迁移**。
- 曾经踩过：`seedTakeoutMockIfEmpty` 用「库为空」当条件重新灌示例数据，
  导致用户把商家全删光后一刷新示例库又回来了（像"删不掉"）。
  修法是**一次性标记**控制，并带迁移：已有标记 → 返回；库里已有数据（老用户）→ 只补标记、**绝不动数据**；真正首次 → 播种 + 标记。
  **写这类逻辑时顺序错了就会覆盖用户数据。**
- 新增 localStorage 键时：
  - 用 `recipe.` 前缀 → 自动被备份导出/导入/清空覆盖
  - `app/lib/backup.ts` 的 `describeBackup` 是**子串硬编码**映射，**新键要补一行**，否则导入预览看不到
  - 键名**不要**与既有键产生子串重叠（例如别叫 `recipe.takeoutMock.snapshot.v1`，会被 `has("takeoutMock")` 误判）
- 不要提交或覆盖这些（都在 .gitignore 里）：`out/`、`node_modules/`、`.next/`，
  以及用户机器上其它项目的数据文件（`study.json`、`activity.csv`、`backups/` 等）。
- **测试时不要用 `tabs[0]` 之类的模糊定位去操作浏览器**：曾误把测试数据写进用户"线上站点"那个
  标签页，覆盖了他的 API Key。要**按 URL 精确匹配**标签页，只操作本地测试页。

---

## 4. 已知地雷（都踩过，改之前先读）

1. **站内跳转必须用 `next/link` 的 `<Link>`**。
   Next.js 只给 `<Link>` 自动加 `basePath`，原生 `<a href="/health">` 在子路径下会**跳到站点根、404**。
   本项目 lint 的 `no-html-link-for-pages` 规则会报这个错，**不要忽略它**。
2. **`public/.nojekyll` 不能删**。GitHub Pages 默认跑 Jekyll，会忽略下划线开头的 `_next/` 目录——
   缺了它页面能打开但所有 JS/CSS 404（白屏）。
3. **不要动 `public/sw.js` 的版本机制**：`__VERSION__` / `__BUILD__` 由 `scripts/deploy.mjs` 发布时注入，
   缓存名形如 `recipe-v1.5.2-20260915.0008`。手改会破坏更新链路。
4. **不要改 iOS 更新机制**：`updateViaCache: "none"` + 回前台 `reg.update()` + 版本化缓存名
   + `forceRefresh()`（清 Cache Storage + 带时间戳重进）是专门为解决
   「iOS 主屏 App 看不到新版」修的。看似多余，删了就会复发。
   ⚠️ 注意：清的是 **Cache Storage**，用户数据在 **localStorage**，两者无关。
5. **数字输入框必须用字符串 state**。用 `value={number}` + `onChange={Number(v) || 0}`
   会导致**删不掉、永远留个 0**（这个 bug 修过一次）。
   参考 `app/components/WeightCard.tsx`：`useState<string>("")`，保存时才 `Number()` 并校验。
6. **图片有尺寸硬限制**：接口要求**单边 ≤ 8192 像素**（一次含 15+ 张时降到 4096）、
   单张 ≤ 32 MiB、请求体 ≤ 48 MiB；且进模型前每张图会被自动缩到「约 1300×1300 等效」。
   所以**长截图必须切段**（`app/lib/image.ts`：每段 ≤ 170 万像素、单边 ≤ 4096、重叠 80px）。
   直接把长图缩小是**错的**——文字会糊到识别不出来。
7. **`app/health/page.tsx` 已经很大**（600+ 行、18 个 useState）。新增功能请**封装成独立组件**
   （照 `WeightCard` / `ExerciseCard`：状态自管、通过回调通知父组件），不要继续往页面里塞顶级 state。
8. **奖励/徽章是独立命名空间**：`rewards.badges`（打卡）与 `exerciseAwards`（运动）**不能混用**，
   否则运动成就会污染打卡徽章墙（显示成"还差 N 天"）。
9. **`out/` 会被每次构建清空**（含里面的 `.git`），所以手动发布 gh-pages 时每次都要重新 `git init`。

---

## 5. 验证要求（用户要求讲清"怎么验证的"）

改动完成后至少做到：

```bash
cd "$DEV"
npx eslint <改动的文件>                              # 见下方"基线告警"说明
MSYS_NO_PATHCONV=1 BASE_PATH=/eat-healthy npm run build   # 必须成功
```

**基线告警**：项目里有一批**预期内**的 lint 报错（`setState` in effect、`catch (e: any)`），
是沿用既有风格，**不要去"修"它们**。判断某条是不是你引入的：
`git stash` 后在干净工作区跑同一命令，对比数量。

**子路径点击验证**（防 404，本项目的老 bug）：

```bash
# 把 out/ 铺成 <临时目录>/eat-healthy/ 后在该目录起静态服务
python -m http.server 4177
python scripts/verify-subpath.py     # 解析页面真实链接逐个访问，等价于把每个按钮点一遍
```

⚠️ **只测路由地址是不够的**——曾经因为原生 `<a>` 漏了 basePath，直接访问路由是 200、
点击却 404，所以那种测法测不出来。

**部署后要轮询确认，不要只看脚本输出**：GitHub Pages 构建 + CDN 传播可能**要 1~3 分钟**
（曾因只等 60 秒就误判"发布失败"）：

```bash
curl -s "https://orang1ver.github.io/eat-healthy/sw.js?cb=$(date +%s)" | grep -o 'const APP_VERSION = "[^"]*"'
```

界面类改动**要在浏览器里真点一遍**（含 iOS 相关改动——用户家人用 iPhone）。

---

## 6. 版本与发布

- **版本号唯一来源 = `package.json` 的 `version`**。递增规则**偏克制**：
  - 成块的新功能（新增完整模块/页面/能力）→ MINOR
  - **其余一切**（修 bug、样式/文案、加个按钮、小增强）→ **PATCH**
  - 只改文档/注释/构建脚本 → **不升版本**
  - 拿不准就选小的那个
- 每次发版**必须同步改三处**：`package.json`、`CHANGELOG.md`（顶部加 `## [x.y.z] - 日期`）、
  `app/lib/changelog.ts`（数组**最前面**插入）。`scripts/deploy.mjs` 只校验前两者。
- 发布：`node scripts/deploy.mjs`（自动：读版本 → 校验日志 → 构建 → 注入 SW 版本号 →
  推 gh-pages → 打 `vX.Y.Z` tag）。详见 `README.md` 的「版本管理」与 `DEPLOY.md` 第五节。

---

## 7. 汇报习惯

- **中文**，讲清三件事：**改了什么 / 为什么这么改 / 怎么验证的**
- 有副作用或取舍要主动说明（例如"同名覆盖会覆盖你手工改过的内容，但有快照可撤销"）
- 顺手 commit + push 到 `mine`；网络不通就**说明情况等恢复**，不要静默跳过
- 拿到不确定的信息（用户偏好、外部约束）**先问再动手**，不要猜

---

## 8. 快速索引

| 想做什么 | 看哪里 |
|---|---|
| 功能与技术栈 | `README.md` |
| 手机使用 / 部署 / 常见问题 | `DEPLOY.md` |
| 各版本改了什么 | `CHANGELOG.md`（权威）、`app/lib/changelog.ts`（App 内展示） |
| AI Prompt 与调用 | `app/lib/prompts.ts`、`app/lib/deepseek.ts`、`app/lib/ai.ts` |
| 本地数据读写 | `app/lib/storage.ts`（含备份/快照/迁移逻辑） |
| 健康计算 | `app/lib/health.ts`、`app/lib/steps.ts`、`app/lib/weight.ts`、`app/lib/exercise.ts` |
| 长图切段 | `app/lib/image.ts` |
| 设计系统（颜色/按钮/卡片） | `README.md` 的「设计系统」+ `app/globals.css` |
| 一键发布 / 本地启动 | `部署.bat`、`启动.bat`、`scripts/deploy.mjs` |
