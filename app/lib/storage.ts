import { v4 as uuid } from "uuid";
import takeoutSeed from "@/data/takeoutMock.json";
import { DEFAULT_INGREDIENTS } from "./tags";
import type {
  CommonIngredient,
  DailyCheckin,
  ExerciseAwards,
  ExerciseRecord,
  HealthProfile,
  MealRecord,
  RewardState,
  TakeoutDish,
  UserProfile,
  WeeklyInsight,
  WeightEntry,
} from "./types";
import { addDays, approxTimeForSlot, mealSlotFromTime, weekStartOf } from "./date";
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
  weights: "recipe.weights.v1",
  exercises: "recipe.exercises.v1",
  exerciseAwards: "recipe.exerciseAwards.v1",
  takeoutSeeded: "recipe.takeoutSeeded.v1",
  takeoutUndo: "recipe.takeoutUndo.v1",
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

/**
 * 只在"从未播过种"时写入示例库。
 *
 * 早先的实现是 `if (loadTakeoutDishes().length > 0) return;` —— 只要库为空就重新灌示例，
 * 于是用户把商家全删光后一刷新，29 条示例菜又回来了，看起来像"删不掉"。
 * 现在用一次性标记控制，顺序很重要（写错会覆盖老用户的数据）：
 *   已有标记 → 直接返回
 *   库里已有数据（老用户）→ 只补标记，绝不动数据
 *   真正的首次运行 → 写示例库 + 写标记
 */
export function seedTakeoutMockIfEmpty() {
  if (read<boolean>(KEYS.takeoutSeeded, false)) return;
  if (loadTakeoutDishes().length > 0) {
    write(KEYS.takeoutSeeded, true);
    return;
  }
  write(KEYS.takeoutMock, takeoutSeed as TakeoutDish[]);
  write(KEYS.takeoutSeeded, true);
}

export function saveTakeoutDishes(dishes: TakeoutDish[]) {
  write(KEYS.takeoutMock, dishes);
}

/** 库内菜品的主键：同商家同名视为同一道菜 */
function dishKey(d: Pick<TakeoutDish, "restaurant" | "name">): string {
  return `${d.restaurant}::${d.name}`;
}

/**
 * 导入菜品。默认跳过已存在的同商家同名菜；`overwriteSameName` 时用新数据覆盖旧记录。
 *
 * 覆盖时的两个要点：
 * - **复用旧 id**：否则 React 的 key 会变，用户正打开的编辑弹窗会指向已消失的行
 * - 同批内出现同名时**后者覆盖前者**（模型的输出顺序不可靠，靠后的通常信息更全）
 * - `priceRange` 为新数据的原值（可能是 undefined）—— 即"以新数据为准"，
 *   与 EditDishDialog 里 `price.trim() || undefined` 的语义保持一致
 */
export function addTakeoutDishes(
  incoming: Omit<TakeoutDish, "id">[],
  opts?: { overwriteSameName?: boolean },
): { list: TakeoutDish[]; added: number; updated: number } {
  const overwrite = !!opts?.overwriteSameName;
  const list = loadTakeoutDishes();
  const indexOf = new Map(list.map((d, i) => [dishKey(d), i]));

  let added = 0;
  let updated = 0;

  for (const d of incoming) {
    if (!d.name?.trim()) continue;
    const key = dishKey(d);
    const at = indexOf.get(key);
    if (at === undefined) {
      list.push({ ...d, id: uuid() });
      indexOf.set(key, list.length - 1);
      added++;
    } else if (overwrite) {
      // 复用旧 id，只替换内容
      list[at] = { ...d, id: list[at].id };
      updated++;
    }
    // 未开启覆盖且已存在 → 跳过（保持旧行为）
  }

  saveTakeoutDishes(list);
  return { list, added, updated };
}

export function removeTakeoutDish(id: string) {
  saveTakeoutDishes(loadTakeoutDishes().filter((d) => d.id !== id));
}

/** 删除某个商家的全部菜品，返回删除后的完整列表 */
export function removeTakeoutMerchant(restaurant: string): TakeoutDish[] {
  const next = loadTakeoutDishes().filter((d) => d.restaurant !== restaurant);
  saveTakeoutDishes(next);
  return next;
}

/**
 * 给整个商家改名：它名下所有菜品一起换到新店名。
 *
 * 顺带处理改名后可能出现的重名：若目标店名已存在，两家的菜品会合并，
 * 此时按「店名 + 菜名」去重（保留先出现的），并把合并条数如实返回。
 * —— 这正是修掉"杨国福麻辣烫"与"杨国福麻辣烫(五道口店)"这类重复商家的手段。
 */
export function renameTakeoutMerchant(
  oldName: string,
  newName: string,
): { list: TakeoutDish[]; renamed: number; merged: number } {
  const target = newName.trim();
  const list = loadTakeoutDishes();
  const renamed = list.filter((d) => d.restaurant === oldName).length;
  if (!target || target === oldName || renamed === 0) {
    return { list, renamed: 0, merged: 0 };
  }

  const renamedList = list.map((d) => (d.restaurant === oldName ? { ...d, restaurant: target } : d));

  const seen = new Set<string>();
  const deduped: TakeoutDish[] = [];
  let merged = 0;
  for (const d of renamedList) {
    const key = dishKey(d);
    if (seen.has(key)) {
      merged++;
      continue;
    }
    seen.add(key);
    deduped.push(d);
  }

  saveTakeoutDishes(deduped);
  return { list: deduped, renamed, merged };
}

/** 清空整个菜单库（不写种子） */
export function clearTakeoutDishes(): TakeoutDish[] {
  saveTakeoutDishes([]);
  return [];
}

/**
 * 导入菜品（可选先清空全库）。把"清空 + 写入"合成一次写操作，
 * 避免中间出现"库为空"的短暂状态（那会被种子逻辑撞上）。
 */
export function importTakeoutDishes(
  incoming: Omit<TakeoutDish, "id">[],
  opts: { overwriteSameName?: boolean; clearFirst?: boolean },
): { list: TakeoutDish[]; added: number; updated: number } {
  if (opts.clearFirst) saveTakeoutDishes([]);
  return addTakeoutDishes(incoming, { overwriteSameName: opts.overwriteSameName });
}

/**
 * 批量**只改品类**：一次读、一次写，菜名/商家/价格/口味/忌口全部原样保留。
 *
 * 给"重新整理分类"用。写之前由调用方 `pushTakeoutUndo` 存快照，所以这里不负责撤销；
 * 传入里没提到的菜（例如模型漏答的）保持原样，不会被清成空。
 */
export function applyTakeoutCategories(pairs: { id: string; category: string }[]): TakeoutDish[] {
  const map = new Map(pairs.map((p) => [p.id, p.category]));
  const next = loadTakeoutDishes().map((d) => (map.has(d.id) ? { ...d, category: map.get(d.id) as string } : d));
  saveTakeoutDishes(next);
  return next;
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

/** 清空并恢复到项目自带的示例库（唯一允许重新灌种子的入口，同时补上标记） */
export function resetTakeoutDishes() {
  write(KEYS.takeoutMock, takeoutSeed as TakeoutDish[]);
  write(KEYS.takeoutSeeded, true);
}

// ---------- 菜单库操作快照（撤销用） ----------

/**
 * 单槽撤销：只保留最近一次破坏性操作前的菜单库。
 *
 * 为什么是单槽而不是栈：快照存的是整份菜单库（几十条），多份会让备份明显膨胀，
 * 而实际需要的是"哎我刚删错了"这一次。键在 recipe. 前缀内，
 * 因此会被备份导出带上，也会被「清空全部数据」一并清掉（语义一致）。
 */
export type TakeoutUndo = {
  reason: string;
  at: number;
  dishes: TakeoutDish[];
};

export function pushTakeoutUndo(reason: string, dishes: TakeoutDish[]) {
  const snap: TakeoutUndo = { reason, at: Date.now(), dishes };
  write(KEYS.takeoutUndo, snap);
}

export function peekTakeoutUndo(): TakeoutUndo | null {
  const snap = read<TakeoutUndo | null>(KEYS.takeoutUndo, null);
  return snap && Array.isArray(snap.dishes) ? snap : null;
}

/** 恢复快照并清空槽位（只能撤销一次） */
export function popTakeoutUndo(): TakeoutDish[] | null {
  const snap = peekTakeoutUndo();
  if (!snap) return null;
  saveTakeoutDishes(snap.dishes);
  write(KEYS.takeoutUndo, null);
  return snap.dishes;
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

/**
 * 最近 N 天（含今天）的打卡，升序。
 * 用"滚动窗口"而不是自然周：仪表盘上的 7 根柱子要的是"最近的走势"，
 * 周一打开时不该只剩一根柱子（自然周那种读法留给「本周打卡」卡）。
 */
export function getRecentCheckins(days: number, todayISOStr: string): DailyCheckin[] {
  const from = addDays(todayISOStr, -(days - 1));
  const all = read<Record<string, DailyCheckin>>(KEYS.dailyCheckins, {});
  return Object.values(all)
    .filter((c) => c.date >= from && c.date <= todayISOStr)
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

// ---------- 体重记录 ----------

const WEIGHT_MIN = 25;
const WEIGHT_MAX = 200;

export function loadWeights(): Record<string, WeightEntry> {
  return read<Record<string, WeightEntry>>(KEYS.weights, {});
}

/** 记录某天体重（同一天覆盖）。数值越界则拒绝，返回 null。 */
export function saveWeight(date: string, weightKg: number): Record<string, WeightEntry> | null {
  const kg = Math.round(weightKg * 10) / 10;
  if (!Number.isFinite(kg) || kg < WEIGHT_MIN || kg > WEIGHT_MAX) return null;
  const all = loadWeights();
  all[date] = { date, weightKg: kg, at: Date.now() };
  write(KEYS.weights, all);
  return all;
}

export function removeWeight(date: string): Record<string, WeightEntry> {
  const all = loadWeights();
  delete all[date];
  write(KEYS.weights, all);
  return all;
}

// ---------- 运动记录 ----------

export function loadExercises(): ExerciseRecord[] {
  return read<ExerciseRecord[]>(KEYS.exercises, []);
}

/** 追加一条运动记录，返回最新的完整列表（最新在前） */
export function addExercise(input: Omit<ExerciseRecord, "id" | "at">): ExerciseRecord[] {
  const list = loadExercises();
  const rec: ExerciseRecord = { ...input, id: uuid(), at: Date.now() };
  const next = [rec, ...list];
  write(KEYS.exercises, next);
  return next;
}

export function removeExercise(id: string): ExerciseRecord[] {
  const next = loadExercises().filter((e) => e.id !== id);
  write(KEYS.exercises, next);
  return next;
}

export function loadExerciseAwards(): ExerciseAwards {
  return read<ExerciseAwards>(KEYS.exerciseAwards, {});
}

export function saveExerciseAwards(a: ExerciseAwards) {
  write(KEYS.exerciseAwards, a);
}
