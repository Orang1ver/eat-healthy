import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * 纯前端版本：所有数据存在浏览器 localStorage，AI 由浏览器直连 DeepSeek。
 * 因此可以完整静态导出（out/），直接丢到任意静态托管 / 手机上访问，无需服务器。
 *
 * 部署到子路径时（如 GitHub Pages 的 /repo-name/）设置环境变量 BASE_PATH。
 */
const basePath = process.env.BASE_PATH || "";

/**
 * 版本号的单一事实来源是 package.json 的 `version`。
 * 递增规则：新功能 minor、修 bug patch、不兼容改动 major。
 * 这里只读取，不再自己生成——避免出现"两个互不相干的版本号"。
 */
const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string };
const appVersion = pkg.version;

/** 构建时间：只说明"这个包是什么时候构建的"，不冒充版本号 */
const buildTime = new Date().toISOString().slice(0, 16).replace("T", " ");

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // 客户端也要知道子路径、App 版本、构建时间
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  // 静态导出下没有服务端，未优化的图片组件需要显式关闭
  images: { unoptimized: true },
  // 导出为 /path/index.html，静态托管能直接命中
  trailingSlash: true,
};

export default nextConfig;
