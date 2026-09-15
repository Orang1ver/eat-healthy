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
import { addCommonIngredient, addMealRecord, loadCheckin, loadCommonIngredients, loadHealthProfile, loadMealRecords, loadTakeoutDishes, loadUserProfile, loadWeeklyInsight, loadWeights } from "./lib/storage";
import { buildHealthContext, calcDailyTargets } from "./lib/health";
import { loadRewards } from "./lib/storage";
import { calcCurrentStreak, calcMaxStreak } from "./lib/rewards";
import { cupsRemaining, progressOf, stepsToKm } from "./lib/steps";
import { loadPrefs } from "./lib/prefs";
import { deltaColor, deltaText, deltaVsPrevious, latestWeight } from "./lib/weight";
import { todayISO, weekStartOf } from "./lib/date";
import type { CommonIngredient, Dish, TakeoutDish } from "./lib/types";

type RecommendResult = { title: string; dishes: Dish[]; shoppingList: string[]; aiMessage: string };
type TakeoutPick = TakeoutDish & { reason: string; pairTip?: string };

/**
 * 首页健康仪表盘的数据形状（有健康档案时才有）。
 *
 * 进度（pct/done/remaining）在读取时就算好放进 state：这里是 mount 时的一次性快照，
 * 放进 state 可以让 JSX 里不必再处理"可能为 null"的中间值。
 */
type HomeHealth = {
  water: number;
  waterTarget: number;
  waterPct: number;
  waterDone: boolean;
  waterRemaining: number;
  steps: number;
  stepsTarget: number;
  stepsPct: number;
  stepsDone: boolean;
  stepsRemaining: number;
  /** 我的杯子容量：首页的"还差几杯"要和健康小屋同一个口径 */
  cupMl: number;
  /** 最新一条体重记录（还没记过体重时退回档案里的值） */
  weightKg: number | null;
  /** 与上一次体重记录的差值（正为增重） */
  weightDelta: number | null;
  weightDate: string | null;
  streak: number;
  maxStreak: number;
};

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

  // 首页健康仪表盘（有健康档案时才显示）
  const [health, setHealth] = useState<HomeHealth | null>(null);

  useEffect(() => {
    setCommonIngredients(loadCommonIngredients());
    const profile = loadHealthProfile();
    if (!profile) return;
    const t = calcDailyTargets(profile);
    const c = loadCheckin(todayISO());
    const rewards = loadRewards();
    const weights = loadWeights();
    const latest = latestWeight(weights);
    const dPrev = deltaVsPrevious(weights);
    const water = c?.waterMl ?? 0;
    const steps = c?.steps ?? 0;
    const wp = progressOf(water, t.waterTarget);
    const sp = progressOf(steps, t.stepsTarget);
    setHealth({
      water,
      waterTarget: t.waterTarget,
      waterPct: wp.pct,
      waterDone: wp.done,
      waterRemaining: wp.remaining,
      steps,
      stepsTarget: t.stepsTarget,
      stepsPct: sp.pct,
      stepsDone: sp.done,
      stepsRemaining: sp.remaining,
      cupMl: loadPrefs().cupMl,
      weightKg: latest?.weightKg ?? profile.weightKg ?? null,
      weightDelta: dPrev?.diff ?? null,
      weightDate: latest?.date ?? null,
      // 连续天数：今天已达标就从今天数，否则从昨天数（避免白天打开显示 0 天）
      streak: calcCurrentStreak(rewards.days, todayISO()),
      maxStreak: calcMaxStreak(rewards.days),
    });
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
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="设置"
              className="heal-btn heal-btn-ghost flex h-9 w-9 items-center justify-center text-base"
            >
              ⚙️
            </button>
            <Link href="/health" className="heal-btn heal-btn-feature flex items-center gap-1.5 px-4 py-2.5 text-sm">
              💪 健康小屋
            </Link>
            <Link href="/weekly" className="heal-btn heal-btn-primary flex items-center gap-1.5 px-4 py-2.5 text-sm">
              📅 本周回顾
            </Link>
          </div>
        </header>

        <IOSInstallHint />

        {/* 健康仪表盘：喝水 / 步数 / 体重 / 连续天数 —— 首页一眼看到"今天还差什么" */}
        {health ? (
          <Link href="/health" className="heal-card mb-4 block p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">💪 我的健康</span>
              <span className="flex items-center gap-2 text-[11px]" style={{ color: "var(--heal-muted)" }}>
                {health.streak > 0 && <span style={{ color: "var(--heal-amber-deep)" }}>🔥 连续 {health.streak} 天</span>}
                <span className="text-lg leading-none">›</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* 喝水 */}
              <div className="rounded-2xl p-2.5" style={{ background: "var(--heal-blue-50)" }}>
                <div className="flex items-baseline justify-between text-[11px]" style={{ color: "var(--heal-muted)" }}>
                  <span>💧 喝水</span>
                  <span>目标 {health.waterTarget}</span>
                </div>
                <div className="mt-1 text-xl font-medium" style={{ color: "var(--heal-blue-text)" }}>
                  {health.water}
                  <span className="text-[11px]"> ml</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--heal-card-bg)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${health.waterPct}%`, background: health.waterDone ? "var(--heal-blue-accent)" : "var(--heal-amber-accent)" }}
                  />
                </div>
                <div className="mt-1 text-[10px]" style={{ color: health.waterDone ? "var(--heal-blue-text)" : "var(--heal-muted)" }}>
                  {health.waterDone ? "喝够啦 🎉" : `还差 ${health.waterRemaining}ml（约 ${cupsRemaining(health.waterRemaining, health.cupMl)} 杯）`}
                </div>
              </div>

              {/* 步数 */}
              <div className="rounded-2xl p-2.5" style={{ background: "var(--heal-blue-50)" }}>
                <div className="flex items-baseline justify-between text-[11px]" style={{ color: "var(--heal-muted)" }}>
                  <span>🚶 步数</span>
                  <span>目标 {health.stepsTarget}</span>
                </div>
                <div className="mt-1 text-xl font-medium" style={{ color: "var(--heal-blue-text)" }}>
                  {health.steps}
                  <span className="text-[11px]"> 步</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--heal-card-bg)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${health.stepsPct}%`, background: health.stepsDone ? "var(--heal-blue-accent)" : "var(--heal-amber-accent)" }}
                  />
                </div>
                <div className="mt-1 text-[10px]" style={{ color: health.stepsDone ? "var(--heal-blue-text)" : "var(--heal-muted)" }}>
                  {health.stepsDone ? "走够啦 🎉" : `还差 ${health.stepsRemaining} 步（约 ${stepsToKm(health.stepsRemaining)}km）`}
                </div>
              </div>

              {/* 体重 */}
              <div className="rounded-2xl p-2.5" style={{ background: "var(--heal-amber-50)" }}>
                <div className="flex items-baseline justify-between text-[11px]" style={{ color: "var(--heal-muted)" }}>
                  <span>⚖️ 体重</span>
                  <span>{health.weightDate ? health.weightDate.slice(5) : "档案值"}</span>
                </div>
                <div className="mt-1 text-xl font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                  {health.weightKg != null ? health.weightKg.toFixed(1) : "—"}
                  <span className="text-[11px]"> kg</span>
                </div>
                <div className="mt-1 text-[10px]" style={{ color: health.weightDelta != null ? deltaColor(health.weightDelta) : "var(--heal-muted)" }}>
                  {health.weightDelta != null ? `较上次 ${deltaText(health.weightDelta)}` : "还没记过体重"}
                </div>
              </div>

              {/* 连续打卡 */}
              <div className="rounded-2xl p-2.5" style={{ background: "var(--heal-amber-50)" }}>
                <div className="flex items-baseline justify-between text-[11px]" style={{ color: "var(--heal-muted)" }}>
                  <span>🔥 连续打卡</span>
                  {health.maxStreak > 0 && <span>最长 {health.maxStreak} 天</span>}
                </div>
                <div className="mt-1 text-xl font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                  {health.streak}
                  <span className="text-[11px]"> 天</span>
                </div>
                <div className="mt-1 text-[10px]" style={{ color: "var(--heal-muted)" }}>
                  {health.waterDone && health.stepsDone ? "今天已完成 ✅" : "两项都达标才算 1 天"}
                </div>
              </div>
            </div>
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
            <p className="mt-2 text-[11px]" style={{ color: "var(--heal-muted)" }}>
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
