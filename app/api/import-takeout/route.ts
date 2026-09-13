import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDeepSeekKey, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "../../lib/serverKeys";
import { buildImportTakeoutPrompt } from "../../lib/prompts";
import { FLAVOR_TAGS, AVOID_TAGS } from "../../lib/tags";
import type { TakeoutDish } from "../../lib/types";

export async function POST(req: Request) {
  const apiKey = getDeepSeekKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "请先在设置里配置 DeepSeek API Key" }, { status: 401 });
  }

  const body = await req.json();
  const { text = "" } = (body ?? {}) as { text?: string };
  if (!text.trim()) {
    return NextResponse.json({ error: "描述内容不能为空" }, { status: 400 });
  }

  const prompt = buildImportTakeoutPrompt({
    text,
    flavorTagLabels: FLAVOR_TAGS.map((t) => t.label),
    avoidTagLabels: AVOID_TAGS.map((t) => t.label),
  });

  try {
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw) as { dishes?: Partial<TakeoutDish>[] };

    // 保守清洗：至少要有菜名；标签统一转成字符串数组
    const dishes: Omit<TakeoutDish, "id">[] = (data.dishes || [])
      .filter((d) => typeof d?.name === "string" && d.name.trim())
      .map((d) => ({
        restaurant: String(d.restaurant || "学校食堂"),
        name: String(d.name).trim(),
        category: String(d.category || "其他"),
        priceRange: d.priceRange ? String(d.priceRange) : undefined,
        flavorTags: Array.isArray(d.flavorTags) ? d.flavorTags.map(String) : [],
        avoidConflicts: Array.isArray(d.avoidConflicts) ? d.avoidConflicts.map(String) : [],
      }));

    if (dishes.length === 0) {
      return NextResponse.json({ error: "没能从描述里识别出菜品，试着写具体菜名，如「一食堂有黄焖鸡米饭和麻辣香锅」" }, { status: 422 });
    }
    return NextResponse.json({ dishes });
  } catch (e: any) {
    console.error("import-takeout error:", e);
    return NextResponse.json({ error: e?.message || "导入失败" }, { status: 500 });
  }
}
