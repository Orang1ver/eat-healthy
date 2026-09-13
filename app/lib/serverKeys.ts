/** 请求头（用户在 Settings 里配置的 key）优先于服务端 .env 的 DEEPSEEK_API_KEY */
export function getDeepSeekKey(req: Request): string | undefined {
  return req.headers.get("x-deepseek-key") || process.env.DEEPSEEK_API_KEY || undefined;
}

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_MODEL = "deepseek-chat";

/**
 * 视觉模型（识别菜单截图用）：V4.1 Flash 起原生支持图片输入，
 * 与文本模型同 key、同 base_url，只是 model 不同。
 */
export const DEEPSEEK_VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL || "deepseek-flash";
