"use client";

import { useEffect, useState } from "react";
import { TagChips } from "./components/TagChips";
import { SettingsDialog } from "./components/SettingsDialog";
import { RecommendCard } from "./components/RecommendCard";
import { SaveMealDialog } from "./components/SaveMealDialog";
import { TakeoutCard } from "./components/TakeoutCard";
import { apiKeyHeaders } from "./lib/apiKeys";
import { getDisabledTags } from "./lib/mutualExclusion";
import { AVOID_TAGS, FLAVOR_TAGS, METHOD_TAGS, PORTION_PRESETS, type PortionPresetKey } from "./lib/tags";
import { addCommonIngredient, addMealRecord, loadCommonIngredients, loadMealRecords, loadTakeoutDishes, loadUserProfile, loadWeeklyInsight } from "./lib/storage";
import { todayISO, weekStartOf } from "./lib/date";
import type { CommonIngredient, Dish, TakeoutDish } from "./lib/types";

type RecommendResult = { title: string; dishes: Dish[]; shoppingList: string[]; aiMessage: string };
type TakeoutPick = TakeoutDish & { reason: string; pairTip?: string };

export default function Home() {
  const [channel, setChannel] = useState<"自己做" | "外卖">("自己做");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 食材
  const [commonIngredients, setCommonIngredients] = useState<CommonIngredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [onlyPantry, setOnlyPantry] = useState(false);

  // 口味/忌口/做法/份量/目标
  const [flavorTags, setFlavorTags] = useState<string[]>([]);
  const [avoidTags, setAvoidTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [methodTags, setMethodTags] = useState<string[]>([]);
  const [portionPreset, setPortionPreset] = useState<PortionPresetKey>("家常-2菜1汤");
  const [dishCount, setDishCount] = useState(2);
  const [wantDessert, setWantDessert] = useState(false);
  const [goal, setGoal] = useState("");

  // 结果
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [takeoutPicks, setTakeoutPicks] = useState<TakeoutPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<TakeoutPick | null>(null);

  useEffect(() => {
    setCommonIngredients(loadCommonIngredients());
  }, []);

  const disabledFlavor = getDisabledTags([...flavorTags, ...avoidTags]);
  const disabledAvoid = getDisabledTags([...flavorTags, ...avoidTags]);

  function toggleSelected(setFn: (v: string[]) => void, current: string[], label: string) {
    setFn(current.includes(label) ? current.filter((t) => t !== label) : [...current, label]);
  }

  function toggleIngredient(label: string) {
    setSelectedIngredients((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  }

  function handleAddIngredient() {
    const label = newIngredient.trim();
    if (!label) return;
    addCommonIngredient(label);
    setCommonIngredients(loadCommonIngredients());
    setSelectedIngredients((prev) => [...prev, label]);
    setNewIngredient("");
  }

  async function generate(feedback?: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiKeyHeaders() },
        body: JSON.stringify({
          ingredients: selectedIngredients,
          onlyPantry,
          flavorTags,
          avoidTags,
          note,
          methodTags,
          portionPreset,
          dishCount: portionPreset === "自定义" ? dishCount : undefined,
          wantDessert,
          goal,
          feedback,
          userProfile: loadUserProfile()?.content,
          recentMeals: loadMealRecords().slice(0, 10).map((m) => ({
            date: m.date,
            time: m.time,
            channel: m.channel,
            dishes: m.dishes.map((d) => ({ name: d.name, ingredients: d.ingredients.map((i) => i.label) })),
          })),
          weeklyInsight: loadWeeklyInsight(weekStartOf(todayISO()))?.reply,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "生成失败");
      setResult(data);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function generateTakeout() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/takeout-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiKeyHeaders() },
        body: JSON.stringify({
          flavorTags, avoidTags, note, goal,
          takeoutDb: loadTakeoutDishes(),
          userProfile: loadUserProfile()?.content,
          recentMeals: loadMealRecords().slice(0, 10).map((m) => ({
            date: m.date,
            time: m.time,
            channel: m.channel,
            dishes: m.dishes.map((d) => ({ name: d.name, ingredients: d.ingredients.map((i) => i.label) })),
          })),
          weeklyInsight: loadWeeklyInsight(weekStartOf(todayISO()))?.reply,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "生成失败");
      setTakeoutPicks(data.picks || []);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function openSaveDialog(takeout?: TakeoutPick) {
    setSaveTarget(takeout ?? null);
    setSaveDialogOpen(true);
  }

  function confirmSave(date: string, time: string) {
    if (saveTarget) {
      addMealRecord({
        date,
        time,
        title: saveTarget.name,
        dishes: [
          {
            name: saveTarget.name,
            role: "主菜",
            ingredients: [],
            flavorTags: saveTarget.flavorTags,
          },
        ],
        channel: "外卖",
        avoidTags,
        methodTags: [],
        goal,
        aiMessage: saveTarget.reason,
        source: "ai",
      });
    } else if (result) {
      addMealRecord({
        date,
        time,
        title: result.title,
        dishes: result.dishes,
        channel: "自己做",
        avoidTags,
        methodTags,
        portionPreset,
        dishCount: portionPreset === "自定义" ? dishCount : undefined,
        onlyPantry,
        shoppingList: result.shoppingList,
        goal,
        aiMessage: result.aiMessage,
        source: "ai",
      });
    }
    setSaveDialogOpen(false);
    setResult(null);
    setTakeoutPicks([]);
  }

  return (
    <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--heal-bg)" }}>
      <div className="mx-auto max-w-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-medium" style={{ fontFamily: "var(--font-serif, serif)" }}>
            🥗 今天吃什么呀
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="设置"
              className="heal-btn heal-btn-ghost flex h-9 w-9 items-center justify-center text-base"
            >
              ⚙️
            </button>
            <a href="/weekly" className="heal-btn heal-btn-feature flex items-center gap-1.5 px-4 py-2.5 text-sm">
              📅 本周回顾
            </a>
          </div>
        </header>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setChannel("自己做")}
            className={`heal-btn flex-1 px-3 py-2.5 text-sm ${channel === "自己做" ? "heal-btn-feature" : "heal-btn-ghost"}`}
          >
            🍳 自己做
          </button>
          <button
            type="button"
            onClick={() => setChannel("外卖")}
            className={`heal-btn flex-1 px-3 py-2.5 text-sm ${channel === "外卖" ? "heal-btn-primary" : "heal-btn-ghost"}`}
          >
            🛵 点外卖
          </button>
        </div>

        {channel === "自己做" && (
          <div className="heal-card mb-4 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">🧺 常用食材</span>
              <div className="flex gap-1">
                <input
                  className="rounded-full border px-2 py-1 text-xs"
                  placeholder="新食材"
                  value={newIngredient}
                  onChange={(e) => setNewIngredient(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddIngredient()}
                  style={{ borderColor: "var(--heal-card-border)" }}
                />
                <button type="button" onClick={handleAddIngredient} className="heal-btn heal-btn-ghost px-2 py-1 text-xs">
                  + 添加
                </button>
              </div>
            </div>
            <TagChips
              options={commonIngredients.map((i) => i.label)}
              selected={selectedIngredients}
              onToggle={(l) => toggleIngredient(l)}
            />
            <label className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--heal-muted)" }}>
              <input type="checkbox" checked={onlyPantry} onChange={(e) => setOnlyPantry(e.target.checked)} />
              仅使用已有食材（不勾选则 AI 可建议新食材并生成购物清单）
            </label>
          </div>
        )}

        <div className="heal-card mb-4 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium">😋 口味偏好</span>
            <TagChips
              options={FLAVOR_TAGS.map((t) => t.label)}
              selected={flavorTags}
              disabled={disabledFlavor}
              onToggle={(l) => toggleSelected(setFlavorTags, flavorTags, l)}
            />
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium">🚫 忌口/备注</span>
            <TagChips
              options={AVOID_TAGS.map((t) => t.label)}
              selected={avoidTags}
              disabled={disabledAvoid}
              onToggle={(l) => toggleSelected(setAvoidTags, avoidTags, l)}
            />
            <input
              className="mt-2 w-full rounded-full border px-3 py-1.5 text-xs"
              placeholder="一句话备注，如对海鲜过敏"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ borderColor: "var(--heal-card-border)" }}
            />
          </div>
        </div>

        {channel === "自己做" && (
          <>
            <div className="heal-card mb-4 p-4">
              <span className="mb-2 block text-sm font-medium">🍳 做法</span>
              <TagChips options={METHOD_TAGS.map((t) => t.label)} selected={methodTags} onToggle={(l) => toggleSelected(setMethodTags, methodTags, l)} />
            </div>

            <div className="heal-card mb-4 p-4">
              <span className="mb-2 block text-sm font-medium">🍽️ 这顿想吃几道菜？</span>
              <div className="flex flex-wrap items-center gap-2">
                {PORTION_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPortionPreset(p.key)}
                    className={`heal-btn px-3 py-1.5 text-xs ${portionPreset === p.key ? "heal-btn-feature" : "heal-btn-ghost"}`}
                  >
                    {p.label}
                  </button>
                ))}
                {portionPreset === "自定义" && (
                  <div className="flex items-center gap-1 text-sm">
                    <button type="button" onClick={() => setDishCount((n) => Math.max(1, n - 1))} className="heal-btn heal-btn-ghost px-2 py-1">
                      -
                    </button>
                    <span className="w-5 text-center">{dishCount}</span>
                    <button type="button" onClick={() => setDishCount((n) => Math.min(6, n + 1))} className="heal-btn heal-btn-ghost px-2 py-1">
                      +
                    </button>
                  </div>
                )}
                <label className="ml-auto flex items-center gap-1 text-xs" style={{ color: "var(--heal-muted)" }}>
                  <input type="checkbox" checked={wantDessert} onChange={(e) => setWantDessert(e.target.checked)} />+ 加甜品
                </label>
              </div>
            </div>
          </>
        )}

        <div className="heal-card mb-4 p-4">
          <span className="mb-2 block text-sm font-medium">🎯 最近想达成什么饮食目标？</span>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-full border px-3 py-2 text-sm"
              placeholder={channel === "自己做" ? "想增肌，多吃点蛋白质" : "想吃点清淡的，最近有点上火"}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              style={{ borderColor: "var(--heal-card-border)" }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => (channel === "自己做" ? generate() : generateTakeout())}
              className="heal-btn heal-btn-primary whitespace-nowrap px-4 py-2 text-sm"
            >
              {loading ? "生成中…" : channel === "自己做" ? "✨ 生成推荐" : "✨ 帮我选外卖"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>

        {channel === "自己做" && result && (
          <RecommendCard
            result={result}
            loading={loading}
            onAccept={() => openSaveDialog()}
            onRegenerate={() => generate()}
            onFeedback={(text) => generate(text)}
          />
        )}

        {channel === "外卖" && takeoutPicks.length > 0 && (
          <div className="flex flex-col gap-3">
            {takeoutPicks.map((p) => (
              <TakeoutCard key={p.id} pick={p} onAccept={() => openSaveDialog(p)} />
            ))}
          </div>
        )}
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SaveMealDialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} onConfirm={confirmSave} />
    </main>
  );
}
