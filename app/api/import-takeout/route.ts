import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDeepSeekKey, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, DEEPSEEK_VISION_MODEL } from "../../lib/serverKeys";
import { buildImportTakeoutPrompt } from "../../lib/prompts";
import { FLAVOR_TAGS, AVOID_TAGS } from "../../lib/tags";
import type { TakeoutDish } from "../../lib/types";

type ParsedDish = { name: string; price?: number };

/** 用 deepseek-flash 的视觉能力从菜单截图提取菜名和价格 */
async function parseMenuImages(client: OpenAI, images: string[]): Promise<ParsedDish[]> {
  const content: { type: string; image_url?: { url: string }; text?: string }[] = images.map((url) => ({
    type: "image_url",
    image_url: { url },
  }));
  content.push({
    type: "text",
    text: `你是菜单识别助手。逐张查看这些外卖/食堂菜单截图，提取所有可以下单的菜品。

规则：
- 只要真实可点的菜品（含套餐/主食/小吃/饮品），忽略：分类标题（如"招牌推荐""热销榜"）、月销量/评分、优惠券满减、已售罄商品、加料/辣度等规格选项、店铺公告。
- price 填当前售价的数字（元），图里没有价格就不要 price 字段。
- 同名菜品只保留一次。看不清的菜名跳过，不要猜。

返回严格 JSON，不要多余文字：
{"dishes":[{"name":"黄焖鸡米饭","price":15},{"name":"酸辣土豆丝"}]}`,
  });

  const completion = await client.chat.completions.create({
    model: DEEPSEEK_VISION_MODEL,
    temperature: 0.1,
    messages: [{ role: "user", content: content as never }],
  });

  const raw = completion.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
  const data = JSON.parse(cleaned) as { dishes?: ParsedDish[] };
  return (data.dishes || []).filter((d) => typeof d?.name === "string" && d.name.trim());
}

export async function POST(req: Request) {
  const apiKey = getDeepSeekKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "请先在设置里配置 DeepSeek API Key" }, { status: 401 });
  }

  const body = await req.json();
  const { text = "", images = [], merchant = "" } = (body ?? {}) as {
    text?: string;
    images?: string[];
    merchant?: string;
  };

  if (!text.trim() && images.length === 0) {
    return NextResponse.json({ error: "描述内容不能为空" }, { status: 400 });
  }
  if (images.length > 5) {
    return NextResponse.json({ error: "一次最多 5 张截图" }, { status: 400 });
  }

  try {
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    let sourceText = text.trim();

    if (images.length > 0) {
      // 第一步：视觉模型从截图提取「菜名 + 价格」
      let parsed: ParsedDish[];
      try {
        parsed = await parseMenuImages(client, images);
      } catch (e: any) {
        console.error("vision parse error:", e);
        return NextResponse.json({ error: `截图识别失败：${e?.message || "请确认 Key 支持 deepseek-flash 视觉"}` }, { status: 502 });
      }
      if (parsed.length === 0) {
        return NextResponse.json({ error: "截图里没认出菜品，确认这是菜单页且文字清晰" }, { status: 422 });
      }
      // 第二步：把「菜名+价格」交给文本模型补全分类/口味/忌口标签
      const listText = `${merchant ? `商家/窗口：${merchant}\n` : ""}识别出的菜品及价格：\n${parsed
        .map((d) => `${d.name}${d.price != null ? `（¥${d.price}）` : ""}`)
        .join("、")}`;
      sourceText = sourceText ? `${sourceText}\n${listText}` : listText;
    }

    const prompt = buildImportTakeoutPrompt({
      text: sourceText,
      flavorTagLabels: FLAVOR_TAGS.map((t) => t.label),
      avoidTagLabels: AVOID_TAGS.map((t) => t.label),
    });

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
        restaurant: String(d.restaurant || merchant || "学校食堂"),
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
