# 🍱 今天吃什么呀 — AI 智能食谱推荐系统

**PRD文档和技术文档详见/docs/PRD.md与TECH_SPEC.md**

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

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 语言 | TypeScript 5 |
| 样式 | Tailwind CSS 4 + CSS 变量治愈主题 |
| AI | DeepSeek API（OpenAI SDK 兼容） |
| 数据 | localStorage（无后端数据库） |
| PWA | next-pwa |

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

### 3. 配置环境变量（可选）

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# 服务器端默认 Key，也可在页面右上角 ⚙️ 设置里填写（优先级更高）
DEEPSEEK_API_KEY=sk-your-key-here
```

> 也可以不配置环境变量，直接在页面 ⚙️ 设置里填写 DeepSeek API Key，Key 只存在你本地浏览器的 localStorage 中。

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## 🔑 获取 DeepSeek API Key

1. 前往 [platform.deepseek.com](https://platform.deepseek.com)
2. 注册并创建 API Key
3. 在页面右上角 ⚙️ 设置中填入，或写入 `.env.local`

---

## 📁 项目结构

```
app/
├── page.tsx               # 首页（推荐入口）
├── weekly/page.tsx        # 本周饮食回顾
├── api/
│   ├── recommend/         # 自己做菜品推荐
│   ├── takeout-recommend/ # 外卖推荐
│   ├── weekly-insight/    # 本周饮食 AI 点评
│   ├── update-profile/    # 用户饮食档案更新
│   └── parse-goal/        # 饮食目标语义解析
├── components/            # UI 组件
└── lib/
    ├── tags.ts            # 标签单一事实来源 + isSeasoning()
    ├── storage.ts         # localStorage CRUD + 数据迁移
    ├── prompts.ts         # 所有 AI Prompt 构建函数
    ├── types.ts           # 核心类型定义
    └── date.ts            # 日期工具（周视图 / 时间段推导）
data/
└── takeoutMock.json       # 外卖数据库（可手动编辑扩充）
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
- API Key 同样仅存本地，不经过任何中间层
- 外卖数据库位于 `data/takeoutMock.json`，可自由编辑扩充

---

## 📄 License

MIT
