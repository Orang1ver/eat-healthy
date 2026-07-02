import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDeepSeekKey, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "../../lib/serverKeys";
import { buildUpdateProfilePrompt } from "../../lib/prompts";
import type { MealRecord } from "../../lib/types";

export async function POST(req: Request) {
  const apiKey = getDeepSeekKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "请先在设置里配置 DeepSeek API Key" }, { status: 401 });
  }

  const body = await req.json();
  const { recentMeals = [], existingProfile } = body as {
    recentMeals: MealRecord[];
    existingProfile?: string;
  };

  const prompt = buildUpdateProfilePrompt({
    recentMeals: recentMeals.map((m) => ({
      date: m.date,
      mealSlot: m.mealSlot,
      channel: m.channel,
      dishes: m.dishes.map((d) => ({ name: d.name, ingredients: d.ingredients.map((i) => i.label) })),
    })),
    existingProfile,
  });

  try {
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices?.[0]?.message?.content ?? existingProfile ?? "";
    return NextResponse.json({ content });
  } catch (e: any) {
    console.error("update-profile error:", e);
    return NextResponse.json({ error: e?.message || "饮食笔记更新失败" }, { status: 500 });
  }
}
