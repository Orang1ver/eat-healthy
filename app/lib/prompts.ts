import { AVOID_TAGS, FLAVOR_TAGS, METHOD_TAGS, PORTION_PRESETS, type PortionPresetKey } from "./tags";

function hintsFor(defs: { label: string; promptHint: string }[], selected: string[]): string {
  return defs
    .filter((d) => selected.includes(d.label))
    .map((d) => `「${d.label}」：${d.promptHint}`)
    .join("\n");
}

export function buildRecommendPrompt(input: {
  ingredients: string[];
  onlyPantry: boolean;
  flavorTags: string[];
  avoidTags: string[];
  note: string;
  methodTags: string[];
  portionPreset: PortionPresetKey;
  dishCount?: number;
  wantDessert: boolean;
  goal: string;
  userProfile?: string;
  healthContext?: string;
  feedback?: string;
  recentMeals?: { date: string; time: string; channel: string; dishes: { name: string; ingredients: string[] }[] }[];
  weeklyInsight?: string;
}) {
  const portion = PORTION_PRESETS.find((p) => p.key === input.portionPreset);
  const dishCountLine =
    input.portionPreset === "自定义" && input.dishCount
      ? `用户手动指定了 ${input.dishCount} 道菜。`
      : portion
        ? `份量场景「${portion.label}」：${portion.description}`
        : "";

  const pantryRule = input.onlyPantry
    ? "用户勾选了「仅使用已有食材」：你只能使用下面列出的已有食材 + 厨房常备调料，绝对不能引入任何新的主料食材（蔬菜/肉蛋豆制品/米面等）。每个食材的 fromPantry 都必须是 true。"
    : "用户没有限制食材来源：你可以在已有食材基础上合理补充新的主料食材（蔬菜/肉蛋豆制品/米面等）让菜品更完整，但不要补充太多太贵重的。";

  const seasoningRule =
    "重要：默认假设用户家里已经有所有常见调料（盐、油、糖、醋、酱油、生抽、老抽、料酒、葱、姜、蒜、各种香料粉、淀粉、芝麻油等），这些调料的 fromPantry 永远写 true，不算需要新购买的食材。fromPantry 是否为 false（需要购买）只针对蔬菜/肉蛋豆制品/米面等主料食材来判断，不要把任何调料标记为 false。";

  const recentMealsText = input.recentMeals?.length
    ? input.recentMeals.map((m) => `${m.date} ${m.time}（${m.channel}）：${m.dishes.map((d) => `${d.name}(${d.ingredients.join("、")})`).join("、")}`).join("\n")
    : null;

  return `你是一个温暖治愈系的中文家庭厨房助手，根据用户的食材、口味、忌口、做法偏好和饮食目标，设计一顿饭（可能包含多道菜）。
${input.healthContext ? `\n【用户健康档案与今日状态】\n${input.healthContext}\n设计时请结合健康档案：份量和食材搭配尽量贴合每日热量参考与健康目标，严格避开忌口/过敏项。` : ""}

【已有食材】${input.ingredients.join("、") || "（无）"}
【食材使用规则】${pantryRule}
【调料规则】${seasoningRule}
【口味偏好语义】
${hintsFor(FLAVOR_TAGS, input.flavorTags) || "（无特别偏好）"}
【忌口/过敏语义】
${hintsFor(AVOID_TAGS, input.avoidTags) || "（无）"}
【自由备注】${input.note || "（无）"}
【做法偏好语义】
${hintsFor(METHOD_TAGS, input.methodTags) || "（不限）"}
【份量与场景】${dishCountLine}${input.wantDessert ? "\n用户希望额外加一道甜品/餐后小食。" : ""}
【饮食目标】${input.goal || "（无特别目标）"}
${input.userProfile ? `【用户长期饮食习惯参考】\n${input.userProfile}` : ""}
${recentMealsText ? `【最近饮食记录（最新在前）】\n${recentMealsText}` : ""}
${input.weeklyInsight ? `【本周AI饮食分析】\n${input.weeklyInsight}` : ""}
${input.feedback ? `【用户反馈，请据此调整上一版搭配】${input.feedback}` : ""}

请返回严格 JSON，不要任何多余文字：
{
  "title": "这顿饭的搭配小标题",
  "dishes": [
    { "name": "菜名", "role": "主菜|主食|汤|甜品|小菜", "flavorTags": ["口味标签"], "ingredients": [{"label":"食材名","fromPantry":true} ] }
  ],
  "aiMessage": "一段治愈系评语（不超过120字）：①先点出这顿饭与用户最近饮食的关联（如最近吃了较多某类食物、上周分析提到某个建议），②说明这道菜如何在口味爱好和健康平衡之间取得平衡，③结尾一句温暖鼓励。若无历史数据则直接解释搭配逻辑与目标的关系。"
}`;
}

export function buildTakeoutPrompt(input: {
  flavorTags: string[];
  avoidTags: string[];
  note: string;
  goal: string;
  userProfile?: string;
  healthContext?: string;
  takeoutDb: { id: string; restaurant: string; name: string; category: string; flavorTags: string[] }[];
  recentMeals?: { date: string; time: string; channel: string; dishes: { name: string; ingredients: string[] }[] }[];
  weeklyInsight?: string;
}) {
  const dbText = input.takeoutDb
    .map((d) => `${d.id}: ${d.restaurant}·${d.name}（${d.category}，口味标签：${d.flavorTags.join("/")}）`)
    .join("\n");

  const recentMealsText = input.recentMeals?.length
    ? input.recentMeals.map((m) => `${m.date} ${m.time}（${m.channel}）：${m.dishes.map((d) => d.name).join("、")}`).join("\n")
    : null;

  return `你是一个温暖治愈系的中文外卖推荐助手。下面是可选外卖库，你只能从中挑选，不能编造不存在的商家或菜品：
${dbText}
${input.healthContext ? `\n【用户健康档案与今日状态】\n${input.healthContext}\n选择时请结合健康档案：严格避开忌口/过敏项，兼顾热量参考与健康目标（如正在减脂可优先清淡、有蔬菜、粥粉面类而非重油炸物）。` : ""}

【口味偏好语义】
${hintsFor(FLAVOR_TAGS, input.flavorTags) || "（无特别偏好）"}
【忌口/过敏语义】
${hintsFor(AVOID_TAGS, input.avoidTags) || "（无）"}
【自由备注】${input.note || "（无）"}
【饮食目标】${input.goal || "（无特别目标）"}
${input.userProfile ? `【用户长期饮食习惯参考】\n${input.userProfile}` : ""}
${recentMealsText ? `【最近饮食记录（最新在前）】\n${recentMealsText}` : ""}
${input.weeklyInsight ? `【本周AI饮食分析】\n${input.weeklyInsight}` : ""}

请从外卖库中挑选 1~3 个最匹配的选项。规则：①口味偏好是第一优先级，必须从 flavorTags 与用户口味相符的菜品中优先选择；②若确实没有完全匹配口味的选项，才可退而求其次选接近的，并在 reason 中说明；③饮食目标是辅助参考，不得凌驾于口味偏好之上。返回严格 JSON：
{
  "picks": [
    { "id": "外卖库中的id", "reason": "治愈系推荐理由（不超过80字）：结合用户最近饮食或本周分析，说明这道菜如何在口味偏好和健康之间取得平衡，语气温暖。若无历史数据则直接解释推荐逻辑。", "pairTip": "搭配小建议，如配一杯热饮，可省略" }
  ]
}`;
}

export function buildImportTakeoutPrompt(input: {
  text: string;
  flavorTagLabels: string[];
  avoidTagLabels: string[];
}) {
  return `你负责把用户描述的"学校食堂/外卖菜单"整理成结构化菜单库。用户可能是流水账式描述，你需要拆分出每一道具体菜品。

【口味标签词表】（flavorTags 尽量从中选，可补充其他简短描述词，每个菜 1~3 个）
${input.flavorTagLabels.join("、")}

【忌口冲突标签词表】（avoidConflicts 只能从下面选，没有就给空数组）
${input.avoidTagLabels.join("、")}

【规则】
① 只拆"具体菜品"（如：黄焖鸡米饭、麻辣香锅、番茄鸡蛋盖浇饭），不要把"一楼""面食窗口"这类场景词当菜品；
② restaurant：如果我写了「商家/窗口：XXX」，则下面所有菜品的 restaurant 必须**一字不差照抄 XXX**，不要自己另编店名；如果我没写，才由你按上下文填（如：一食堂·麻辣烫窗口、美团·华莱士），完全没有依据时写"学校食堂"；
③ category 填大类（如：盖浇饭、面食、麻辣烫、轻食、快餐、饮品）；
④ priceRange 有就填（如 ¥12-15），没有省略；
⑤ avoidConflicts 填这个菜天然会和哪些忌口标签冲突（如：麻辣香锅→不吃辣；不需要臆造）；
⑥ 用户描述里的模糊表述（"大概十几块"）可以转成区间。

【用户描述】
${input.text}

返回严格 JSON：
{
  "dishes": [
    { "restaurant": "...", "name": "...", "category": "...", "priceRange": "¥...", "flavorTags": ["..."], "avoidConflicts": [] }
  ]
}`;
}

export function buildWeeklyInsightPrompt(input: {
  weekRange: string;
  meals: { date: string; mealSlot: string; channel: string; dishes: { name: string; ingredients: string[] }[] }[];
  userProfile?: string;
  healthContext?: string;
  weekHealthSummary?: string;
}) {
  const mealsText = input.meals
    .map((m) => `${m.date} ${m.mealSlot}（${m.channel}）：${m.dishes.map((d) => `${d.name}(${d.ingredients.join("、")})`).join("、")}`)
    .join("\n");

  const healthPart = [input.healthContext ? `【健康档案】\n${input.healthContext}` : "", input.weekHealthSummary ? `【本周健康打卡汇总】${input.weekHealthSummary}` : ""]
    .filter(Boolean)
    .join("\n");

  return `你是一位温暖的中文营养分析师，基于用户本周（${input.weekRange}）真实的饮食记录给出定性点评，不要编造任何具体数字（不计算kcal/蛋白质等精确数值）。

【本周饮食记录】
${mealsText || "（本周暂无记录）"}
${input.userProfile ? `【用户长期饮食习惯参考】\n${input.userProfile}` : ""}
${healthPart ? `\n${healthPart}\n点评时可以顺带结合健康打卡情况（喝水/步数/睡眠）给一句鼓励或提醒。` : ""}

请给出一段 150 字以内的点评，语气温暖鼓励，指出做得好的地方和一个具体可行的小建议。直接返回纯文本，不要 JSON。`;
}

export function buildUpdateProfilePrompt(input: {
  recentMeals: { date: string; mealSlot: string; channel: string; dishes: { name: string; ingredients: string[] }[] }[];
  existingProfile?: string;
}) {
  const mealsText = input.recentMeals
    .map((m) => `${m.date} ${m.mealSlot}（${m.channel}）：${m.dishes.map((d) => `${d.name}(${d.ingredients.join("、")})`).join("、")}`)
    .join("\n");

  return `你负责维护一份用户饮食习惯笔记（markdown格式），用于未来推荐时参考。

【现有笔记】
${input.existingProfile || "（暂无，这是第一次生成）"}

【最近饮食记录】
${mealsText || "（暂无新记录）"}

请输出更新后的完整 markdown 笔记（覆盖式，不要简单追加）：保留仍然成立的旧观察，更新或删除已经过时的内容，补充新发现的偏好趋势（常吃食材、口味变化、忌口提醒、外卖比例、份量习惯等）。控制在 300 字以内，直接返回 markdown 正文，不要多余说明。`;
}
