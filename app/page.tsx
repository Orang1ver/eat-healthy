"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TagChips } from "./components/TagChips";
import { SettingsDialog } from "./components/SettingsDialog";
import { IOSInstallHint } from "./components/IOSInstallHint";
import { RecommendCard } from "./components/RecommendCard";
import { SaveMealDialog } from "./components/SaveMealDialog";
import { ManualLogDialog } from "./components/ManualLogDialog";
import { TakeoutCard } from "./components/TakeoutCard";
import { recommend, takeoutRecommend } from "./lib/ai";
import { getDisabledTags } from "./lib/mutualExclusion";
import { AVOID_TAGS, FLAVOR_TAGS, METHOD_TAGS, PORTION_PRESETS, type PortionPresetKey } from "./lib/tags";
import { addCommonIngredient, addMealRecord, loadCheckin, loadCommonIngredients, loadHealthProfile, loadMealRecords, loadTakeoutDishes, loadUserProfile, loadWeeklyInsight } from "./lib/storage";
import { buildHealthContext, calcDailyTargets } from "./lib/health";
import { HealthDashboard } from "./components/HealthDashboard";
import { TopTabs } from "./components/TopTabs";
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
  const [manualOpen, setManualOpen] = useState(false);

  /** 有没有健康档案：没有就给一句引导，有则交给仪表盘组件（它自己读 localStorage） */
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    setCommonIngredients(loadCommonIngredients());
    setHasProfile(!!loadHealthProfile());
  }, []);

  // 把健康档案 + 今日打卡拼成上下文，随每次推荐发给 AI
  function healthContext(): string | undefined {
    const profile = loadHealthProfile();
    if (!profile) return undefined;
    return buildHealthContext(profile, loadCheckin(todayISO()), calcDailyTargets(profile));
  }

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
      const data = await recommend({
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
        healthContext: healthContext(),
        recentMeals: loadMealRecords().slice(0, 10).map((m) => ({
          date: m.date,
          time: m.time,
          channel: m.channel,
          dishes: m.dishes.map((d) => ({ name: d.name, ingredients: d.ingredients.map((i) => i.label) })),
        })),
        weeklyInsight: loadWeeklyInsight(weekStartOf(todayISO()))?.reply,
      });
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
      const picks = await takeoutRecommend({
        flavorTags,
        avoidTags,
        note,
        goal,
        takeoutDb: loadTakeoutDishes(),
        userProfile: loadUserProfile()?.content,
        healthContext: healthContext(),
        recentMeals: loadMealRecords().slice(0, 10).map((m) => ({
          date: m.date,
          time: m.time,
          channel: m.channel,
          dishes: m.dishes.map((d) => ({ name: d.name, ingredients: d.ingredients.map((i) => i.label) })),
        })),
        weeklyInsight: loadWeeklyInsight(weekStartOf(todayISO()))?.reply,
      });
      setTakeoutPicks(picks);
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
            {/* 本周回顾降级成一行小链接：它是饮食周报，不必和两个主入口抢位置 */}
            <Link href="/weekly" className="text-[12px] underline" style={{ color: "var(--heal-muted)" }}>
              📅 回顾
            </Link>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="设置"
              className="heal-btn heal-btn-ghost flex h-9 w-9 items-center justify-center text-base"
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* 两个平级入口：今天吃什么 ｜ 健康小屋 —— 健康不再是标题旁边的小按钮之一 */}
        <TopTabs active="eat" />

        <IOSInstallHint />

        {/* 健康仪表盘（紧凑版：进度环 + 体重/连续一行），整块点进健康小屋做记录 */}
        {hasProfile ? (
          <Link href="/health" className="block">
            <HealthDashboard compact />
          </Link>
        ) : (
          <Link href="/health" className="heal-card mb-4 flex items-center justify-between gap-2 p-3 text-xs" style={{ color: "var(--heal-muted)" }}>
            <span>还没填健康档案 —— 填一下就能看到每天该喝多少水、走多少步</span>
            <span className="shrink-0 text-lg">›</span>
          </Link>
        )}

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

        {channel === "外卖" && (
          <div className="heal-card mb-4 flex items-center justify-between p-4">
            <span className="text-xs leading-6" style={{ color: "var(--heal-muted)" }}>
              AI 只会从你的菜单库里挑 → 没有学校食堂的菜？去告诉它
            </span>
            <Link href="/takeout" className="heal-btn heal-btn-feature whitespace-nowrap px-3 py-2 text-xs">
              🍱 我的菜单库
            </Link>
          </div>
        )}

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
          <input
            className="mb-2 w-full rounded-full border px-3 py-2 text-sm"
            placeholder={channel === "自己做" ? "想增肌，多吃点蛋白质" : "想吃点清淡的，最近有点上火"}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={{ borderColor: "var(--heal-card-border)" }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => (channel === "自己做" ? generate() : generateTakeout())}
              className="heal-btn heal-btn-primary min-w-0 flex-1 px-4 py-2 text-sm"
            >
              {loading ? "生成中…" : channel === "自己做" ? "✨ 生成推荐" : "✨ 帮我选外卖"}
            </button>
            {channel === "自己做" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => setManualOpen(true)}
                className="heal-btn heal-btn-ghost min-w-0 flex-1 px-3 py-2 text-sm"
                title="已经吃过了？选好食材直接记下来"
              >
                📝 记一餐
              </button>
            )}
          </div>
          {channel === "自己做" && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--heal-muted)" }}>
              已经吃过了？点「记一餐」直接记下来，不用生成推荐。
            </p>
          )}
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
      <ManualLogDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        ingredients={selectedIngredients}
        flavorTags={flavorTags}
        note={note}
        goal={goal}
      />
      <SaveMealDialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} onConfirm={confirmSave} />
    </main>
  );
}
