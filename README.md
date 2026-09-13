# 🍱 今天吃什么呀 — AI 智能食谱推荐系统

**PRD文档和技术文档详见`/docs/PRD.md`与`/doc/TECH_SPEC.md`**

一款以**治愈风格**为核心设计语言的中文 AI 饮食助手，帮你用现有食材决定今天吃什么，记录每周饮食，并由 AI 营养分析师给出个性化建议。

![Tech Stack](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![DeepSeek](https://img.shields.io/badge/DeepSeek-API-6366f1)
![PWA](https://img.shields.io/badge/PWA-支持-green)

---

## ✨ 功能特性

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

### 📱 手机独立运行（纯前端版）

**已部署上线：<https://orang1ver.github.io/eat-healthy/>** —— 手机浏览器打开后「添加到主屏幕」即为全屏 App，不依赖电脑。

本项目已于纯前端化改造：**没有服务端、没有 API 路由**，数据存浏览器 localStorage，AI 由浏览器直接请求 DeepSeek。因此可以完整静态导出，部署后手机上独立使用。

- 构建静态站点：`npm run build` → 产物在 `out/`（约 1MB）
- 把 `out/` 丢到任意静态托管（GitHub Pages / Cloudflare Pages / Netlify 等）即可
- 部署到子路径时：`BASE_PATH=/仓库名 npm run build`（Windows Git Bash 需加 `MSYS_NO_PATHCONV=1`）
- 手机上用浏览器打开后「添加到主屏幕」，即为全屏 App，支持离线打开界面（内置 Service Worker）
- 首次使用：⚙️ 填 DeepSeek Key → 健康小屋填档案 → 菜单库截图导入

> 重新部署步骤、踩坑记录（`.nojekyll`、`sw.js`）与常见问题见 **[DEPLOY.md](./DEPLOY.md)**。
> 桌面端仍然可以 `npm run dev` 或双击 `启动.bat` 本地使用，效果一致。

---

### 🍱 我的食堂/外卖菜单库
- **截图导入**：在外卖 App/食堂小程序里把菜单页截图，粘贴或选图，AI 视觉模型（DeepSeek V4.1 Flash，同 Key）认出菜名+价格，再自动补全分类/口味/忌口标签入库
- **文字导入**：流水账式描述学校食堂，AI 拆成结构化菜品
- 手动添加、按商家分组浏览、单个删除、恢复示例库；同商家同名自动去重
- 外卖推荐从此只从你自己的菜单库里选（防编造），并结合健康档案与忌口过滤

---

### 💪 健康小屋（v1 结合版新增，健康档案驱动的个性化）
- **健康档案**：性别、年龄、身高体重、日常活动量、健康目标（减脂/增肌/维持）、忌口过敏、身体状况
- **自动计算每日目标**：BMR / TDEE（Mifflin-St Jeor 公式）、目标热量、喝水目标（约 35ml/kg）、步数目标（按活动量）、BMI
- **每日打卡**：喝水（+250/+500ml 进度条）、步数、睡眠时长、今日状态，本周打卡一览（达标点亮）
- **健康数据全链路注入 AI**：自己做推荐、外卖推荐、本周分析都会带上健康档案与今日打卡，推荐严格避开忌口/过敏，并贴合热量参考与健康目标

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

### 1. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/ai-recipe-finder.git
cd ai-recipe-finder
```

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
    ├── types.ts           # 核心类型定义
    └── date.ts            # 日期工具（周视图 / 时间段推导）
public/
├── sw.js                  # Service Worker（离线缓存）
└── icons/                 # PWA 图标
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

## 📄 License

MIT
