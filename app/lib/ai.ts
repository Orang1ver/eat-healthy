"use client";

import { buildImportTakeoutPrompt, buildRecommendPrompt, buildTakeoutPrompt, buildUpdateProfilePrompt, buildWeeklyInsightPrompt } from "./prompts";
import { chatJSON, chatText, visionJSON } from "./deepseek";
import { AVOID_TAGS, FLAVOR_TAGS, isSeasoning, type PortionPresetKey } from "./tags";
import type { Dish, DishIngredient, TakeoutDish } from "./types";

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

// ---------- 自己做推荐 ----------

export async function recommend(input: {
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
}): Promise<{ title: string; dishes: Dish[]; shoppingList: string[]; aiMessage: string }> {
  const prompt = buildRecommendPrompt(input);
  const data = await chatJSON<{ title: string; dishes: Dish[]; aiMessage: string }>(prompt, 0.5);

  const allowedSet = new Set(input.ingredients.map((i) => i.toLowerCase()));
  const shoppingSet = new Set<string>();
  const dishes: Dish[] = (data.dishes || []).map((dish) => {
    const ings: DishIngredient[] = (dish.ingredients || []).map((ing) => {
      const label = String(ing.label);
      const inUserList = allowedSet.has(label.toLowerCase());
      // 调料一律视为厨房常备；「仅用已有食材」时也不允许引入新食材
      const fromPantry = input.onlyPantry ? true : inUserList || isSeasoning(label);
      if (!fromPantry) shoppingSet.add(label);
      return { label, fromPantry };
    });
    return { name: dish.name, role: dish.role, flavorTags: strArr(dish.flavorTags), ingredients: ings };
  });

  return {
    title: data.title,
    dishes,
    shoppingList: input.onlyPantry ? [] : Array.from(shoppingSet),
    aiMessage: data.aiMessage,
  };
}

// ---------- 外卖推荐 ----------

export async function takeoutRecommend(input: {
  flavorTags: string[];
  avoidTags: string[];
  note: string;
  goal: string;
  userProfile?: string;
  healthContext?: string;
  takeoutDb: TakeoutDish[];
  recentMeals?: { date: string; time: string; channel: string; dishes: { name: string; ingredients: string[] }[] }[];
  weeklyInsight?: string;
}): Promise<(TakeoutDish & { reason: string; pairTip?: string })[]> {
  const filtered = input.takeoutDb.filter((d) => !d.avoidConflicts.some((c) => input.avoidTags.includes(c)));
  const candidates = (filtered.length > 0 ? filtered : input.takeoutDb).sort((a, b) => {
    const aMatch = input.flavorTags.length > 0 ? a.flavorTags.filter((t) => input.flavorTags.includes(t)).length : 0;
    const bMatch = input.flavorTags.length > 0 ? b.flavorTags.filter((t) => input.flavorTags.includes(t)).length : 0;
    return bMatch - aMatch;
  });

  const prompt = buildTakeoutPrompt({ ...input, takeoutDb: candidates });
  const data = await chatJSON<{ picks: { id: string; reason: string; pairTip?: string }[] }>(prompt, 0.5);

  const byId = new Map(candidates.map((d) => [d.id, d]));
  return (data.picks || [])
    .map((p) => {
      const dish = byId.get(p.id);
      if (!dish) return null;
      return { ...dish, reason: p.reason, pairTip: p.pairTip };
    })
    .filter(Boolean) as (TakeoutDish & { reason: string; pairTip?: string })[];
}

// ---------- 本周分析 + 饮食档案更新 ----------

export async function weeklyInsight(input: {
  weekRange: string;
  meals: { date: string; mealSlot: string; channel: string; dishes: { name: string; ingredients: string[] }[] }[];
  userProfile?: string;
  healthContext?: string;
  weekHealthSummary?: string;
}): Promise<string> {
  return chatText(buildWeeklyInsightPrompt(input), 0.6);
}

export async function updateProfile(input: {
  recentMeals: { date: string; mealSlot: string; channel: string; dishes: { name: string; ingredients: string[] }[] }[];
  existingProfile?: string;
}): Promise<string> {
  const data = await chatText(buildUpdateProfilePrompt(input), 0.4);
  return data.trim();
}

// ---------- 菜单库导入（文字 / 截图） ----------

type ParsedMenuDish = { name: string; price?: number };

export async function importTakeout(input: {
  text: string;
  images: string[];
  merchant?: string;
}): Promise<Omit<TakeoutDish, "id">[]> {
  let sourceText = input.text.trim();

  if (input.images.length > 0) {
    const parsed = await visionJSON<{ dishes?: ParsedMenuDish[] }>(
      `你是菜单识别助手。逐张查看这些外卖/食堂菜单截图，提取所有可以下单的菜品。

规则：
- 只要真实可点的菜品（含套餐/主食/小吃/饮品），忽略：分类标题（如"招牌推荐""热销榜"）、月销量/评分、优惠券满减、已售罄商品、加料/辣度等规格选项、店铺公告。
- price 填当前售价的数字（元），图里没有价格就不要 price 字段。
- 同名菜品只保留一次。看不清的菜名跳过，不要猜。

返回严格 JSON，不要多余文字：
{"dishes":[{"name":"黄焖鸡米饭","price":15},{"name":"酸辣土豆丝"}]}`,
      input.images,
    );
    const list = (parsed.dishes || []).filter((d) => typeof d?.name === "string" && d.name.trim());
    if (list.length === 0) throw new Error("截图里没认出菜品，确认这是菜单页且文字清晰");

    const listText = `${input.merchant ? `商家/窗口：${input.merchant}\n` : ""}识别出的菜品及价格：\n${list
      .map((d) => `${d.name}${d.price != null ? `（¥${d.price}）` : ""}`)
      .join("、")}`;
    sourceText = sourceText ? `${sourceText}\n${listText}` : listText;
  }

  if (!sourceText) throw new Error("描述内容不能为空");

  const prompt = buildImportTakeoutPrompt({
    text: sourceText,
    flavorTagLabels: FLAVOR_TAGS.map((t) => t.label),
    avoidTagLabels: AVOID_TAGS.map((t) => t.label),
  });
  const data = await chatJSON<{ dishes?: Partial<TakeoutDish>[] }>(prompt, 0.2);

  const dishes = (data.dishes || [])
    .filter((d) => typeof d?.name === "string" && d.name.trim())
    .map((d) => ({
      restaurant: String(d.restaurant || input.merchant || "学校食堂"),
      name: String(d.name).trim(),
      category: String(d.category || "其他"),
      priceRange: d.priceRange ? String(d.priceRange) : undefined,
      flavorTags: strArr(d.flavorTags),
      avoidConflicts: strArr(d.avoidConflicts),
    }));

  if (dishes.length === 0) {
    throw new Error("没能从描述里识别出菜品，试着写具体菜名，如「一食堂有黄焖鸡米饭和麻辣香锅」");
  }
  return dishes;
}
