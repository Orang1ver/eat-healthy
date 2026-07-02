# AI 智能食谱推荐系统 — 技术开发文档

基于 [PRD.md](./PRD.md) 落地的实现方案。本文档面向开发实现，PRD 里已经定稿的产品逻辑这里不重复展开，只讲"怎么搭"。

## 1. 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | Next.js 16（App Router）+ TypeScript | 沿用旧项目的技术选型，重写内容 |
| 样式 | Tailwind CSS 4 | 自定义治愈系配色 token，见 §7 |
| AI Provider | **DeepSeek API**（`deepseek-chat`） | OpenAI 协议兼容，继续用 `openai` npm SDK，仅切换 `baseURL` 为 `https://api.deepseek.com` 和默认模型名 |
| 数据存储 | 浏览器 `localStorage`（无后端数据库） | 见 §3 |
| PWA | `next-pwa` | manifest + service worker，支持"添加到主屏幕" |
| 图表（如需要） | 不需要 `recharts`（已放弃数字化营养记录），可移除依赖 |

不再需要的依赖（对照旧项目 `package.json` 清理）：`recharts`（量化图表已下线）。保留 `uuid`（生成 id）。

## 2. 目录结构

```
AI_recipe/
├── docs/
│   ├── PRD.md
│   └── TECH_SPEC.md
├── app/
│   ├── layout.tsx
│   ├── globals.css                 # Tailwind + 治愈系 CSS 变量
│   ├── page.tsx                    # 首页「今天吃什么呀」
│   ├── weekly/
│   │   └── page.tsx                # 本周饮食回顾页（替代原 dashboard）
│   ├── components/
│   │   ├── EntryToggle.tsx         # 自己做/点外卖 入口分支
│   │   ├── IngredientPicker.tsx    # 常用食材标签 + 仅用已有食材开关
│   │   ├── FlavorAvoidPicker.tsx   # 口味/忌口标签（含互斥逻辑）+ 备注
│   │   ├── MethodPicker.tsx        # 做法标签（多选）
│   │   ├── PortionPicker.tsx       # 份量/场景预设 + 自定义道数 + 加甜品
│   │   ├── GoalInput.tsx           # 自然语言目标输入框
│   │   ├── RecommendCard.tsx       # 推荐结果卡片（自己做，多道菜+购物清单+治愈文案）
│   │   ├── TakeoutCard.tsx         # 外卖推荐卡片
│   │   ├── SaveMealDialog.tsx      # "记到哪一餐"弹窗
│   │   ├── WeekTimetable.tsx       # 7天×4时段表格
│   │   ├── MealDetailDialog.tsx    # timetable 格子详情（查看+编辑态）
│   │   ├── WeeklyInsightPanel.tsx  # AI 营养分析师反馈区
│   │   ├── SettingsDialog.tsx      # API key 设置 + 我的饮食笔记入口
│   │   └── ProfileNoteDialog.tsx   # 用户饮食习惯文档 查看/编辑
│   ├── lib/
│   │   ├── apiKeys.ts              # 沿用旧项目模式：localStorage 读写 + header 注入
│   │   ├── serverKeys.ts           # 服务端：header 优先于 env 解析 key
│   │   ├── storage.ts              # MealRecord / CommonIngredient / UserProfile / WeeklyInsight 的 CRUD 封装
│   │   ├── tags.ts                 # 标签语义表常量（口味/忌口/做法/份量预设），供前端展示和 API prompt 复用
│   │   ├── mutualExclusion.ts      # 辣味口味 ↔ 不吃辣 互斥逻辑
│   │   ├── date.ts                 # 周范围计算、mealSlot 归类等日期工具
│   │   └── prompts.ts              # 各 AI 调用的 system prompt 拼装函数
│   └── api/
│       ├── parse-goal/route.ts
│       ├── recommend/route.ts
│       ├── takeout-recommend/route.ts
│       ├── weekly-insight/route.ts
│       └── update-profile/route.ts
├── data/
│   └── takeoutMock.json            # 外卖 mock 种子数据（10~20条），首次启动写入 localStorage
├── public/
│   ├── manifest.json               # PWA
│   └── icons/
├── next.config.ts                  # 接入 next-pwa
├── package.json
└── .env.local                      # DEEPSEEK_API_KEY 等
```

## 3. 数据层（localStorage）

封装在 `app/lib/storage.ts`，对外只暴露函数，不直接操作 `localStorage`（方便以后换存储介质）。

```ts
// app/lib/storage.ts 接口设计（类型定义沿用 PRD §5，原样照搬不再重复列出）

// 常用食材
export function loadCommonIngredients(): CommonIngredient[];
export function addCommonIngredient(label: string): CommonIngredient;
export function removeCommonIngredient(id: string): void;
export function seedDefaultIngredientsIfEmpty(): void; // 首次启动预置 6~8 个默认标签

// 饮食记录
export function loadMealRecords(): MealRecord[];
export function addMealRecord(m: Omit<MealRecord, "id" | "createdAt">): MealRecord;
export function updateMealRecord(id: string, patch: Partial<MealRecord>): void; // 用于编辑菜品，patch.source 强制置为 "ai-edited"（除非整条是 manual 新增）
export function deleteMealRecord(id: string): void;
export function getMealsInWeek(weekStartISO: string): MealRecord[]; // timetable 数据源

// 本周分析缓存
export function loadWeeklyInsight(weekStart: string): WeeklyInsight | null;
export function saveWeeklyInsight(w: WeeklyInsight): void;

// 用户饮食习惯文档
export function loadUserProfile(): UserProfile | null;
export function saveUserProfile(content: string): void;

// 外卖 mock 库（首次启动从 data/takeoutMock.json 写入 localStorage，之后用户可在文件里直接改种子数据重新播种）
export function loadTakeoutDishes(): TakeoutDish[];
export function seedTakeoutMockIfEmpty(): void;
```

localStorage key 与 PRD §5 一致：`recipe.commonIngredients.v1`、`recipe.mealRecords.v1`、`recipe.weeklyInsight.v1`、`recipe.apikeys.v1`、`recipe.userProfile.v1`、`recipe.takeoutMock.v1`。

**初始化时机**：在根 `app/layout.tsx` 的客户端 effect 里统一调用 `seedDefaultIngredientsIfEmpty()` 和 `seedTakeoutMockIfEmpty()`，保证空状态不是真的空白。

## 4. 标签语义表与互斥逻辑

`app/lib/tags.ts` 是唯一数据源，前端展示和后端 prompt 拼装都从这里读，避免两边文案不同步：

```ts
export type TagDef = { label: string; description: string; promptHint: string };

export const FLAVOR_TAGS: TagDef[] = [
  { label: "清淡", description: "少调味，突出食材本味", promptHint: "优先白灼/清蒸/少油少盐做法，避免重油重辣" },
  { label: "麻辣", description: "川渝风味，花椒+辣椒并重", promptHint: "可用豆瓣酱、花椒、辣椒，突出麻和辣两种感觉" },
  // ... 微辣/酸辣/甜口/咸鲜/少油/少盐，文案照搬 PRD §3.2
];

export const AVOID_TAGS: TagDef[] = [ /* 不吃香菜/不吃葱姜蒜/不吃辣/无乳制品/无麸质/素食，照搬 PRD §3.2 */ ];

export const METHOD_TAGS: TagDef[] = [ /* 火锅/香煎/清蒸/凉拌/炖煮/烧烤/快炒/烘焙/不限，照搬用户在 §3.3 补充后的版本 */ ];

export const PORTION_PRESETS = [
  { key: "1人食-盖饭", label: "1人食·盖饭", description: "一道主菜+米饭打底做成盖饭形式，1人份，操作简单" },
  { key: "1人食-小火锅", label: "1人食·小火锅", description: "单人迷你火锅，少量食材+锅底，强调便捷和暖意" },
  { key: "1人食-1菜1汤", label: "1人食·1菜1汤", description: "一道主菜+一道汤，简单不将就" },
  { key: "家常-2菜1汤", label: "家常·2菜1汤", description: "经典家庭餐桌组合，2道炒菜+1道汤" },
  { key: "丰盛", label: "丰盛", description: "3~4道菜（至少含1荤1素1汤），适合聚餐/犒劳自己" },
  { key: "自定义", label: "自定义", description: "用户手动指定道数" },
] as const;

// 互斥组：选中组内任一项时，组内其余项在 UI 上禁用（置灰不可点）
export const MUTUAL_EXCLUSION_GROUPS: string[][] = [
  ["不吃辣", "麻辣", "微辣", "酸辣"],
];
```

`app/lib/mutualExclusion.ts` 提供一个纯函数给标签选择组件用：

```ts
export function getDisabledTags(selected: string[]): Set<string> {
  const disabled = new Set<string>();
  for (const group of MUTUAL_EXCLUSION_GROUPS) {
    const hit = group.find((t) => selected.includes(t));
    if (hit) for (const t of group) if (t !== hit) disabled.add(t);
  }
  return disabled;
}
```

`FlavorAvoidPicker.tsx` 渲染时对 `getDisabledTags(selected)` 里的标签加 `disabled` 态（降低透明度、`pointer-events-none`），不需要等 AI 处理矛盾输入。

## 5. AI Provider 配置（DeepSeek）

延续旧项目"页面内可配置 key"的模式（`app/lib/apiKeys.ts` + `app/lib/serverKeys.ts`），但 provider 换成 DeepSeek：

```ts
// app/lib/serverKeys.ts
export function getDeepSeekKey(req: Request): string | undefined {
  return req.headers.get("x-deepseek-key") || process.env.DEEPSEEK_API_KEY || undefined;
}
```

```ts
// 各 API 路由内统一这样初始化
import OpenAI from "openai";
const apiKey = getDeepSeekKey(req);
if (!apiKey) return NextResponse.json({ error: "请先在设置里配置 DeepSeek API Key" }, { status: 401 });
const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
const MODEL = "deepseek-chat";
```

`SettingsDialog.tsx` 里的输入框文案改为"DeepSeek API Key"，`apiKeyHeaders()` 注入 `x-deepseek-key` 请求头。`.env.local` 模板：

```
DEEPSEEK_API_KEY=sk-xxx
```

## 6. API 路由详细设计

所有路由统一约定：请求体用 JSON，响应失败时返回 `{ error: string }` + 4xx/5xx；AI 输出统一要求 `response_format: { type: "json_object" }`，避免手写括号匹配解析。

### 6.1 `POST /api/parse-goal`
沿用旧逻辑，输入 `{ goal: string }`，输出结构化目标片段（kcal 倾向、营养重点、关键词），中文 prompt。内部使用，不强制展示给用户，作为 `recommend` 的输入补充。

### 6.2 `POST /api/recommend`（自己做，含首次生成和反馈重生成）

请求体：
```ts
type RecommendRequest = {
  ingredients: string[];          // 已选常用食材 + 临时输入
  onlyPantry: boolean;            // 仅使用已有食材开关
  flavorTags: string[];
  avoidTags: string[];
  note: string;                   // 自由备注
  methodTags: string[];
  portionPreset: string;          // PORTION_PRESETS 的 key
  dishCount?: number;             // 自定义时必填
  wantDessert: boolean;
  goal: string;                   // 自然语言目标原文
  userProfile?: string;           // 用户饮食习惯文档全文（若存在）
  feedback?: string;              // "换一桌"携带的反馈，首次生成不传
  lastResult?: RecommendResponse; // 反馈重生成时携带上一次结果，便于 AI 参考增量调整
};

type RecommendResponse = {
  title: string;
  dishes: Dish[];        // 含 DishIngredient[]，每个标 fromPantry
  shoppingList: string[];
  aiMessage: string;
};
```

内部逻辑：
1. 用 `app/lib/prompts.ts` 的 `buildRecommendPrompt()` 拼装 system prompt：注入 §4 标签语义表中**用户实际选中的标签**对应的 `promptHint`（不是整张表都塞进去，减少 token），以及份量预设的语义说明、`onlyPantry` 的强约束规则、用户饮食习惯文档摘要。
2. 调用 DeepSeek，`response_format: json_object`。
3. 服务端二次校验：若 `onlyPantry === true`，强制把任何不在 `ingredients` 里的食材从结果中剔除或标记异常（防止模型没遵守约束）；否则按模型返回的 `fromPantry` 原样信任，仅做去重生成 `shoppingList`。
4. 返回 `RecommendResponse`。

### 6.3 `POST /api/takeout-recommend`

请求体：`{ flavorTags, avoidTags, note, goal, userProfile?, takeoutDb: TakeoutDish[] }`（`takeoutDb` 由前端从 localStorage 读出传入，服务端无状态，不用再读文件）。

内部逻辑：把 `takeoutDb` 整个（或按 `avoidConflicts` 预过滤后的子集）放进 prompt，要求 AI **只能从列表中选**，输出 1~3 个 `{ takeoutDishId, reason, pairTip }`，服务端再用 `takeoutDishId` 去 `takeoutDb` 里查出完整信息拼装响应，避免 AI 编造不存在的商家/菜名。

### 6.4 `POST /api/weekly-insight`

请求体：`{ meals: MealRecord[], weekRange: string, userProfile?: string }`。输出 `{ reply: string }`，prompt 要求"基于具体食材/口味/来源做定性点评，不出现编造的数字"。

### 6.5 `POST /api/update-profile`

请求体：`{ recentMeals: MealRecord[], existingProfile?: string }`（`recentMeals` 建议传最近 2~4 周，由前端筛选好再传）。输出 `{ content: string }`，prompt 要求"基于已有文档 + 新的饮食记录，输出更新后的完整 markdown，保留仍然成立的旧观察，更新或删除过时的内容，不要无限累加"。仅在用户点击"生成本周分析"时，由前端在拿到 `weekly-insight` 结果后**顺带**再发一次这个请求（两次独立调用，避免一个 prompt 既要点评又要写文档导致输出质量下降）。

## 7. 视觉风格落地

`app/globals.css` 在 Tailwind 基础上追加 CSS 变量（对应 PRD §7.3）：

```css
:root {
  --heal-bg: #FFF8E7;
  --heal-amber-50: #FCE8C8;   /* 选中态背景 */
  --heal-amber-text: #6B4308;
  --heal-amber-accent: #FAC775; /* 装饰/强调 */
  --heal-blue-50: #DCEFFC;    /* 积极操作/AI气泡背景 */
  --heal-blue-text: #0C447C;
  --heal-card-border: #F3DFAE;
}
@media (prefers-color-scheme: dark) {
  :root {
    --heal-bg: #2A2210;
    --heal-amber-50: #4A3A14;
    --heal-amber-text: #FBE9C8;
    --heal-blue-50: #163A52;
    --heal-blue-text: #BFE0FA;
    --heal-card-border: #5C4A12;
  }
}
```

圆角统一用 `rounded-[18px]`（卡片）/ `rounded-full`（按钮、标签）。组件直接引用这些变量，不在 Tailwind config 里重新定义色板，保持和原型一致。

桌面优先布局：参考旧项目 `max-w-6xl mx-auto` 的居中定宽容器，断点上用 `sm:`/`md:` 做窄屏适配（标签换行、表单单列），不做"以移动端为基准再放大"的反向适配。

## 8. PWA

- `next.config.ts` 接入 `next-pwa`，`disable: process.env.NODE_ENV === "development"`
- `public/manifest.json`：`name: "今天吃什么呀"`，主题色用 `--heal-amber-accent`，背景色用 `--heal-bg`，`display: "standalone"`
- 图标：先放占位图（后续可换治愈风格 icon）

## 9. 外卖 mock 数据

`data/takeoutMock.json`：10~20 条，覆盖品类——快餐简餐、麻辣烫、沙拉轻食、汤粉面、家常炒菜外卖、甜品饮品。字段对应 `TakeoutDish`。首次启动时 `seedTakeoutMockIfEmpty()` 读这个文件写入 localStorage；用户后续可以直接改这个 JSON 文件（清一下 localStorage 或加个"重新载入示例数据"按钮）来替换成真实商家数据。

## 10. 实现顺序建议（里程碑）

1. 项目骨架：Next.js + Tailwind + 目录结构 + `globals.css` 配色变量 + PWA 配置
2. 数据层：`storage.ts`、`tags.ts`、`mutualExclusion.ts`、mock 种子数据
3. API Key 体系：`apiKeys.ts`/`serverKeys.ts`（DeepSeek 版）+ `SettingsDialog`
4. 首页"自己做"全流程：标签选择组件 → `/api/recommend` → `RecommendCard` → 保存弹窗 → 写入 `MealRecord`
5. 首页"点外卖"流程：`/api/takeout-recommend` → `TakeoutCard`
6. 本周回顾页：`WeekTimetable` + 详情弹窗（查看） → 编辑态（手动改菜品）
7. AI 营养分析师 + 用户饮食习惯文档：`/api/weekly-insight` + `/api/update-profile` + `ProfileNoteDialog`
8. 打磨：互斥校验联调、空状态、深色模式、PWA 安装验证

每完成一个里程碑建议跑一次 `next build` 做类型检查（旧项目就是因为一直只跑 `next dev` 才积累了一堆 build 期才暴露的类型错误，这次从一开始就避免）。
