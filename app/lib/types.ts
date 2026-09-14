import type { DishRole, MealSlot, PortionPresetKey } from "./tags";

export type CommonIngredient = {
  id: string;
  label: string;
  createdAt: number;
};

export type DishIngredient = {
  label: string;
  fromPantry: boolean;
};

export type Dish = {
  name: string;
  role: DishRole;
  ingredients: DishIngredient[];
  flavorTags: string[];
};

export type MealChannel = "自己做" | "外卖";
export type MealSource = "ai" | "manual" | "ai-edited";

export type MealRecord = {
  id: string;
  date: string;
  time: string; // "HH:mm"，用户自由选择的具体时间，不再局限于固定餐次
  mealSlot: MealSlot; // 由 time 自动推导，仅用于 AI prompt 语境和标签展示，不作为 UI 分组依据
  title?: string;
  dishes: Dish[];
  channel: MealChannel;
  avoidTags: string[];
  methodTags: string[];
  portionPreset?: PortionPresetKey;
  dishCount?: number;
  onlyPantry?: boolean;
  shoppingList?: string[];
  goal?: string;
  aiMessage?: string;
  source: MealSource;
  createdAt: number;
};

export type WeeklyInsight = {
  weekStart: string;
  reply: string;
  generatedAt: number;
};

export type TakeoutDish = {
  id: string;
  restaurant: string;
  name: string;
  category: string;
  priceRange?: string;
  flavorTags: string[];
  avoidConflicts: string[];
};

export type UserProfile = {
  content: string;
  updatedAt: number;
};

// ---------- 健康档案（v1 结合版：档案驱动推荐） ----------

export type Sex = "男" | "女";
export type ActivityLevel = "久坐少动" | "轻度活动" | "中度活动" | "高度活动";
export type HealthGoal = "减脂" | "增肌" | "维持健康";

export type HealthProfile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: HealthGoal;
  allergies: string; // 过敏/忌口，自由文本
  conditions: string; // 身体状况备注，如肠胃不好、乳糖不耐
  updatedAt: number;
};

export type DailyCheckin = {
  date: string; // ISO "2026-09-13"
  waterMl: number;
  steps: number;
  sleepHours?: number;
  mood?: "好" | "一般" | "累";
  updatedAt: number;
};

// ---------- 体重记录 ----------

/** 体重记录：每天一条，同一天重复记录覆盖 */
export type WeightEntry = {
  date: string; // ISO "2026-09-14"
  weightKg: number;
  at: number;
};

// ---------- 打卡奖励 ----------

/**
 * 奖励数据独立存放，不写进 DailyCheckin —— 避免污染既有的数据归一化与备份描述。
 * 仍在 recipe. 前缀下，所以自动被备份导出/清空覆盖。
 */
export type RewardState = {
  /** 达标日期 -> 当天的连续天数 */
  days: Record<string, { streak: number; at: number }>;
  /** 已获得的徽章：徽章 id -> 获得日期（一旦拿到永久保留） */
  badges: Record<string, string>;
  /** 已弹过庆祝的日期，防止反复加水量重复庆祝 */
  celebrated: string[];
};
