/**
 * 菜单库的**固定大类**。
 *
 * 为什么必须固定：品类是 AI 从菜单截图/流水账里"猜"出来的，它天然会退化成几个大桶
 * （最典型的就是什么都塞「快餐」），于是一批菜里出现「快餐」「快餐类」「快餐简餐」这种
 * 近义类名，按品类筛选就没法用了。所以导入、手动添加、编辑、以及"重新整理分类"
 * 都只认这一套；AI 拿不准时的出口是「其他」，不是「快餐」。
 */
export const TAKEOUT_CATEGORIES = [
  "盖浇饭",
  "面食",
  "粉面米线",
  "麻辣烫·香锅",
  "火锅",
  "烧烤炸物",
  "家常炒菜",
  "轻食沙拉",
  "快餐简餐",
  "粥品",
  "小吃",
  "汤",
  "甜品饮品",
  "其他",
] as const;

export type TakeoutCategory = (typeof TAKEOUT_CATEGORIES)[number];

const SET = new Set<string>(TAKEOUT_CATEGORIES);

export function isCanonicalCategory(name: string): boolean {
  return SET.has((name || "").trim());
}

/**
 * 关键词 → 大类。**顺序即优先级**（越具体的越靠前），所以「汤面」会先撞到面食、
 * 「辣椒炒肉盖饭」会先撞到盖浇饭，而不是掉进后面的大桶。
 */
const RULES: [RegExp, TakeoutCategory][] = [
  [/麻辣烫|麻辣拌|冒菜|香锅/, "麻辣烫·香锅"],
  [/火锅|涮/, "火锅"],
  [/汉堡|披萨|炸鸡|薯条|意面|西式|快餐|简餐|套餐/, "快餐简餐"],
  [/烧烤|烤串|炸串|炸物|烤鱼|烤肉/, "烧烤炸物"],
  [/米线|米粉|河粉|粉丝|酸辣粉|螺蛳粉/, "粉面米线"],
  [/粥/, "粥品"],
  [/沙拉|轻食|健康餐|减脂餐/, "轻食沙拉"],
  [/甜品|甜点|饮品|奶茶|咖啡|饮料|果汁|冰/, "甜品饮品"],
  [/盖饭|盖浇饭|丼|煲仔饭|炒饭|拌饭|饭/, "盖浇饭"],
  [/面|饺|馄饨|云吞|包|馒头|饼|馍/, "面食"],
  [/汤|羹/, "汤"],
  [/小吃|凉皮|卤味|烤肠|关东煮|串/, "小吃"],
  [/家常|炒菜|川菜|湘菜|粤菜|东北菜|菜/, "家常炒菜"],
];

/** 兜底桶：这两类等于"没说清"，所以它们不该压过菜名给出的更具体判断 */
const WEAK: string[] = ["快餐简餐", "其他"];

function matchRules(s: string): TakeoutCategory | null {
  for (const [re, cat] of RULES) if (re.test(s)) return cat;
  return null;
}

/**
 * 把任意（历史/AI 写的）品类名归到固定大类：认得出就原样保留，认不出按关键词兜底，
 * 再认不出 → 「其他」。
 *
 * `dishName` 是**可选但很值钱**的第二证据：模型经常甩一个"快餐类/快餐"当兜底，
 * 光看品类名只能落进「快餐简餐」，而菜名往往一眼就能定（"鸡腿饭"→盖浇饭、"瓦罐汤"→汤）。
 * 所以规则是：品类名给出的判断**具体**（不是"快餐简餐/其他"）就听它的，否则让菜名说话。
 *
 * 它只是**安全网**：真正判断一道菜该归哪一类的是 AI（见 `buildRecategorizePrompt`），
 * 这里只保证库里永远不会出现近义类名或空品类。
 */
export function canonicalCategory(raw: string | undefined, dishName?: string): string {
  const name = (raw || "").trim();
  if (name && SET.has(name)) return name;
  const byCategory = name ? matchRules(name) : null;
  if (byCategory && !WEAK.includes(byCategory)) return byCategory;
  const byDish = dishName ? matchRules(dishName.trim()) : null;
  return byDish ?? byCategory ?? "其他";
}
