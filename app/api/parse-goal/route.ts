import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDeepSeekKey, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "../../lib/serverKeys";

export async function POST(req: Request) {
  const apiKey = getDeepSeekKey(req);
  const { goal } = await req.json();
  if (!goal) return NextResponse.json({ error: "缺少 goal" }, { status: 400 });

  if (!apiKey) {
    return NextResponse.json({ keywords: [], rationale: "未配置 API Key，跳过目标解析", source: "fallback" });
  }

  try {
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "只返回 JSON，不要任何多余文字。" },
        {
          role: "user",
          content: `用户的饮食目标："${goal}"。请提炼成 JSON：{"keywords": string[]（营养关键词，如蛋白质/维生素C）, "rationale": string（一句话说明这个目标对应什么饮食方向）}`,
        },
      ],
    });
    const text = completion.choices?.[0]?.message?.content ?? "{}";
    const data = JSON.parse(text);
    return NextResponse.json({ ...data, source: "llm" });
  } catch (e: any) {
    console.error("parse-goal error:", e);
    return NextResponse.json({ keywords: [], rationale: "", source: "fallback", error: e?.message }, { status: 200 });
  }
}
