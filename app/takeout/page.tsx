"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TagChips } from "../components/TagChips";
import { apiKeyHeaders } from "../lib/apiKeys";
import { FLAVOR_TAGS, AVOID_TAGS } from "../lib/tags";
import { loadTakeoutDishes, addTakeoutDishes, removeTakeoutDish, resetTakeoutDishes } from "../lib/storage";
import type { TakeoutDish } from "../lib/types";

export default function TakeoutLibraryPage() {
  const [dishes, setDishes] = useState<TakeoutDish[]>([]);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");

  // 手动添加表单
  const [mRestaurant, setMRestaurant] = useState("");
  const [mName, setMName] = useState("");
  const [mCategory, setMCategory] = useState("");
  const [mPrice, setMPrice] = useState("");
  const [mFlavors, setMFlavors] = useState<string[]>([]);
  const [mAvoids, setMAvoids] = useState<string[]>([]);

  useEffect(() => {
    setDishes(loadTakeoutDishes());
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, TakeoutDish[]>();
    for (const d of dishes) {
      const arr = map.get(d.restaurant) || [];
      arr.push(d);
      map.set(d.restaurant, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dishes]);

  async function importFromText() {
    if (!importText.trim()) return;
    setImporting(true);
    setImportMsg("");
    setImportErr("");
    try {
      const res = await fetch("/api/import-takeout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiKeyHeaders() },
        body: JSON.stringify({ text: importText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "导入失败");
      const { added, list } = addTakeoutDishes(data.dishes);
      setDishes(list);
      setImportMsg(`识别出 ${data.dishes.length} 道菜，新加入 ${added} 道${data.dishes.length - added > 0 ? `（${data.dishes.length - added} 道已存在）` : ""} ✅`);
      setImportText("");
    } catch (e: any) {
      setImportErr(e.message || String(e));
    } finally {
      setImporting(false);
    }
  }

  function addManual() {
    if (!mName.trim()) return;
    const { list, added } = addTakeoutDishes([
      {
        restaurant: mRestaurant.trim() || "学校食堂",
        name: mName.trim(),
        category: mCategory.trim() || "其他",
        priceRange: mPrice.trim() || undefined,
        flavorTags: mFlavors,
        avoidConflicts: mAvoids,
      },
    ]);
    setDishes(list);
    if (!added) setImportMsg("这个菜已经在库里啦");
    else setImportMsg(`已添加「${mName.trim()}」✅`);
    setMName("");
    setMPrice("");
    setMFlavors([]);
    setMAvoids([]);
  }

  function handleRemove(id: string) {
    removeTakeoutDish(id);
    setDishes(loadTakeoutDishes());
  }

  function handleReset() {
    if (!confirm("确定要清空现在的菜单库、恢复成示例库吗？你导入的食堂/外卖会被清掉。")) return;
    resetTakeoutDishes();
    setDishes(loadTakeoutDishes());
    setImportMsg("已恢复示例库");
  }

  return (
    <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--heal-bg)" }}>
      <div className="mx-auto max-w-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-medium" style={{ fontFamily: "var(--font-serif, serif)" }}>
            🍱 我的食堂/外卖库
          </h1>
          <Link href="/" className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs">
            ← 返回首页
          </Link>
        </header>

        <p className="mb-4 text-xs leading-6" style={{ color: "var(--heal-muted)" }}>
          把你们学校食堂窗口和常点外卖告诉 AI，之后「点外卖」推荐就只会从这里面挑。共 <b>{dishes.length}</b> 道菜、{grouped.length} 个商家/窗口。
        </p>

        {/* 智能导入 */}
        <div className="heal-card mb-4 p-4">
          <span className="mb-2 block text-sm font-medium">✨ 说一段话，AI 帮你建菜单</span>
          <textarea
            className="mb-2 w-full rounded-2xl border p-3 text-sm leading-6"
            rows={4}
            placeholder={"想到什么写什么，比如：\n一食堂二楼有麻辣香锅、黄焖鸡米饭、重庆小面，都是十几块；\n一食堂三楼轻食窗口有鸡胸肉沙拉和杂粮饭；\n外卖常点华莱士和 McCarthy·麦香基，晚上还有烧烤摊。"}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            style={{ borderColor: "var(--heal-card-border)" }}
          />
          <button type="button" disabled={importing || !importText.trim()} onClick={importFromText} className="heal-btn heal-btn-primary w-full px-4 py-2.5 text-sm">
            {importing ? "AI 整理中…" : "✨ 让 AI 整理进菜单库"}
          </button>
          {importMsg && <p className="mt-2 text-xs" style={{ color: "var(--heal-blue-text)" }}>{importMsg}</p>}
          {importErr && <p className="mt-2 text-xs text-rose-600">{importErr}</p>}
        </div>

        {/* 手动添加 */}
        <div className="heal-card mb-4 p-4">
          <span className="mb-2 block text-sm font-medium">✍️ 手动加一道菜</span>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input className="rounded-xl border p-2 text-sm" placeholder="商家/窗口（可留空）" value={mRestaurant} onChange={(e) => setMRestaurant(e.target.value)} style={{ borderColor: "var(--heal-card-border)" }} />
            <input className="rounded-xl border p-2 text-sm" placeholder="菜名（必填）" value={mName} onChange={(e) => setMName(e.target.value)} style={{ borderColor: "var(--heal-card-border)" }} />
            <input className="rounded-xl border p-2 text-sm" placeholder="类别，如 盖浇饭" value={mCategory} onChange={(e) => setMCategory(e.target.value)} style={{ borderColor: "var(--heal-card-border)" }} />
            <input className="rounded-xl border p-2 text-sm" placeholder="价格区间，如 ¥12-15" value={mPrice} onChange={(e) => setMPrice(e.target.value)} style={{ borderColor: "var(--heal-card-border)" }} />
          </div>
          <span className="mb-1 block text-xs">口味标签</span>
          <TagChips options={FLAVOR_TAGS.map((t) => t.label)} selected={mFlavors} onToggle={(l) => setMFlavors((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]))} />
          <span className="mb-1 mt-2 block text-xs">天然忌口冲突（如麻辣香锅 → 不吃辣）</span>
          <TagChips options={AVOID_TAGS.map((t) => t.label)} selected={mAvoids} onToggle={(l) => setMAvoids((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]))} />
          <button type="button" disabled={!mName.trim()} onClick={addManual} className="heal-btn heal-btn-feature mt-3 w-full px-4 py-2 text-sm">
            + 加入菜单库
          </button>
        </div>

        {/* 菜单列表 */}
        <div className="heal-card mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">📋 当前菜单库</span>
            <button type="button" onClick={handleReset} className="heal-btn heal-btn-ghost px-2 py-1 text-[11px]">
              恢复示例库
            </button>
          </div>
          {dishes.length === 0 && (
            <p className="py-4 text-center text-xs" style={{ color: "var(--heal-muted)" }}>
              还是空的，先用上面的方式加点菜吧
            </p>
          )}
          <div className="flex flex-col gap-3">
            {grouped.map(([restaurant, items]) => (
              <div key={restaurant}>
                <div className="mb-1 text-xs font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                  🏠 {restaurant}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((d) => (
                    <span key={d.id} className="heal-pill flex items-center gap-1 text-xs">
                      {d.name}
                      {d.priceRange ? <span style={{ color: "var(--heal-muted)" }}>{d.priceRange}</span> : null}
                      <button type="button" onClick={() => handleRemove(d.id)} aria-label={`删除${d.name}`} className="ml-0.5 opacity-50 hover:opacity-100">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
