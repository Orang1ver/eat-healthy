"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TagChips } from "../components/TagChips";
import { EditDishDialog } from "../components/EditDishDialog";
import { importTakeout } from "../lib/ai";
import { FLAVOR_TAGS, AVOID_TAGS } from "../lib/tags";
import { loadTakeoutDishes, addTakeoutDishes, resetTakeoutDishes, importTakeoutDishes, removeTakeoutMerchant, renameTakeoutMerchant, clearTakeoutDishes, pushTakeoutUndo, peekTakeoutUndo, popTakeoutUndo, type TakeoutUndo } from "../lib/storage";
import { fileToDataUrls, MAX_SLICES } from "../lib/image";
import type { TakeoutDish } from "../lib/types";

/** 一次最多接受多少「段」图片。长图会切成多段（普通手机截图也常被切成 2 段），
 *  所以比张数宽松；张数较多时接口的单边限制会降到 4096，而我们的段单边约 1600，安全。 */
const MAX_SHOTS = 24;

export default function TakeoutLibraryPage() {
  const [dishes, setDishes] = useState<TakeoutDish[]>([]);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");

  // 截图导入
  const [shots, setShots] = useState<string[]>([]);
  const [shotMerchant, setShotMerchant] = useState("");

  // 手动添加表单
  const [mRestaurant, setMRestaurant] = useState("");
  const [mName, setMName] = useState("");
  const [mCategory, setMCategory] = useState("");
  const [mPrice, setMPrice] = useState("");
  const [mFlavors, setMFlavors] = useState<string[]>([]);
  const [mAvoids, setMAvoids] = useState<string[]>([]);

  // 编辑菜品
  const [editing, setEditing] = useState<TakeoutDish | null>(null);

  // 导入策略
  const [overwriteSameName, setOverwriteSameName] = useState(true);
  const [clearBeforeImport, setClearBeforeImport] = useState(false);

  // 菜单库操作的反馈与撤销（渲染在列表区，与截图导入区的 importMsg 分开）
  const [libMsg, setLibMsg] = useState("");
  const [undo, setUndo] = useState<TakeoutUndo | null>(null);
  /** 正在改名的商家（就地变输入框，避免用 window.prompt —— iOS 主屏 App 上不可靠） */
  const [renaming, setRenaming] = useState<{ from: string; value: string } | null>(null);

  useEffect(() => {
    setDishes(loadTakeoutDishes());
    setUndo(peekTakeoutUndo());
  }, []);

  /**
   * 读图并按需切段。长图会被切成多段（见 lib/image.ts 的说明），
   * 返回的每个 dataURL 都作为一张独立图片发给视觉模型。
   */
  async function addShotFiles(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    setImportErr("");
    setImportMsg("");
    try {
      const parts: string[] = [];
      let sliced = 0;
      for (const f of imgs) {
        const urls = await fileToDataUrls(f);
        if (urls.length > 1) sliced += urls.length;
        parts.push(...urls);
      }
      const room = MAX_SHOTS - shots.length;
      if (room <= 0) {
        setImportErr(`一次最多 ${MAX_SHOTS} 段图片，请先移除一些再添加`);
        return;
      }
      setShots((prev) => [...prev, ...parts].slice(0, MAX_SHOTS));
      if (parts.length > room) setImportMsg(`一次最多 ${MAX_SHOTS} 段，超出部分已忽略`);
      else if (sliced >= MAX_SLICES)
        setImportMsg(`图片极长，已整体缩小并切成 ${sliced} 段（保证内容完整，清晰度略有下降）`);
      else if (sliced > 0) setImportMsg(`检测到长图，已自动切成 ${sliced} 段（会作为多张图一起识别）`);
    } catch (e: any) {
      setImportErr(e?.message || "图片读取失败，换一张试试");
    }
  }

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
    if (!importText.trim() && shots.length === 0) return;

    // 清空全库是不可逆的大动作，先二次确认（有快照可撤销，文案里说明）
    if (clearBeforeImport) {
      const ok = confirm(
        `确定要先清空整个菜单库吗？\n\n` +
          `现在库里有 ${dishes.length} 道菜、${grouped.length} 个商家/窗口，都会被清掉，只保留这次导入的内容。\n` +
          `清空后如果反悔，可以用列表区的「撤销上次操作」恢复。`,
      );
      if (!ok) return;
    }
    // 覆盖会把旧记录（含你手动改过的内容）换成新数据，同样先存快照
    if (overwriteSameName || clearBeforeImport) {
      pushTakeoutUndo(clearBeforeImport ? "清空菜单库后导入" : "覆盖导入", loadTakeoutDishes());
    }

    setImporting(true);
    setImportMsg("");
    setImportErr("");
    try {
      const rows = await importTakeout({ text: importText, images: shots, merchant: shotMerchant.trim() });
      const { added, updated, list } = importTakeoutDishes(rows, {
        overwriteSameName,
        clearFirst: clearBeforeImport,
      });
      setDishes(list);
      setUndo(peekTakeoutUndo());
      // 把识别到的店铺列出来，方便你核对归属对不对
      const shops = Array.from(new Set(rows.map((d) => d.restaurant)));
      const shopText = shops.length > 0 ? `（${shops.slice(0, 3).join("、")}${shops.length > 3 ? ` 等 ${shops.length} 家` : ""}）` : "";
      const skipped = rows.length - added - updated;
      setImportMsg(
        `识别出 ${rows.length} 道菜${shopText}：新增 ${added} 道` +
          (updated > 0 ? `、更新 ${updated} 道` : "") +
          (skipped > 0 ? `、跳过 ${skipped} 道（同名未开启覆盖）` : "") +
          " ✅",
      );
      setImportText("");
      setShots([]);
    } catch (e: any) {
      setImportErr(e.message || String(e));
    } finally {
      setImporting(false);
    }
  }

  function addManual() {
    if (!mName.trim()) return;
    const { list, added, updated } = addTakeoutDishes([
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
    if (added) setImportMsg(`已添加「${mName.trim()}」✅`);
    else if (updated) setImportMsg(`已用新数据更新「${mName.trim()}」✅`);
    else setImportMsg("这个菜已经在库里啦（同名数据没变）");
    setMName("");
    setMPrice("");
    setMFlavors([]);
    setMAvoids([]);
  }

  /** 编辑弹窗保存/删除后刷新列表（顺带同步撤销槽位） */
  function refreshDishes() {
    setDishes(loadTakeoutDishes());
    setUndo(peekTakeoutUndo());
  }

  /** 删除整个商家（连同它的所有菜品），删前存快照以便撤销 */
  function handleRemoveMerchant(restaurant: string, count: number) {
    if (!confirm(`删掉「${restaurant}」的 ${count} 道菜？\n\n可以点列表区的「撤销上次操作」恢复。`)) return;
    pushTakeoutUndo(`删除了「${restaurant}」的 ${count} 道菜`, loadTakeoutDishes());
    setDishes(removeTakeoutMerchant(restaurant));
    setUndo(peekTakeoutUndo());
    setLibMsg(`已删除商家「${restaurant}」（${count} 道菜）`);
  }

  /** 给整个商家改名（名下菜品一起换名）；目标店名已存在时会合并 */
  function handleRenameMerchant(from: string, value: string) {
    const target = value.trim();
    if (!target || target === from) {
      setRenaming(null);
      return;
    }
    // 改名 + 去重会动多条记录，先存快照
    pushTakeoutUndo(`把「${from}」改名为「${target}」`, loadTakeoutDishes());
    const { list, renamed, merged } = renameTakeoutMerchant(from, target);
    setDishes(list);
    setUndo(peekTakeoutUndo());
    setRenaming(null);
    setLibMsg(
      `已把「${from}」改名为「${target}」（${renamed} 道菜）` +
        (merged > 0 ? `；有 ${merged} 道与「${target}」原有菜品重名，已合并` : ""),
    );
  }

  /** 清空整个菜单库 */
  function handleClearLibrary() {
    if (!confirm(`清空整个菜单库？\n\n现在库里有 ${dishes.length} 道菜、${grouped.length} 个商家/窗口。\n可以点「撤销上次操作」恢复。`)) return;
    pushTakeoutUndo(`清空了菜单库（${dishes.length} 道菜）`, loadTakeoutDishes());
    setDishes(clearTakeoutDishes());
    setUndo(peekTakeoutUndo());
    setLibMsg("菜单库已清空");
  }

  /** 撤销上一次破坏性操作 */
  function handleUndo() {
    const restored = popTakeoutUndo();
    if (!restored) {
      setUndo(null);
      setLibMsg("没有可撤销的操作");
      return;
    }
    setDishes(restored);
    setUndo(null);
    setLibMsg(`已撤销：${undo?.reason ?? "上一次操作"}`);
  }

  function handleReset() {
    if (!confirm("确定要清空现在的菜单库、恢复成示例库吗？你导入的食堂/外卖会被清掉。\n\n可以点「撤销上次操作」恢复。")) return;
    pushTakeoutUndo("恢复示例库", loadTakeoutDishes());
    resetTakeoutDishes();
    setDishes(loadTakeoutDishes());
    setUndo(peekTakeoutUndo());
    setLibMsg("已恢复示例库");
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

        {/* 智能导入：截图优先，文字补充 */}
        <div
          className="heal-card mb-4 p-4"
          onPaste={(e) => {
            const files = Array.from(e.clipboardData?.files || []);
            if (files.length) {
              e.preventDefault();
              addShotFiles(files);
            }
          }}
        >
          <span className="mb-2 block text-sm font-medium">📸 截图导入（推荐）</span>
          <p className="mb-2 text-xs leading-6" style={{ color: "var(--heal-muted)" }}>
            在美团/饿了么/淘宝闪购等 App 里打开食堂或商家的菜单页截图，直接 <b>Ctrl+V 粘贴</b>到本页，AI 会自动读出<b>店铺名</b>、菜名和价格。
            一次可以粘多张，不同店铺的截图会自动分开归属。
          </p>
          <input
            className="mb-2 w-full rounded-xl border p-2 text-sm"
            placeholder="商家/窗口名（可不填，AI 会自己从截图里读；填了则以你为准）"
            value={shotMerchant}
            onChange={(e) => setShotMerchant(e.target.value)}
            style={{ borderColor: "var(--heal-card-border)" }}
          />
          <label className="mb-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed py-5 text-center text-xs"
            style={{ borderColor: "var(--heal-card-border)", color: "var(--heal-muted)" }}
          >
            <span className="text-2xl">🖼️</span>
            点击选择截图（手机上会调起相册），最多 5 张
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addShotFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {shots.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {shots.map((s, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s} alt={`截图${i + 1}`} className="h-20 w-20 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => setShots((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="移除截图"
                    className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-white text-xs shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            className="mb-2 w-full rounded-2xl border p-3 text-sm leading-6"
            rows={3}
            placeholder={"（可选）再用文字补充几句，比如：\n一食堂二楼还有麻辣香锅和重庆小面，都十几块；烧烤摊晚上才开门。"}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            style={{ borderColor: "var(--heal-card-border)" }}
          />
          <div className="mb-3 flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={overwriteSameName} onChange={(e) => setOverwriteSameName(e.target.checked)} />
              同名菜品用新数据覆盖（价格变了就会更新）
            </label>
            <label className="flex items-center gap-2 text-xs" style={{ color: clearBeforeImport ? "var(--heal-danger)" : undefined }}>
              <input type="checkbox" checked={clearBeforeImport} onChange={(e) => setClearBeforeImport(e.target.checked)} />
              先清空整个菜单库再导入（只留这次导入的内容）
            </label>
          </div>
          <button
            type="button"
            disabled={importing || (!importText.trim() && shots.length === 0)}
            onClick={importFromText}
            className="heal-btn heal-btn-primary w-full px-4 py-2.5 text-sm"
          >
            {importing ? (shots.length > 0 ? "AI 看图整理中，约十几秒…" : "AI 整理中…") : "✨ 让 AI 整理进菜单库"}
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
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">📋 当前菜单库</span>
            <div className="flex items-center gap-1">
              {dishes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLibrary}
                  className="heal-btn heal-btn-ghost px-2 py-1 text-[12px]"
                  style={{ color: "var(--heal-danger)" }}
                >
                  🗑️ 清空
                </button>
              )}
              <button type="button" onClick={handleReset} className="heal-btn heal-btn-ghost px-2 py-1 text-[12px]">
                恢复示例库
              </button>
            </div>
          </div>

          {/* 撤销条：有快照时出现，只能撤销一次 */}
          {undo && (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-xl p-2"
              style={{ background: "var(--heal-amber-50)" }}
            >
              <span className="text-[12px] leading-5" style={{ color: "var(--heal-amber-text)" }}>
                ↩︎ 可撤销：{undo.reason}
              </span>
              <button type="button" onClick={handleUndo} className="heal-btn heal-btn-ghost shrink-0 px-2 py-1 text-[12px]">
                撤销
              </button>
            </div>
          )}

          {libMsg && (
            <p className="mb-2 text-[12px] leading-5" style={{ color: "var(--heal-blue-text)" }}>
              {libMsg}
            </p>
          )}

          {dishes.length === 0 && (
            <p className="py-4 text-center text-xs" style={{ color: "var(--heal-muted)" }}>
              还是空的，先用上面的方式加点菜吧
            </p>
          )}
          <div className="flex flex-col gap-3">
            {grouped.map(([restaurant, items]) => (
              <div key={restaurant}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  {renaming?.from === restaurant ? (
                    /* 就地改名：避免用 window.prompt（iOS 主屏 App 上不可靠） */
                    <>
                      <input
                        autoFocus
                        aria-label="商家名称"
                        className="min-w-0 flex-1 rounded-full border px-2 py-1.5 text-xs"
                        value={renaming.value}
                        onChange={(e) => setRenaming({ from: restaurant, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameMerchant(restaurant, renaming.value);
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        style={{ borderColor: "var(--heal-card-border)" }}
                      />
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => handleRenameMerchant(restaurant, renaming.value)}
                          className="heal-btn heal-btn-primary px-2 py-1.5 text-[11px]"
                        >
                          保存
                        </button>
                        <button type="button" onClick={() => setRenaming(null)} className="heal-btn heal-btn-ghost px-2 py-1.5 text-[11px]">
                          取消
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                        🏠 {restaurant}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRenaming({ from: restaurant, value: restaurant })}
                          className="heal-btn heal-btn-ghost px-2 py-1.5 text-[11px]"
                          title={`给「${restaurant}」改名（名下菜品一起改）`}
                        >
                          ✏️ 改名
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMerchant(restaurant, items.length)}
                          className="heal-btn heal-btn-ghost px-2 py-1.5 text-[11px]"
                          style={{ color: "var(--heal-danger)" }}
                          title={`删除「${restaurant}」的全部菜品`}
                        >
                          🗑️ 删除这家（{items.length} 道）
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setEditing(d)}
                      title="点击修改"
                      className="heal-pill flex items-center gap-1 text-xs transition-transform active:scale-95"
                    >
                      {d.name}
                      {d.priceRange ? <span style={{ color: "var(--heal-muted)" }}>{d.priceRange}</span> : null}
                      <span className="ml-0.5 opacity-40">✏️</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px]" style={{ color: "var(--heal-muted)" }}>
            点任意菜品可以修改；点商家右侧可整家删除。删错了用上面的「撤销」挽回。
          </p>
        </div>
      </div>

      <EditDishDialog dish={editing} onClose={() => setEditing(null)} onSaved={refreshDishes} />
    </main>
  );
}
