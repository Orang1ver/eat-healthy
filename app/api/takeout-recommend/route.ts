import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDeepSeekKey, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "../../lib/serverKeys";
import { buildTakeoutPrompt } from "../../lib/prompts";
import type { TakeoutDish } from "../../lib/types";

export async function POST(req: Request) {
  const apiKey = getDeepSeekKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "请先在设置里配置 DeepSeek API Key" }, { status: 401 });
  }

  const body = await req.json();
  const {
    flavorTags = [],
    avoidTags = [],
    note = "",
    goal = "",
    userProfile,
    takeoutDb = [],
    recentMeals,
    weeklyInsight,
  } = body as {
    flavorTags: string[];
    avoidTags: string[];
    note: string;
    goal: string;
    userProfile?: string;
    takeoutDb: TakeoutDish[];
    recentMeals?: { date: string; time: string; channel: string; dishes: { name: string; ingredients: string[] }[] }[];
    weeklyInsight?: string;
  };

  const filtered = takeoutDb.filter((d) => !d.avoidConflicts.some((c) => avoidTags.includes(c)));
  const candidates = (filtered.length > 0 ? filtered : takeoutDb).sort((a, b) => {
    const aMatch = flavorTags.length > 0 ? a.flavorTags.filter((t) => flavorTags.includes(t)).length : 0;
    const bMatch = flavorTags.length > 0 ? b.flavorTags.filter((t) => flavorTags.includes(t)).length : 0;
    return bMatch - aMatch;
  });

  const prompt = buildTakeoutPrompt({ flavorTags, avoidTags, note, goal, userProfile, takeoutDb: candidates, recentMeals, weeklyInsight });

  try {
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw) as { picks: { id: string; reason: string; pairTip?: string }[] };

    const byId = new Map(candidates.map((d) => [d.id, d]));
    const results = (data.picks || [])
      .map((p) => {
        const dish = byId.get(p.id);
        if (!dish) return null;
        return { ...dish, reason: p.reason, pairTip: p.pairTip };
      })
      .filter(Boolean);

    return NextResponse.json({ picks: results });
  } catch (e: any) {
    console.error("takeout-recommend error:", e);
    return NextResponse.json({ error: e?.message || "外卖推荐失败" }, { status: 500 });
  }
}
