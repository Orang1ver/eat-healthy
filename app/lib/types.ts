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
