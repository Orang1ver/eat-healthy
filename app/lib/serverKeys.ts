/** 请求头（用户在 Settings 里配置的 key）优先于服务端 .env 的 DEEPSEEK_API_KEY */
export function getDeepSeekKey(req: Request): string | undefined {
  return req.headers.get("x-deepseek-key") || process.env.DEEPSEEK_API_KEY || undefined;
}

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_MODEL = "deepseek-chat";
