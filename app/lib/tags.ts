export type TagDef = {
  label: string;
  description: string;
  promptHint: string;
};

export const FLAVOR_TAGS: TagDef[] = [
  { label: "清淡", description: "少调味，突出食材本味", promptHint: "优先白灼/清蒸/少油少盐做法，避免重油重辣" },
  { label: "麻辣", description: "川渝风味，花椒+辣椒并重", promptHint: "可用豆瓣酱、花椒、辣椒，突出麻和辣两种感觉" },
  { label: "微辣", description: "吃辣但不嗜辣", promptHint: "辣度控制在轻微，用少量辣椒/胡椒提味而非主导" },
  { label: "酸辣", description: "酸味与辣味并重", promptHint: "可用醋、泡椒、柠檬等酸味食材搭配辣味调料" },
  { label: "甜口", description: "偏家常甜口/南方口味", promptHint: "适量加糖，或选用自带甜味的食材（南瓜、玉米、番茄）" },
  { label: "咸鲜", description: "咸味为主，鲜味突出", promptHint: "可用酱油、蚝油、菌菇类提鲜" },
  { label: "少油", description: "控制烹饪用油量", promptHint: "优先蒸/煮/烤，避免煎炸" },
  { label: "少盐", description: "控制钠摄入", promptHint: "减少酱料用量，多依靠食材本味和天然香料提味" },
];

export const AVOID_TAGS: TagDef[] = [
  { label: "不吃香菜", description: "完全避免香菜及相关调味", promptHint: "菜品和摆盘描述中不出现香菜，包括香菜末等配料" },
  { label: "不吃葱姜蒜", description: "完全避免葱、姜、蒜及其制品", promptHint: "包括蒜末、姜丝、葱花等隐藏配料也要排除" },
  { label: "不吃辣", description: "避免一切辣椒/花椒类调味", promptHint: "与麻辣/微辣/酸辣口味互斥，完全不使用辣椒花椒" },
  { label: "无乳制品", description: "避免牛奶、奶酪、黄油等", promptHint: "烘焙类需用替代品（植物奶、橄榄油）或排除" },
  { label: "无麸质", description: "避免小麦/大麦/黑麦及其制品", promptHint: "排除面粉、面条、面包，主食改用米饭/米粉/杂粮" },
  { label: "素食", description: "不含肉类、海鲜、禽类", promptHint: "蛋奶是否允许以用户备注为准，未注明则按蛋奶素处理" },
];

export const METHOD_TAGS: TagDef[] = [
  { label: "火锅", description: "食材分开涮煮，配锅底和蘸料", promptHint: "适合想要丰富食材体验、多人或一人小火锅场景，清淡或麻辣场景均适用，暖胃，适合冷天；适合消耗多种食材" },
  { label: "香煎", description: "少油煎至两面金黄，锁住肉汁", promptHint: "适合肉类、豆腐类、煎蛋；西式口味；可配海盐黑胡椒或椒盐等其他调料" },
  { label: "清蒸", description: "原汁原味，保留营养和清淡口感", promptHint: "适合鱼类、蔬菜、蛋羹；清淡；底油低盐；适合生病食用" },
  { label: "凉拌", description: "生食或焯水后冷调味", promptHint: "适合夏天/快手凉菜，省去开火时间；口味清爽" },
  { label: "炖煮", description: "长时间小火慢炖", promptHint: "适合根茎类蔬菜、带骨肉类，汤汁浓郁；暖胃；适合天冷食用" },
  { label: "烧烤", description: "明火/烤箱炙烤，外焦里嫩", promptHint: "适合肉类和部分耐烤蔬菜" },
  { label: "快炒", description: "大火快速翻炒，锁住脆嫩口感", promptHint: "适合绿叶菜、嫩肉片等，出餐快；常见做法" },
  { label: "烘焙", description: "烤箱烘烤类", promptHint: "适合面点、甜品" },
  { label: "不限", description: "不指定做法", promptHint: "由 AI 根据食材、场景用户需求和历史饮食习惯自由发挥" },
];

export type PortionPresetKey =
  | "1人食-盖饭"
  | "1人食-小火锅"
  | "1人食-1菜1汤"
  | "家常-2菜1汤"
  | "丰盛"
  | "自定义";

export const PORTION_PRESETS: { key: PortionPresetKey; label: string; description: string }[] = [
  { key: "1人食-盖饭", label: "1人食·盖饭", description: "一道主菜+米饭打底做成盖饭形式，1人份，操作简单" },
  { key: "1人食-小火锅", label: "1人食·小火锅", description: "单人迷你火锅，少量食材+锅底，强调便捷和暖意" },
  { key: "1人食-1菜1汤", label: "1人食·1菜1汤", description: "一道主菜+一道汤，简单不将就" },
  { key: "家常-2菜1汤", label: "家常·2菜1汤", description: "经典家庭餐桌组合，2道炒菜+1道汤" },
  { key: "丰盛", label: "丰盛", description: "3~4道菜（至少含1荤1素1汤），适合聚餐/犒劳自己" },
  { key: "自定义", label: "自定义", description: "用户手动指定道数" },
];

/** 互斥组：组内任一项被选中，组内其余项在 UI 上禁用 */
export const MUTUAL_EXCLUSION_GROUPS: string[][] = [["不吃辣", "麻辣", "微辣", "酸辣"]];

export const DEFAULT_INGREDIENTS = ["鸡胸肉", "西兰花", "米饭", "鸡蛋", "番茄", "豆腐", "猪肉", "青菜"];

export const MEAL_SLOTS = ["早餐", "午餐", "晚餐", "加餐"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const DISH_ROLES = ["主菜", "主食", "汤", "甜品", "小菜"] as const;
export type DishRole = (typeof DISH_ROLES)[number];

/**
 * 调料/厨房常备关键词：默认假设用户家里都有，不出现在购物清单里。
 * 用"包含匹配"而不是精确匹配，因为 AI 可能写"葱花""姜丝""生抽一勺"等变体。
 */
export const SEASONING_KEYWORDS = [
  "盐", "油", "水", "糖", "醋", "酱油", "生抽", "老抽", "蚝油", "料酒", "黄酒",
  "葱", "姜", "蒜", "胡椒", "花椒", "辣椒粉", "辣椒面", "八角", "香叶", "桂皮",
  "孜然", "淀粉", "芝麻", "香油", "豆瓣酱", "甜面酱", "味精", "鸡精", "鸡粉",
  "白糖", "冰糖", "食用油", "橄榄油", "香菜", "葱花", "姜丝", "蒜末", "蒜蓉",
  "五香粉", "咖喱粉", "糖醋汁", "番茄酱", "沙拉酱", "黑胡椒",
];

export function isSeasoning(label: string): boolean {
  return SEASONING_KEYWORDS.some((kw) => label.includes(kw));
}
