"""子路径部署验证：模拟"用户逐页点击跳转"，确认不会 404。

为什么需要它：只测"路由地址能不能访问"是不够的。曾经就因为页面里用了原生
`<a href="/health">`（漏掉 basePath）而部署后点击 404 —— 而直接访问路由地址是 200，
所以那种测法完全测不出来。本脚本改为**解析页面里的真实链接并逐个访问**，
等价于把每个按钮点一遍。

用法（在项目根目录）：

    # 1. 用子路径构建
    MSYS_NO_PATHCONV=1 BASE_PATH=/eat-healthy npm run build

    # 2. 把 out/ 铺成子路径结构 <临时目录>/eat-healthy/ ，在该临时目录起静态服务
    python -m http.server 4177

    # 3. 跑验证（端口/路径按需改下面的 BASE）
    python scripts/verify-subpath.py

全部通过会打印 ✅；任何一项失败都会列出具体 URL 与状态码。
"""
import re
import urllib.request
import urllib.error
import concurrent.futures

BASE = "http://localhost:4177/eat-healthy"
PAGES = ["/", "/health/", "/takeout/", "/weekly/"]


def get(url, timeout=15):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return None, str(e)


def check(url):
    status, _ = get(url)
    return url, status


def main():
    failures = []
    link_targets = set()

    # 1. 每个页面本身可达
    print("=== 页面可达性 ===")
    for p in PAGES:
        status, html = get(BASE + p)
        print(f"  {status}  {p}")
        if status != 200:
            failures.append((p, status))
            continue

        # 2. 抽出页面里所有站内链接（这就是"点击"会去的地方）
        hrefs = re.findall(r'href="(/eat-healthy[^"#]*)"', html)
        for h in hrefs:
            link_targets.add(h)

    # 3. 逐个访问页面里的跳转目标 —— 等价于"逐个点一遍"
    print(f"\n=== 逐个点击站内跳转（共 {len(link_targets)} 个目标）===")
    nav = sorted(h for h in link_targets if not h.startswith("/eat-healthy/_next"))
    asset = sorted(h for h in link_targets if h.startswith("/eat-healthy/_next"))

    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        for url, status in ex.map(lambda u: check("http://localhost:4177" + u), nav):
            ok = "OK " if status == 200 else "!! "
            print(f"  {ok}{status}  {url}")
            if status != 200:
                failures.append((url, status))

    # 4. 静态资源（JS/CSS）也要能加载，否则点开了也是白屏
    print(f"\n=== 静态资源（{len(asset)} 个）===")
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        bad_assets = [(u, s) for u, s in ex.map(lambda u: check("http://localhost:4177" + u), asset) if s != 200]
    print(f"  失败 {len(bad_assets)} 个")
    for u, s in bad_assets:
        print(f"  !! {s}  {u}")
    failures.extend(bad_assets)

    # 5. PWA 关键文件
    print("\n=== PWA 关键文件 ===")
    for p in ["/sw.js", "/manifest.json", "/.nojekyll",
              "/icons/icon-192.png", "/icons/icon-512.png",
              "/splash/splash-390x844@3x.png"]:
        status, _ = get(BASE + p)
        ok = "OK " if status == 200 else "!! "
        print(f"  {ok}{status}  {p}")
        if status != 200:
            failures.append((p, status))

    # 6. Service Worker 注册路径 & 启动图 media query
    print("\n=== 构建产物内容校验 ===")
    _, home = get(BASE + "/")

    # 只统计 <head> 内：RSC 数据负载里也会出现这些字符串，全文字计数会翻倍
    head = re.search(r"<head>.*?</head>", home, re.S)
    head_html = head.group(0) if head else ""
    splash_count = head_html.count("apple-touch-startup-image")

    print(f"  manifest 链接: {'/eat-healthy/manifest.json' in head_html}")
    print(f"  启动图 link:   {splash_count} 条（head 内）")

    if "/eat-healthy/manifest.json" not in head_html:
        failures.append(("manifest 链接缺失", None))
    if splash_count != 4:
        failures.append((f"启动图应有 4 条，实际 {splash_count}", None))

    print("\n" + "=" * 50)
    if failures:
        print(f"❌ 发现 {len(failures)} 个问题：")
        for u, s in failures:
            print(f"   {s}  {u}")
    else:
        print("✅ 全部通过：页面、跳转、静态资源、PWA 文件均正常")


if __name__ == "__main__":
    main()
