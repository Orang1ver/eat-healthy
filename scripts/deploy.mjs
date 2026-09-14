#!/usr/bin/env node
/**
 * 一键发布到 GitHub Pages。
 *
 * 为什么逻辑放在 Node 而不是 .bat 里：
 * cmd 解析含 UTF-8 中文的 .bat 文件不可靠（按字节处理，多字节字符会让引号配对错乱，
 * 甚至把中文片段当成命令执行）。Node 处理 UTF-8 没有问题，所以 .bat 只做一层
 * 纯 ASCII 的壳，实际流程都在这里。
 *
 * 用法：双击 部署.bat，或 `node scripts/deploy.mjs`
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_PATH = "/eat-healthy";
const REPO = "https://github.com/Orang1ver/eat-healthy.git";

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
};

function step(msg) {
  console.log(`\n${msg}`);
}
function ok(msg) {
  console.log(`  ${c.ok("[OK]")} ${msg}`);
}
function warn(msg) {
  console.log(`  ${c.warn("[WARN]")} ${msg}`);
}
function die(msg) {
  console.error(`\n  ${c.err("[失败]")} ${msg}\n`);
  process.exit(1);
}

/**
 * 执行命令，失败即中止；stdout 直接透传给用户看。
 *
 * Windows 上 npm 是 npm.cmd：Node 从 v18.20/20.12 起出于安全考虑禁止直接 spawn
 * .cmd/.bat，会抛 EINVAL，必须走 shell。此处只在目标是 .cmd/.bat 时才启用 shell，
 * 且把命令拼成单个字符串传入（用 args 数组 + shell:true 会触发 DEP0190 警告）。
 * git 在 Windows 上是 git.exe，无需 shell。
 */
function run(cmd, args, opts = {}) {
  const needsShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
  const env = { ...process.env, ...(opts.env || {}) };
  const common = {
    cwd: opts.cwd || ROOT,
    stdio: opts.silent ? "pipe" : "inherit",
    env,
    encoding: "utf8",
  };
  try {
    if (needsShell) {
      const quote = (a) => (/[\s()&|<>^"]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : a);
      return execFileSync([cmd, ...args.map(quote)].join(" "), { ...common, shell: true });
    }
    return execFileSync(cmd, args, common);
  } catch (e) {
    if (opts.optional) return null;
    die(`命令失败：${cmd} ${args.join(" ")}`);
  }
}

// ---------- 1. 版本号（单一事实来源）----------

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const version = pkg.version;
if (!version) die("读不到 package.json 里的 version");

console.log("\n  ============================================");
console.log("   部署「今天吃什么呀」到 GitHub Pages");
console.log("  ============================================");
ok(`版本号 v${version}`);

// ---------- 2. 校验 CHANGELOG ----------

const changelogPath = join(ROOT, "CHANGELOG.md");
if (!existsSync(changelogPath)) {
  die("找不到 CHANGELOG.md");
}
if (readFileSync(changelogPath, "utf8").includes(`[${version}]`)) {
  ok(`CHANGELOG.md 已含 [${version}]`);
} else {
  warn(`CHANGELOG.md 里没有 [${version}] 条目`);
  warn("建议先在 CHANGELOG.md 顶部补一条更新日志（本次仍会继续部署）");
}

// ---------- 3. 构建 ----------

step(`[1/4] 构建静态站点（子路径 ${BASE_PATH}）...`);
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  env: { BASE_PATH },
});

// ---------- 4. 注入版本号到 Service Worker ----------

step("[2/4] 准备发布产物（注入版本号 + .nojekyll）...");
const outDir = join(ROOT, "out");
const swPath = join(outDir, "sw.js");
if (!existsSync(swPath)) die("构建产物里没有 out/sw.js");

const now = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const buildId = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}.${p2(now.getHours())}${p2(now.getMinutes())}`;

let sw = readFileSync(swPath, "utf8");
if (!sw.includes("__VERSION__") || !sw.includes("__BUILD__")) {
  die("out/sw.js 里找不到 __VERSION__ / __BUILD__ 占位符（源码里的占位符是否被改动了？）");
}
sw = sw.split("__VERSION__").join(version).split("__BUILD__").join(buildId);
writeFileSync(swPath, sw, "utf8");
if (sw.includes("__VERSION__") || sw.includes("__BUILD__")) die("占位符替换不完整");
ok(`缓存名 recipe-v${version}-${buildId}`);

// GitHub Pages 的 Jekyll 会忽略下划线开头的 _next/ 目录，必须有 .nojekyll
writeFileSync(join(outDir, ".nojekyll"), "");
ok(".nojekyll 就位");

// ---------- 5. 发布 out/ 到 gh-pages ----------

step("[3/4] 推送到 gh-pages...");
const git = (args, opts = {}) => run("git", args, opts);

if (!existsSync(join(outDir, ".git"))) {
  git(["init", "-b", "gh-pages", "-q"], { cwd: outDir });
}
git(["add", "-A"], { cwd: outDir });
git(["commit", "-q", "-m", `deploy: v${version} (${buildId})`], { cwd: outDir, optional: true });
git(["push", "--force", REPO, "gh-pages"], { cwd: outDir });
ok("已推送 gh-pages");

// ---------- 6. 打发布标记 ----------

step("[4/4] 发布标记...");
const tag = `v${version}`;
const hasTag = git(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { silent: true, optional: true });
if (hasTag) {
  ok(`tag ${tag} 已存在，跳过`);
} else {
  git(["tag", "-a", tag, "-m", `release ${tag}`]);
  ok(`已打 tag ${tag}`);
}
// 推 tag（远程可能不存在这个 remote，失败不阻塞）
for (const remote of ["origin", "mine"]) {
  run("git", ["push", remote, tag], { optional: true, silent: true });
}

// ---------- 完成 ----------

console.log(`\n  ${c.ok("✅")} 已发布 ${c.ok(`v${version}`)}（构建 ${buildId}），约 30-60 秒后生效：`);
console.log(`     https://orang1ver.github.io/eat-healthy/\n`);
console.log(c.dim("  建议再跑一次验证（Git Bash）："));
console.log(c.dim("     python scripts/verify-subpath.py\n"));
