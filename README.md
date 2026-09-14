# 🍱 今天吃什么呀 — AI 智能食谱推荐系统

> ## ⚠️ 关于本项目（必读）
>
> 这是一个**衍生项目（derivative work）**，基于 **[@FishBone0v0](https://github.com/FishBone0v0)** 的
> **[AI-recipe-recommendation-system](https://github.com/FishBone0v0/AI-recipe-recommendation-system)** 修改而来。
>
> **原项目的著作权归原作者所有。** 原仓库目前**未附带 LICENSE 文件、未声明开源协议**（即默认保留所有权利），
> 因此本衍生版本**不应该被公开分发或用于商业用途**。
>
> 本仓库当前仅作个人学习与自用目的；公开托管属于未经授权的分发，正在联系原作者取得许可。
> **如果你是从公开渠道看到本仓库：请直接使用原项目**，而不是本衍生版本。
>
> 若要继续公开使用，请先取得原作者授权，或改用原项目地址。

**PRD文档和技术文档详见`/docs/PRD.md`与`/doc/TECH_SPEC.md`**

一款以**治愈风格**为核心设计语言的中文 AI 饮食助手，帮你用现有食材决定今天吃什么，记录每周饮食，并由 AI 营养分析师给出个性化建议。

![Tech Stack](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![DeepSeek](https://img.shields.io/badge/DeepSeek-API-6366f1)
![PWA](https://img.shields.io/badge/PWA-支持-green)

---

## ✨ 功能特性

> 以下前四节（🍳 自己做 / 🛵 点外卖 / 📅 本周饮食回顾 / 🧠 用户饮食档案）为**原作者 FishBone0v0 的功能**；
> 其后带「**衍生版新增**」标注的三节为本衍生版本添加。

### 🍳 自己做 — AI 菜品推荐
- 从常用食材标签中选取今日食材（支持自定义添加）
- 口味偏好、忌口/过敏标签选择（含麻辣↔不吃辣互斥逻辑）
- 做法偏好标签（火锅 / 炒 / 蒸煮 / 烤等）
- 份量场景预设（1人食盖饭 / 小火锅 / 家常 2 菜 1 汤 / 丰盛等）
- 自由文本饮食目标（增肌 / 减脂 / 补充维生素 / 想吃点温暖的…）
- AI 根据食材 + 标签 + 饮食历史生成推荐菜谱，附治愈系评语
- 交互式购物清单（勾选划掉，调料自动排除）

### 🛵 点外卖 — 外卖智能推荐
- 三阶段漏斗：硬过滤忌口 → 口味偏好排序 → AI 语义选择
- 防幻觉设计：AI 只能从数据库 ID 中选择，服务端 join 完整数据
- 推荐理由结合近期饮食历史，说明为什么今天适合吃这道

### 📅 本周饮食回顾
- 7 列日历视图，按时间排序显示每天所有饮食记录
- 手动补录任意时间点的一餐（自由时间选择，不限早/午/晚）
- 点击卡片可查看详情、编辑菜品/时间或删除记录
- AI 生成（非量化）本周饮食点评，触发用户饮食习惯档案自动更新

### 🧠 用户饮食档案
- 每次生成本周分析后，AI 自动维护 Markdown 格式的饮食习惯笔记
- 后续推荐时自动注入，实现越用越懂你的个性化效果

### 📱 手机独立运行（衍生版新增 · 纯前端化）

**已部署上线：<https://orang1ver.github.io/eat-healthy/>** —— 手机浏览器打开后「添加到主屏幕」即为全屏 App，不依赖电脑。**安卓与 iOS 用同一套，不用分开做**（安卓 Chrome 会主动提示安装，iOS 需手动添加）。

本项目已于纯前端化改造：**没有服务端、没有 API 路由**，数据存浏览器 localStorage，AI 由浏览器直接请求 DeepSeek。因此可以完整静态导出，部署后手机上独立使用。

- 构建静态站点：`npm run build` → 产物在 `out/`（约 1.3MB）
- 把 `out/` 丢到任意静态托管（GitHub Pages / Cloudflare Pages / Netlify 等）即可
- 部署到子路径时：`BASE_PATH=/仓库名 npm run build`（Windows Git Bash 需加 `MSYS_NO_PATHCONV=1`）
- **iOS 细节已打磨**：安全区适配（避开通灵岛与底部 Home 条）、4 种机型启动图（消除启动白屏）、`storage.persist()` 申请持久存储
- **首页「今日进度」卡片**：一眼看到 `💧 1200/2100ml（还差 3 杯）· 🚶 6500/8000 步`
- **数据备份导出/导入**：换机、防数据丢失、一键给家人配置
- 首次使用：⚙️ 填 DeepSeek Key → 健康小屋填档案 → 菜单库截图导入

> 完整的手机使用说明（含 **iPhone 快捷指令定时提醒教程**、装到主屏步骤、备份换机）见 **[DEPLOY.md](./DEPLOY.md)**。
> 重新部署：双击 ****，或按 DEPLOY.md 第五节手动执行。
> 桌面端仍然可以 `npm run dev` 或双击 `启动.bat` 本地使用，效果一致。

---

### 🎉 连续打卡奖励（衍生版新增）
- 完成 = 喝水、步数都达标；达标瞬间弹窗庆祝（spring 入场 + 数字滚动 + 彩带）
- 连续天数 / 历史最长 / 六枚里程碑徽章（🌱3 → 👑100 天），断签不收回已获徽章
- 今天未达标时连续天数从昨天起算，白天打开不会看到 0 天
- 动画用 motion + canvas-confetti，弹窗懒加载不拖慢首屏；尊重 prefers-reduced-motion
- 奖励数据存本地（自动纳入备份），给家人的备份会连奖励记录一起迁移

---

### 💾 数据备份（衍生版新增）
- 设置弹窗新增「数据备份」页签：导出为文件 / 复制内容 / 合并导入 / 覆盖导入 / 清空本机数据
- 数据只存本机，可据此**换机迁移**，或**给家人一键配置**（备份可含 API Key，导入即完成设置）

---

### 🍱 我的食堂/外卖菜单库（衍生版新增）
- **截图导入**：在外卖 App/食堂小程序里把菜单页截图，粘贴或选图，AI 视觉模型（DeepSeek V4.1 Flash，同 Key）认出菜名+价格，再自动补全分类/口味/忌口标签入库
- **文字导入**：流水账式描述学校食堂，AI 拆成结构化菜品
- 手动添加、按商家分组浏览、单个删除、恢复示例库；同商家同名自动去重
- 外卖推荐从此只从你自己的菜单库里选（防编造），并结合健康档案与忌口过滤

---

### 💪 健康小屋（衍生版新增 · 健康档案驱动的个性化）
- **健康档案**：性别、年龄、身高体重、日常活动量、健康目标（减脂/增肌/维持）、忌口过敏、身体状况
- **自动计算每日目标**：BMR / TDEE（Mifflin-St Jeor 公式）、目标热量、喝水目标（约 35ml/kg）、步数目标（按活动量）、BMI
- **每日打卡**：喝水（按「杯」录入，250ml/杯）、步数（档位快选 / 滑块 / 直接输入）、睡眠、今日状态；进度条带「还差 X 杯 / 还差 X 步（约 X km）」文案
- **健康数据全链路注入 AI**：自己做推荐、外卖推荐、本周分析都会带上健康档案与今日打卡，推荐严格避开忌口/过敏，并贴合热量参考与健康目标

> **步数为什么是手动录入？** 微信运动只能在微信小程序内读取（网页调不到，且数据需后端解密）；
> 华为 Health Kit 只有 REST API（需开发者账号审批 + 后端保存密钥）；小米手环无面向第三方的开放 API；
> 且 iOS 上主屏 App 与 Safari 存储互相隔离，无法用快捷指令绕写。
> 相关代码已抽到 `app/lib/steps.ts`，将来若做原生 App 只需改这一处。

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 语言 | TypeScript 5 |
| 样式 | Tailwind CSS 4 + CSS 变量治愈主题 |
| AI | DeepSeek API（浏览器直连，`deepseek-chat` 文本 + `deepseek-flash` 视觉） |
| 数据 | localStorage（无后端、无数据库） |
| PWA | 自研轻量 Service Worker + manifest（离线可开，支持加到主屏） |
| 部署 | 静态导出（`output: export`），产物 `out/` 可直接托管 |

---

## 🚀 快速开始

### 1. 获取代码

> 建议优先克隆**原项目**（授权清晰）：

```bash
git clone https://github.com/FishBone0v0/AI-recipe-recommendation-system.git
cd AI-recipe-recommendation-system
```

若确实需要本衍生版本的功能（健康小屋 / 菜单库 / 手机纯前端运行），请先取得原作者许可后再使用。

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 API Key

本版本**不需要环境变量**。启动后点页面右上角 ⚙️ 填入 DeepSeek API Key 即可（存在浏览器 localStorage，由浏览器直接请求 DeepSeek）。

若需部署到子路径或更换模型名，参考 `.env.example` 里的 `BASE_PATH` 等说明。

### 4. 启动

```bash
npm run dev        # 开发模式，打开 http://localhost:3000
npm run build      # 构建静态站点，产物在 out/
```

Windows 上也可以直接双击 `启动.bat`（自动起服务并打开浏览器）。

---

## 🔑 获取 DeepSeek API Key

1. 前往 [platform.deepseek.com](https://platform.deepseek.com)
2. 注册并创建 API Key
3. 在页面右上角 ⚙️ 设置中填入

> 推荐与截图识别用的是同一个 Key（`deepseek-chat` / `deepseek-flash`），无需申请第二个。

---

## 📁 项目结构

```
app/
├── page.tsx               # 首页（推荐入口）
├── health/page.tsx        # 健康小屋（档案 + 每日打卡）
├── takeout/page.tsx       # 我的食堂/外卖菜单库
├── weekly/page.tsx        # 本周饮食回顾
├── components/            # UI 组件
└── lib/
    ├── deepseek.ts        # 浏览器直连 DeepSeek（文本/视觉统一入口）
    ├── ai.ts              # 各业务 AI 封装（推荐/外卖/周报/菜单导入）
    ├── health.ts          # 健康计算（BMR/TDEE/喝水/步数/BMI）
    ├── tags.ts            # 标签单一事实来源 + isSeasoning()
    ├── storage.ts         # localStorage CRUD + 数据迁移
    ├── prompts.ts         # 所有 AI Prompt 构建函数
    ├── steps.ts           # 步数来源抽象 + 喝水/步数进度文案（接原生健康数据只改这里）
    ├── backup.ts          # 本地数据导出/导入/清空
    ├── types.ts           # 核心类型定义
    └── date.ts            # 日期工具（周视图 / 时间段推导）
public/
├── .nojekyll              # GitHub Pages 必需（否则 _next/ 被 Jekyll 忽略导致白屏）
├── sw.js                  # Service Worker（离线缓存）
├── manifest.json          # PWA 清单
├── icons/                 # PWA 图标（192 / 512）
└── splash/                # iOS 启动图（4 种机型）
data/
└── takeoutMock.json       # 示例菜单库种子
```

---

## 🎨 设计系统

采用**治愈暖橙 × 浅蓝**双色调，全局 CSS 变量：

```css
--heal-bg: #FFF8E7           /* 米白背景 */
--heal-amber-accent: #FAC775  /* 橙黄强调 */
--heal-blue-50: #DCEFFC      /* 浅蓝次强调 */
--heal-blue-text: #0C447C    /* 深蓝文字 */
```

按钮统一使用 `.heal-btn` 系列工具类（`ghost` / `primary` / `feature`）。

---

## 📝 数据说明

- **所有数据存储在浏览器 localStorage**，不上传任何服务器，完全本地化
- API Key 同样仅存本地，由浏览器直接请求 DeepSeek，不经过任何中间层（纯前端版本连自己的后端都没有）
- **数据不跨设备同步**：手机和电脑浏览器各自独立，换设备需重新导入
- 示例菜单库位于 `data/takeoutMock.json`（仅作为初始种子，导入后以本地库为准）

---

## 🔢 版本管理

版本号的**单一事实来源是 `package.json` 的 `version`**，其他任何地方都不再自己生成版本号。

| 位置 | 作用 |
|---|---|
| `package.json` → `version` | 唯一权威来源，如 `1.0.0` |
| `CHANGELOG.md` | 正式的发布记录（Keep a Changelog 格式） |
| `app/lib/changelog.ts` | App 设置页展示用的精简要点（离线可读） |
| `next.config.ts` | 构建时把版本注入为 `NEXT_PUBLIC_APP_VERSION`，并注入构建时间 `NEXT_PUBLIC_BUILD_TIME` |
| `public/sw.js` | 缓存名含版本+构建号，由 `部署.bat` 注入 |
| 设置页 →「版本」 | 展示版本、构建时间，并可展开看本次更新内容 |

### 递增规则（语义化版本，**偏向克制：能用 patch 就别用 minor**）

| 变更类型 | 命令 | 例子 |
|---|---|---|
| 不兼容改动（数据格式、交互大改） | `npm version major` | 1.0.0 → 2.0.0 |
| **成块的新功能**（新增一个完整模块/页面/能力） | `npm version minor` | 1.0.0 → 1.1.0 |
| **其余一切**：修 bug、样式/文案调整、加一个按钮或交互优化 | `npm version patch` | 1.0.0 → 1.0.1 |
| 只改文档 / 注释 / 构建脚本 | 不升版本 | — |

> 判断依据是"用户能感知到的变化有多成块"，不是"改了多少行代码"。拿不准时选 patch。
> 用 `npm version <level> --no-git-tag-version` 可只改 `package.json` 不自动提交；
> 发布时 `部署.bat` 会负责打 `vX.Y.Z` 的 git tag。

### 发一版的完整流程

1. 改代码
2. `npm version patch --no-git-tag-version`（小改动就用 patch；成块新功能才用 minor）
3. **在 `CHANGELOG.md` 顶部加一条新版本**（`部署.bat` 会校验，漏了会警告）
4. 同步更新 `app/lib/changelog.ts` 的要点（设置页展示用）
5. 跑 `部署.bat` —— 它会：读版本 → 校验日志 → 构建 → 注入 SW 版本号 →
   推 `gh-pages` → 给 `main` 打 `vX.Y.Z` tag 并推送

> 说明：Web App Manifest 规范里**没有 `version` 字段**，所以 `public/manifest.json`
> 不写版本号——这不是遗漏，写了反而不符合规范。

---

## 📄 License

MIT
