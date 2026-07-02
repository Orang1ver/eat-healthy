import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDeepSeekKey, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "../../lib/serverKeys";
import { buildWeeklyInsightPrompt } from "../../lib/prompts";
import type { MealRecord } from "../../lib/types";

export async function POST(req: Request) {
  const apiKey = getDeepSeekKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "请先在设置里配置 DeepSeek API Key" }, { status: 401 });
  }

  const body = await req.json();
  const { meals = [], weekRange = "", userProfile } = body as {
    meals: MealRecord[];
    weekRange: string;
    userProfile?: string;
  };

  const prompt = buildWeeklyInsightPrompt({
    weekRange,
    meals: meals.map((m) => ({
      date: m.date,
      mealSlot: m.mealSlot,
      channel: m.channel,
      dishes: m.dishes.map((d) => ({ name: d.name, ingredients: d.ingredients.map((i) => i.label) })),
    })),
    userProfile,
  });

  try {
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.6,
      messages: [{ role: "user", content: prompt }],
    });

    const reply = completion.choices?.[0]?.message?.content ?? "暂时没有可点评的内容。";
    return NextResponse.json({ reply });
  } catch (e: any) {
    console.error("weekly-insight error:", e);
    return NextResponse.json({ error: e?.message || "本周分析生成失败" }, { status: 500 });
  }
}
