import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDeepSeekKey, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "../../lib/serverKeys";
import { buildRecommendPrompt } from "../../lib/prompts";
import type { Dish, DishIngredient } from "../../lib/types";
import { isSeasoning, type PortionPresetKey } from "../../lib/tags";

export async function POST(req: Request) {
  const apiKey = getDeepSeekKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "请先在设置里配置 DeepSeek API Key" }, { status: 401 });
  }

  const body = await req.json();
  const {
    ingredients = [],
    onlyPantry = false,
    flavorTags = [],
    avoidTags = [],
    note = "",
    methodTags = [],
    portionPreset = "家常-2菜1汤",
    dishCount,
    wantDessert = false,
    goal = "",
    userProfile,
    healthContext,
    feedback,
    recentMeals,
    weeklyInsight,
  } = body as {
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
  };

  const prompt = buildRecommendPrompt({
    ingredients,
    onlyPantry,
    flavorTags,
    avoidTags,
    note,
    methodTags,
    portionPreset,
    dishCount,
    wantDessert,
    goal,
    userProfile,
    healthContext,
    feedback,
    recentMeals,
    weeklyInsight,
  });

  try {
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw) as { title: string; dishes: Dish[]; aiMessage: string };

    const allowedSet = new Set(ingredients.map((i) => i.toLowerCase()));
    const shoppingSet = new Set<string>();

    const sanitizedDishes: Dish[] = (data.dishes || []).map((dish) => {
      const ings: DishIngredient[] = (dish.ingredients || []).map((ing) => {
        const label = String(ing.label);
        const inUserList = allowedSet.has(label.toLowerCase());
        // 调料一律视为厨房常备，不管 AI 怎么标，也不管用户是否选过
        const fromPantry = onlyPantry ? true : inUserList || isSeasoning(label);
        if (!fromPantry) shoppingSet.add(label);
        return { label, fromPantry };
      });
      return { name: dish.name, role: dish.role, flavorTags: dish.flavorTags || [], ingredients: ings };
    });

    return NextResponse.json({
      title: data.title,
      dishes: sanitizedDishes,
      shoppingList: onlyPantry ? [] : Array.from(shoppingSet),
      aiMessage: data.aiMessage,
    });
  } catch (e: any) {
    console.error("recommend error:", e);
    return NextResponse.json({ error: e?.message || "推荐生成失败" }, { status: 500 });
  }
}
