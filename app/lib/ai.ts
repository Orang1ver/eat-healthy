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
/** 一张截图里的店铺 + 它的菜品 */
type MerchantGroup = { merchant: string; dishes: ParsedMenuDish[] };

/** 把 AI 返回的菜品条目清洗成菜单库记录 */
function toTakeoutDishes(rows: Partial<TakeoutDish>[] | undefined, fallbackMerchant: string): Omit<TakeoutDish, "id">[] {
  return (rows || [])
    .filter((d) => typeof d?.name === "string" && d.name.trim())
    .map((d) => ({
      restaurant: String(d.restaurant || fallbackMerchant || "学校食堂"),
      name: String(d.name).trim(),
      category: String(d.category || "其他"),
      priceRange: d.priceRange ? String(d.priceRange) : undefined,
      flavorTags: strArr(d.flavorTags),
      avoidConflicts: strArr(d.avoidConflicts),
    }));
}

/**
 * 视觉识别：从菜单截图里同时读出「店铺名」和「菜品+价格」。
 * 店铺名通常在页面顶部，之前漏了这一项，导致所有菜都被归到"学校食堂"。
 * 按店铺分组返回，这样一次粘贴多个店铺的截图也能正确归属。
 */
async function parseMenuImages(images: string[]): Promise<MerchantGroup[]> {
  const parsed = await visionJSON<{
    merchants?: { merchant?: string; dishes?: ParsedMenuDish[] }[];
    dishes?: ParsedMenuDish[]; // 兼容只返回扁平列表的情况
  }>(
    `你是菜单识别助手。逐张查看这些外卖/食堂菜单截图，同时读出**店铺信息**和**可以下单的菜品**。

规则：
- merchant：这张图对应的店铺名 / 食堂窗口名，通常在页面顶部（如"杨国福麻辣烫(五道口店)"）。是食堂菜单牌没写店名时，填窗口名（如"一食堂二楼·麻辣香锅"）。实在看不出来就填空字符串，不要编造。
- **若连续多张图看起来是同一张长截图被切开的分段**（上下内容连贯、没有新店名），把它们视为**同一家店**：只有出现店名的那一段给 merchant，其余段 merchant 留空；菜品全部合并到这家店，不要拆成多个 merchants 条目。
- dishes：只要真实可点的菜品（含套餐/主食/小吃/饮品）。忽略：分类标题（如"招牌推荐""热销榜"）、月销量/评分、优惠券满减、已售罄商品、加料/辣度等规格选项、店铺公告。
- price 填当前售价的数字（元），图里没有价格就不要 price 字段。
- 同名菜品只保留一次。看不清的菜名跳过，不要猜。
- 不同截图属于不同店铺时，分开成多个 merchants 条目；同一店铺的多张截图合并为一个。

返回严格 JSON，不要多余文字：
{"merchants":[{"merchant":"杨国福麻辣烫(五道口店)","dishes":[{"name":"招牌麻辣烫","price":18},{"name":"酸辣粉","price":12}]}]}`,
    images,
  );

  const valid = (arr: ParsedMenuDish[] | undefined) =>
    (arr || []).filter((d) => typeof d?.name === "string" && d.name.trim());

  if (Array.isArray(parsed.merchants) && parsed.merchants.length > 0) {
    const groups = parsed.merchants
      .map((g) => ({ merchant: String(g?.merchant || "").trim(), dishes: valid(g?.dishes) }))
      .filter((g) => g.dishes.length > 0);

    // 商家名沿用兜底：长截图被切成多段后，只有第一段能看到店名，
    // 其余段模型通常返回空 merchant —— 若就此兜底成"学校食堂"，这家店的菜会被归错。
    // 因此空 merchant 的组沿用上一组的店名（长图切段的典型情形）。
    let last = "";
    return groups.map((g) => {
      const merchant = g.merchant || last;
      if (merchant) last = merchant;
      return { merchant, dishes: g.dishes };
    });
  }
  // 兼容：模型只返回了扁平 dishes
  const flat = valid(parsed.dishes);
  return flat.length > 0 ? [{ merchant: "", dishes: flat }] : [];
}

/** 用文字（截图识别结果 / 用户流水账描述）让文本模型补全分类、口味、忌口标签 */
async function fillDishTags(text: string): Promise<Partial<TakeoutDish>[]> {
  const prompt = buildImportTakeoutPrompt({
    text,
    flavorTagLabels: FLAVOR_TAGS.map((t) => t.label),
    avoidTagLabels: AVOID_TAGS.map((t) => t.label),
  });
  const data = await chatJSON<{ dishes?: Partial<TakeoutDish>[] }>(prompt, 0.2);
  return data.dishes || [];
}

export async function importTakeout(input: {
  text: string;
  images: string[];
  merchant?: string;
}): Promise<Omit<TakeoutDish, "id">[]> {
  const typedMerchant = (input.merchant || "").trim();
  const note = input.text.trim();

  // 有截图：先用视觉模型读出「店铺 + 菜品」，再按店铺逐组补标签
  if (input.images.length > 0) {
    const groups = await parseMenuImages(input.images);
    if (groups.length === 0) throw new Error("截图里没认出菜品，确认这是菜单页且文字清晰");

    const dishes: Omit<TakeoutDish, "id">[] = [];
    for (const g of groups) {
      // 用户手填的商家优先（比识别更准），其次用截图里读到的
      const merchant = typedMerchant || g.merchant;
      const listText = `${merchant ? `商家/窗口：${merchant}\n` : ""}识别出的菜品及价格：\n${g.dishes
        .map((d) => `${d.name}${d.price != null ? `（¥${d.price}）` : ""}`)
        .join("、")}`;
      const rows = await fillDishTags(note ? `${note}\n${listText}` : listText);
      // 商家归属以截图/手填为准，不采信文本模型的猜测
      const normalized = toTakeoutDishes(rows, merchant || "学校食堂").map((d) => ({
        ...d,
        restaurant: merchant || d.restaurant,
      }));
      dishes.push(...normalized);
    }

    if (dishes.length === 0) throw new Error("没能整理出菜品，换个更清晰的截图试试");
    return dishes;
  }

  // 纯文字描述：让文本模型自己拆分
  if (!note) throw new Error("描述内容不能为空");
  const rows = await fillDishTags(typedMerchant ? `商家/窗口：${typedMerchant}\n${note}` : note);
  const dishes = toTakeoutDishes(rows, typedMerchant || "学校食堂");
  if (dishes.length === 0) {
    throw new Error("没能从描述里识别出菜品，试着写具体菜名，如「一食堂有黄焖鸡米饭和麻辣香锅」");
  }
  return dishes;
}
