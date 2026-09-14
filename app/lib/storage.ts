import { v4 as uuid } from "uuid";
import takeoutSeed from "@/data/takeoutMock.json";
import { DEFAULT_INGREDIENTS } from "./tags";
import type {
  CommonIngredient,
  DailyCheckin,
  HealthProfile,
  MealRecord,
  RewardState,
  TakeoutDish,
  UserProfile,
  WeeklyInsight,
} from "./types";
import { approxTimeForSlot, mealSlotFromTime, weekStartOf } from "./date";
import { normalizeRewards } from "./rewards";

const KEYS = {
  ingredients: "recipe.commonIngredients.v1",
  meals: "recipe.mealRecords.v1",
  weeklyInsight: "recipe.weeklyInsight.v1",
  userProfile: "recipe.userProfile.v1",
  takeoutMock: "recipe.takeoutMock.v2",
  healthProfile: "recipe.healthProfile.v1",
  dailyCheckins: "recipe.dailyCheckins.v1",
  rewards: "recipe.rewards.v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- 常用食材 ----------

export function loadCommonIngredients(): CommonIngredient[] {
  return read<CommonIngredient[]>(KEYS.ingredients, []);
}

export function addCommonIngredient(label: string): CommonIngredient {
  const list = loadCommonIngredients();
  const item: CommonIngredient = { id: uuid(), label, createdAt: Date.now() };
  write(KEYS.ingredients, [...list, item]);
  return item;
}

export function removeCommonIngredient(id: string) {
  write(
    KEYS.ingredients,
    loadCommonIngredients().filter((i) => i.id !== id)
  );
}

export function seedDefaultIngredientsIfEmpty() {
  if (loadCommonIngredients().length > 0) return;
  const seeded = DEFAULT_INGREDIENTS.map((label) => ({
    id: uuid(),
    label,
    createdAt: Date.now(),
  }));
  write(KEYS.ingredients, seeded);
}

// ---------- 饮食记录 ----------

/** 兼容旧数据：早期版本的记录没有 time 字段，按其固定餐次给一个近似时间，保证排序和展示一致 */
function normalizeMeal(m: MealRecord): MealRecord {
  if (m.time) return m;
  const time = approxTimeForSlot(m.mealSlot);
  return { ...m, time, mealSlot: m.mealSlot ?? mealSlotFromTime(time) };
}

export function loadMealRecords(): MealRecord[] {
  return read<MealRecord[]>(KEYS.meals, []).map(normalizeMeal);
}

export function addMealRecord(m: Omit<MealRecord, "id" | "createdAt" | "mealSlot">): MealRecord {
  const list = loadMealRecords();
  const record: MealRecord = { ...m, mealSlot: mealSlotFromTime(m.time), id: uuid(), createdAt: Date.now() };
  write(KEYS.meals, [record, ...list]);
  return record;
}

export function updateMealRecord(id: string, patch: Partial<MealRecord>) {
  const list = loadMealRecords();
  const next = list.map((m) => {
    if (m.id !== id) return m;
    const updated = { ...m, ...patch };
    if (patch.time) updated.mealSlot = mealSlotFromTime(patch.time);
    if (m.source === "ai" && (patch.dishes || patch.time)) updated.source = "ai-edited";
    return updated;
  });
  write(KEYS.meals, next);
}

export function deleteMealRecord(id: string) {
  write(
    KEYS.meals,
    loadMealRecords().filter((m) => m.id !== id)
  );
}

export function getMealsInWeek(weekStartISO: string): MealRecord[] {
  return loadMealRecords().filter((m) => weekStartOf(m.date) === weekStartISO);
}

// ---------- 本周分析缓存 ----------

export function loadWeeklyInsight(weekStart: string): WeeklyInsight | null {
  const all = read<Record<string, WeeklyInsight>>(KEYS.weeklyInsight, {});
  return all[weekStart] ?? null;
}

export function saveWeeklyInsight(w: WeeklyInsight) {
  const all = read<Record<string, WeeklyInsight>>(KEYS.weeklyInsight, {});
  all[w.weekStart] = w;
  write(KEYS.weeklyInsight, all);
}

// ---------- 用户饮食习惯文档 ----------

export function loadUserProfile(): UserProfile | null {
  return read<UserProfile | null>(KEYS.userProfile, null);
}

export function saveUserProfile(content: string) {
  write<UserProfile>(KEYS.userProfile, { content, updatedAt: Date.now() });
}

// ---------- 外卖 mock 库 ----------

export function loadTakeoutDishes(): TakeoutDish[] {
  return read<TakeoutDish[]>(KEYS.takeoutMock, []);
}

export function seedTakeoutMockIfEmpty() {
  if (loadTakeoutDishes().length > 0) return;
  write(KEYS.takeoutMock, takeoutSeed as TakeoutDish[]);
}

export function saveTakeoutDishes(dishes: TakeoutDish[]) {
  write(KEYS.takeoutMock, dishes);
}

/** 追加菜品；同商家同名视为重复，跳过。返回追加后的完整列表 */
export function addTakeoutDishes(incoming: Omit<TakeoutDish, "id">[]): { list: TakeoutDish[]; added: number } {
  const list = loadTakeoutDishes();
  const seen = new Set(list.map((d) => `${d.restaurant}::${d.name}`));
  const fresh = incoming.filter((d) => {
    const key = `${d.restaurant}::${d.name}`;
    if (seen.has(key) || !d.name?.trim()) return false;
    seen.add(key);
    return true;
  });
  const next = [...list, ...fresh.map((d) => ({ ...d, id: uuid() }))];
  saveTakeoutDishes(next);
  return { list: next, added: fresh.length };
}

export function removeTakeoutDish(id: string) {
  saveTakeoutDishes(loadTakeoutDishes().filter((d) => d.id !== id));
}

/** 修改一道菜；改完同商家同名会与别的菜撞车时拒绝（保持库内不重复） */
export function updateTakeoutDish(id: string, patch: Partial<Omit<TakeoutDish, "id">>): boolean {
  const list = loadTakeoutDishes();
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return false;
  const merged = { ...list[idx], ...patch };
  if (!merged.name?.trim()) return false;
  const clash = list.some((d) => d.id !== id && d.restaurant === merged.restaurant && d.name === merged.name);
  if (clash) return false;
  list[idx] = merged;
  saveTakeoutDishes(list);
  return true;
}

/** 清空并恢复到项目自带的示例库 */
export function resetTakeoutDishes() {
  write(KEYS.takeoutMock, takeoutSeed as TakeoutDish[]);
}

// ---------- 健康档案 ----------

export function loadHealthProfile(): HealthProfile | null {
  return read<HealthProfile | null>(KEYS.healthProfile, null);
}

export function saveHealthProfile(p: Omit<HealthProfile, "updatedAt">): HealthProfile {
  const profile: HealthProfile = { ...p, updatedAt: Date.now() };
  write(KEYS.healthProfile, profile);
  return profile;
}

// ---------- 每日健康打卡 ----------

export function loadCheckin(date: string): DailyCheckin | null {
  const all = read<Record<string, DailyCheckin>>(KEYS.dailyCheckins, {});
  return all[date] ?? null;
}

export function saveCheckin(date: string, patch: Partial<Omit<DailyCheckin, "date">>): DailyCheckin {
  const all = read<Record<string, DailyCheckin>>(KEYS.dailyCheckins, {});
  const prev = all[date];
  const next: DailyCheckin = {
    date,
    waterMl: Math.max(0, patch.waterMl ?? prev?.waterMl ?? 0),
    steps: Math.max(0, patch.steps ?? prev?.steps ?? 0),
    sleepHours: patch.sleepHours ?? prev?.sleepHours,
    mood: patch.mood ?? prev?.mood,
    updatedAt: Date.now(),
  };
  all[date] = next;
  write(KEYS.dailyCheckins, all);
  return next;
}

export function getCheckinsInWeek(weekStartISO: string): DailyCheckin[] {
  const all = read<Record<string, DailyCheckin>>(KEYS.dailyCheckins, {});
  return Object.values(all)
    .filter((c) => weekStartOf(c.date) === weekStartISO)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- 打卡奖励 ----------

export function loadRewards(): RewardState {
  const raw = read<unknown>(KEYS.rewards, null);
  // 归一化放在 rewards.ts 里，避免这里依赖太多
  return normalizeRewards(raw);
}

export function saveRewards(state: RewardState) {
  write(KEYS.rewards, state);
}
