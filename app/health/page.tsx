"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { todayISO, weekStartOf, addDays, WEEKDAY_LABELS, weekDates, BACKFILL_DAYS } from "../lib/date";
import { loadHealthProfile, loadCheckin, saveCheckin, saveHealthProfile, getCheckinsInWeek, loadRewards, saveRewards } from "../lib/storage";
import { ACTIVITY_LEVELS, HEALTH_GOALS, calcDailyTargets } from "../lib/health";
import {
  BADGES,
  EMPTY_REWARDS,
  calcCurrentStreak,
  calcMaxStreak,
  evaluateCheckin,
  nextBadge,
  recordCompletedDay,
  settleCheckin,
} from "../lib/rewards";
import { WeightCard } from "../components/WeightCard";
import { ExerciseCard } from "../components/ExerciseCard";
import { HealthDashboard } from "../components/HealthDashboard";
import { TopTabs } from "../components/TopTabs";
// 懒加载：motion + 彩带库只在庆祝弹窗打开时才下载，不拖慢健康页首屏
const RewardDialog = dynamic(() => import("../components/RewardDialog").then((m) => m.RewardDialog), {
  ssr: false,
});
import {
  CUP_MAX,
  CUP_MIN,
  CUP_PRESETS,
  CURRENT_STEP_SOURCE,
  DEFAULT_CUP_ML,
  STEP_MAX,
  STEP_PRESETS,
  STEP_SOURCE_LABEL,
  clampCupMl,
  clampSteps,
  cupsToMl,
  mlToCups,
  progressOf,
  stepsProgressText,
  stepsToKm,
  waterProgressText,
} from "../lib/steps";
import { loadPrefs, savePrefs } from "../lib/prefs";
import type { ActivityLevel, DailyCheckin, HealthGoal, HealthProfile, RewardState, Sex } from "../lib/types";

const MOODS: { key: NonNullable<DailyCheckin["mood"]>; emoji: string }[] = [
  { key: "好", emoji: "😊" },
  { key: "一般", emoji: "😐" },
  { key: "累", emoji: "😫" },
];

export default function HealthPage() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayISO()));
  const [rewards, setRewards] = useState<RewardState>(EMPTY_REWARDS);
  /**
   * 庆祝弹窗的数据。打卡与运动里程碑共用同一个弹窗，
   * 所以字段都可选：打卡传 streak/badges，运动传 badges/hero/texts。
   */
  const [celebration, setCelebration] = useState<{
    streak?: number;
    badges: { id: string; emoji: string; label: string }[];
    replay?: boolean;
    hero?: { emoji: string; value: number | string; unit: string; caption: string };
    texts?: { title?: string; subtitle?: string; praise?: string; cta?: string };
  } | null>(null);

  const today = todayISO();
  /** 正在查看/编辑的日期，默认今天；往前切即为"补录" */
  const [selectedDate, setSelectedDate] = useState(today);
  const viewingToday = selectedDate === today;
  /** 补录成功后的轻提示（不弹庆祝弹窗） */
  const [backfillMsg, setBackfillMsg] = useState("");

  /**
   * 我的杯子容量（ml）。存在独立的偏好键里、与健康档案无关 —— 没填档案时喝水卡也在用。
   * 数字输入一律用字符串 state（老坑：value={number} 会删不掉、永远留个 0）。
   */
  const [cupMl, setCupMl] = useState(DEFAULT_CUP_ML);
  const [cupDraft, setCupDraft] = useState("");
  /** 「直接加多少 ml」输入框 */
  const [customMl, setCustomMl] = useState("");

  /**
   * 顶部仪表盘的重读信号：每次写入（打卡 / 体重 / 档案）加一，仪表盘就会重新
   * 从 localStorage 现算一遍 —— 否则它显示的是 mount 时的旧快照。
   */
  const [dataVersion, setDataVersion] = useState(0);

  /** 能补录的最早日期：今天往前 30 天 */
  const earliestDate = addDays(today, -BACKFILL_DAYS);
  const canGoPrev = selectedDate > earliestDate;
  const canGoNext = selectedDate < today;

  // 档案表单。数字字段用 null 表示"已删空未填"，输入框才能清空（否则一删就变成 0）
  const [sex, setSex] = useState<Sex>("男");
  const [age, setAge] = useState<number | null>(20);
  const [heightCm, setHeightCm] = useState<number | null>(170);
  const [weightKg, setWeightKg] = useState<number | null>(60);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("轻度活动");
  const [goal, setGoal] = useState<HealthGoal>("维持健康");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const p = loadHealthProfile();
    if (p) {
      setProfile(p);
      setSex(p.sex);
      setAge(p.age);
      setHeightCm(p.heightCm);
      setWeightKg(p.weightKg);
      setActivityLevel(p.activityLevel);
      setGoal(p.goal);
      setAllergies(p.allergies);
      setConditions(p.conditions);
    }
    setRewards(loadRewards());
    const prefs = loadPrefs();
    setCupMl(prefs.cupMl);
    setCupDraft(String(prefs.cupMl));
  }, []);

  // 切换日期：载入该日数据、让本周格子跟随、清掉上一条提示
  useEffect(() => {
    setCheckin(loadCheckin(selectedDate));
    setWeekStart(weekStartOf(selectedDate));
    setBackfillMsg("");
  }, [selectedDate]);

  const targets = useMemo(() => (profile ? calcDailyTargets(profile) : null), [profile]);
  // checkin 变化时今天那一格也要立刻点亮，所以这里不做 memo，直接每次渲染重算（只有 7 天，开销可忽略）
  const weekCheckins = getCheckinsInWeek(weekStart);

  /** 今天的打卡（连续卡片始终看今天，与正在补录哪一天无关） */
  const todayCheckin = viewingToday ? checkin : loadCheckin(today);

  function handleSaveProfile() {
    if (age == null || heightCm == null || weightKg == null) {
      setFormError("年龄、身高、体重都要填上才能算出每日目标");
      return;
    }
    if (age < 10 || age > 100 || heightCm < 100 || heightCm > 250 || weightKg < 25 || weightKg > 200) {
      setFormError("请检查年龄（10-100）、身高（100-250cm）、体重（25-200kg）是否合理");
      return;
    }
    setFormError("");
    setProfile(saveHealthProfile({ sex, age, heightCm, weightKg, activityLevel, goal, allergies, conditions }));
    // 目标变了，仪表盘里的环与"还差"要按新目标重算
    setDataVersion((v) => v + 1);
  }

  /**
   * 打卡写入的唯一入口（今天与补录共用）。
   * 写入后结算奖励：该日由「未达标」变「达标」时记一次；事后减水量不收回奖励。
   * - 今天达标 → 弹庆祝（每天最多一次）
   * - 补录过去某天达标 → 只给一行轻提示（补录是事后记账，弹庆祝不合适）
   */
  function updateCheckin(patch: Parameters<typeof saveCheckin>[1]) {
    const next = saveCheckin(selectedDate, patch);
    setCheckin(next);
    // 顶部的环与趋势条要跟着动
    setDataVersion((v) => v + 1);

    const completion = evaluateCheckin(next, targets);
    if (!completion.allDone) {
      setBackfillMsg("");
      return;
    }

    if (viewingToday) {
      const settled = settleCheckin(loadRewards(), today);
      saveRewards(settled.state);
      setRewards(settled.state);
      if (settled.firstTimeToday) {
        setCelebration({ streak: settled.streak, badges: settled.newBadges });
      }
      return;
    }

    // 补录：整体重算连续值（补上中间那天可能把前后两段连起来）
    const recorded = recordCompletedDay(loadRewards(), selectedDate);
    if (!recorded.isNew) return;
    saveRewards(recorded.state);
    setRewards(recorded.state);
    setBackfillMsg(`已补录 ${selectedDate.slice(5)}，当前连续 ${calcCurrentStreak(recorded.state.days, today)} 天`);
  }

  // 连续天数：无档案不发奖励也不显示 0 天，改成引导填档案
  const currentStreak = calcCurrentStreak(rewards.days, today);
  const maxStreak = calcMaxStreak(rewards.days);
  // 连续卡片看的是"今天"是否完成，与当前正在补录哪一天无关
  const todayCompletion = evaluateCheckin(todayCheckin, targets);
  const nextB = nextBadge(rewards.badges);
  // 已拥有的徽章（回看庆祝时展示"我的徽章"）
  const ownedBadges = BADGES.filter((b) => rewards.badges[b.id]);

  /** 喝水加量：非法值直接忽略，不写库 */
  function addWater(ml: number) {
    if (!Number.isFinite(ml) || ml <= 0) return;
    updateCheckin({ waterMl: water + Math.round(ml) });
  }

  /** 自定义 ml：记完就清空，方便连着记第二笔 */
  function addCustomWater() {
    if (!customMlValid) return;
    addWater(Number(customMl));
    setCustomMl("");
  }

  /** 换杯子：写库并同步 state，换算与快捷按钮立刻跟着变 */
  function changeCup(n: number) {
    const next = savePrefs({ cupMl: clampCupMl(n) }).cupMl;
    setCupMl(next);
    setCupDraft(String(next));
  }

  /** 自定义杯容量：失焦或回车才提交；空串/非法值丢弃并还原显示，不写库 */
  function commitCupDraft() {
    const n = Number(cupDraft);
    if (cupDraft.trim() === "" || !Number.isFinite(n) || n <= 0) {
      setCupDraft(String(cupMl));
      return;
    }
    changeCup(n);
  }

  const customMlValid = customMl.trim() !== "" && Number(customMl) > 0 && Number(customMl) <= 3000;
  const water = checkin?.waterMl ?? 0;
  const steps = checkin?.steps ?? 0;
  const waterTarget = targets?.waterTarget ?? 2000;
  const stepsTarget = targets?.stepsTarget ?? 8000;
  const waterProgress = progressOf(water, waterTarget);
  const stepsProgress = progressOf(steps, stepsTarget);
  const waterPct = waterProgress.pct;
  const stepsPct = stepsProgress.pct;

  return (
    <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--heal-bg)" }}>
      <div className="mx-auto max-w-2xl">
        <header className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-medium" style={{ fontFamily: "var(--font-serif, serif)" }}>
            💪 健康小屋
          </h1>
        </header>

        {/* 与首页同一对平级入口：在健康小屋也能一键回到"今天吃什么"
            （原来这里是个「← 返回首页」小按钮，现在由 tab 承担） */}
        <TopTabs active="health" />

        {/* 仪表盘：进度环（喝水/步数）+ 最近 7 天趋势条 + 体重迷你曲线 + 连续与徽章。
            没填档案时它自己不渲染（下面的蓝色引导卡会告诉用户先填档案）。 */}
        <HealthDashboard reloadKey={dataVersion} />

        {!profile && (
          <div className="heal-card mb-4 p-4 text-sm leading-7" style={{ background: "var(--heal-blue-50)", color: "var(--heal-blue-text)" }}>
            先花一分钟填好下面的健康档案，我会帮你算出每天该吃多少热量、喝多少水、走多少步，推荐饭菜时也会参考它们 💛
          </div>
        )}

        {/* 今日打卡 / 补录 */}
        <div className="heal-card mb-4 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{viewingToday ? "🏠 今日打卡" : "📝 补录打卡"}</span>
            {/* 日期切换：往前最多 BACKFILL_DAYS 天，用于补记漏掉的日期 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="前一天"
                disabled={!canGoPrev}
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                className="heal-btn heal-btn-ghost px-2 py-0.5 text-xs"
              >
                ‹
              </button>
              <span className="min-w-[4.5rem] text-center text-xs" style={{ color: viewingToday ? "var(--heal-muted)" : "var(--heal-amber-deep)" }}>
                {viewingToday ? "今天" : selectedDate.slice(5)}
              </span>
              <button
                type="button"
                aria-label="后一天"
                disabled={!canGoNext}
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                className="heal-btn heal-btn-ghost px-2 py-0.5 text-xs"
              >
                ›
              </button>
            </div>
          </div>

          {!viewingToday && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl p-2" style={{ background: "var(--heal-amber-50)" }}>
              <span className="text-[11px] leading-5" style={{ color: "var(--heal-amber-text)" }}>
                正在补录 {selectedDate} 的数据，改完直接保存即可
              </span>
              <button type="button" onClick={() => setSelectedDate(today)} className="heal-btn heal-btn-ghost shrink-0 px-2 py-1 text-[11px]">
                回到今天
              </button>
            </div>
          )}

          {backfillMsg && (
            <p className="mb-3 text-[11px] font-medium" style={{ color: "var(--heal-blue-text)" }}>
              {backfillMsg}
            </p>
          )}

          <div className="mb-4">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span>💧 喝水</span>
              <span style={{ color: "var(--heal-muted)" }}>
                {water} / {waterTarget} ml（约 {mlToCups(water, cupMl)} 杯 · 一杯 {cupMl}ml）
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--heal-blue-50)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${waterPct}%`, background: waterPct >= 100 ? "var(--heal-blue-accent)" : "var(--heal-amber-accent)" }}
              />
            </div>
            <p className="mt-1 text-[11px] font-medium" style={{ color: waterProgress.done ? "var(--heal-blue-text)" : "var(--heal-amber-deep)" }}>
              {waterProgressText(waterProgress, cupMl)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => addWater(cupsToMl(1, cupMl))} className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs">
                +1 杯（{cupMl}ml）
              </button>
              <button type="button" onClick={() => addWater(cupsToMl(0.5, cupMl))} className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs">
                +½ 杯（{cupsToMl(0.5, cupMl)}ml）
              </button>
              <button type="button" onClick={() => addWater(500)} className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs">
                +500ml（一瓶）
              </button>
              <button type="button" onClick={() => updateCheckin({ waterMl: Math.max(0, water - cupMl) })} className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs">
                −1 杯
              </button>
            </div>

            {/* 不用「杯」算的人可以直接加 ml（加法语义，与步数那种"设总量"不同） */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={3000}
                className="w-24 rounded-full border px-3 py-1.5 text-xs"
                placeholder="＋___ ml"
                value={customMl}
                onChange={(e) => setCustomMl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomWater()}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
              <button type="button" disabled={!customMlValid} onClick={addCustomWater} className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs">
                记一笔
              </button>
            </div>

            {/* 我的杯子：一杯多少自己定，记忆在本机（改杯子不影响已记录的水量） */}
            <div className="mt-3 rounded-xl p-2" style={{ background: "var(--heal-blue-50)" }}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
                  我的杯子
                </span>
                {CUP_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => changeCup(n)}
                    className={`heal-btn px-2 py-0.5 text-[11px] ${cupMl === n ? "heal-btn-feature" : "heal-btn-ghost"}`}
                  >
                    {n}ml
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="numeric"
                  min={CUP_MIN}
                  max={CUP_MAX}
                  step={10}
                  value={cupDraft}
                  placeholder="自定义"
                  onChange={(e) => setCupDraft(e.target.value)}
                  onBlur={commitCupDraft}
                  onKeyDown={(e) => e.key === "Enter" && commitCupDraft()}
                  className="w-20 rounded-full border px-2 py-0.5 text-center text-[11px]"
                  style={{ borderColor: "var(--heal-card-border)" }}
                />
                <span className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
                  ml（100-1000）
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-4" style={{ color: "var(--heal-muted)" }}>
                换杯子只影响换算和上面的快捷按钮；已记录的水量不变（记的是 ml）
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span>🚶 步数</span>
              <span style={{ color: "var(--heal-muted)" }}>
                {steps} / {stepsTarget} 步（约 {stepsToKm(steps)}km）· {STEP_SOURCE_LABEL[CURRENT_STEP_SOURCE]}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--heal-blue-50)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${stepsPct}%`, background: stepsPct >= 100 ? "var(--heal-blue-accent)" : "var(--heal-amber-accent)" }}
              />
            </div>
            <p className="mt-1 text-[11px] font-medium" style={{ color: stepsProgress.done ? "var(--heal-blue-text)" : "var(--heal-amber-deep)" }}>
              {stepsProgressText(stepsProgress)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {STEP_PRESETS.map((n) => (
                <button key={n} type="button" onClick={() => updateCheckin({ steps: clampSteps(steps + n) })} className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs">
                  +{n}
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={STEP_MAX}
                className="w-24 rounded-full border px-3 py-1.5 text-xs"
                placeholder="直接输入"
                value={steps || ""}
                onChange={(e) => updateCheckin({ steps: clampSteps(Number(e.target.value)) })}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(stepsTarget * 1.5, 10000)}
              step={500}
              value={steps}
              onChange={(e) => updateCheckin({ steps: clampSteps(Number(e.target.value)) })}
              className="mt-2 w-full"
              aria-label="拖动调整步数"
            />
          </div>

          <div className="mb-4">
            <span className="mb-2 block text-xs">😴 昨晚睡眠</span>
            <div className="flex flex-wrap gap-2">
              {[6, 7, 8, 9].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => updateCheckin({ sleepHours: h })}
                  className={`heal-btn px-3 py-1.5 text-xs ${checkin?.sleepHours === h ? "heal-btn-feature" : "heal-btn-ghost"}`}
                >
                  {h} 小时
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs">🌤️ 今天状态</span>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => updateCheckin({ mood: m.key })}
                  className={`heal-btn px-3 py-1.5 text-xs ${checkin?.mood === m.key ? "heal-btn-feature" : "heal-btn-ghost"}`}
                >
                  {m.emoji} {m.key}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 连续打卡奖励 */}
        <div className="heal-card mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">🔥 连续打卡</span>
            {/* 有任何达成记录时，允许随时回看庆祝（重放动画与彩带） */}
            {maxStreak > 0 && (
              <button
                type="button"
                onClick={() =>
                  setCelebration({
                    streak: currentStreak,
                    badges: ownedBadges,
                    replay: true,
                  })
                }
                className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs"
              >
                🎬 回看庆祝
              </button>
            )}
          </div>
          {!profile || !targets ? (
            <p className="text-xs leading-6" style={{ color: "var(--heal-muted)" }}>
              先在下面填好健康档案，喝水和步数才有目标线；每天两样都达标，就能点亮连续天数、解锁徽章。
            </p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-3 text-center" style={{ background: "var(--heal-amber-50)" }}>
                  <div className="text-2xl font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                    🔥 {currentStreak}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
                    当前连续
                  </div>
                </div>
                <div className="rounded-2xl p-3 text-center" style={{ background: "var(--heal-blue-50)" }}>
                  <div className="text-2xl font-medium" style={{ color: "var(--heal-blue-text)" }}>
                    ⭐ {maxStreak}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
                    历史最长
                  </div>
                </div>
              </div>

              <p className="mb-2 text-[11px]" style={{ color: "var(--heal-muted)" }}>
                {todayCompletion.allDone
                  ? "今天已完成 ✅ 明天继续，别断签哦"
                  : `今天还差：${!todayCompletion.waterDone ? "喝水 " : ""}${!todayCompletion.stepsDone ? "步数" : ""}（两项都达标才算 1 天）`}
              </p>

              {/* 徽章墙 */}
              <div className="grid grid-cols-3 gap-2">
                {BADGES.map((b) => {
                  const owned = !!rewards.badges[b.id];
                  return (
                    <div
                      key={b.id}
                      className="rounded-xl p-2 text-center"
                      style={{
                        background: owned ? "var(--heal-amber-50)" : "var(--heal-blue-50)",
                        opacity: owned ? 1 : 0.55,
                      }}
                    >
                      <div className="text-xl">{b.emoji}</div>
                      <div className="text-[10px] font-medium" style={{ color: owned ? "var(--heal-amber-deep)" : "var(--heal-muted)" }}>
                        {b.label}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
                        {owned ? "已达成" : nextB && nextB.id === b.id ? `还差 ${Math.max(0, b.days - maxStreak)} 天` : `${b.days} 天`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 本周打卡一览 */}
        <div className="heal-card mb-4 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">📊 本周打卡</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setWeekStart((w) => addDays(w, -7))} className="heal-btn heal-btn-ghost px-2 py-0.5 text-xs">
                ‹
              </button>
              <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))} className="heal-btn heal-btn-ghost px-2 py-0.5 text-xs">
                ›
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDates(weekStart).map((d, i) => {
              const c = weekCheckins.find((x) => x.date === d);
              const okWater = targets && c && c.waterMl >= targets.waterTarget;
              const okSteps = targets && c && c.steps >= targets.stepsTarget;
              const allDone = !!(okWater && okSteps);
              // 可点进该日补录：不早于最早可补日期、且不是未来
              const pickable = d <= today && d >= earliestDate;
              const isSelected = d === selectedDate;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!pickable}
                  onClick={() => setSelectedDate(d)}
                  title={pickable ? (d === today ? "今天" : `补录 ${d}`) : undefined}
                  className="rounded-xl px-1 py-2 transition-transform active:scale-95"
                  style={{
                    background: "var(--heal-blue-50)",
                    outline: isSelected ? "1.5px solid var(--heal-amber-accent)" : "none",
                    opacity: pickable ? 1 : 0.55,
                    cursor: pickable ? "pointer" : "default",
                  }}
                >
                  <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
                    {WEEKDAY_LABELS[i]}
                  </div>
                  <div className="mt-1 text-sm leading-none">
                    {allDone ? (
                      <span title="两项都达标">✅</span>
                    ) : (
                      <>
                        {okWater ? "💧" : ""}
                        {okSteps ? "🚶" : ""}
                        {!okWater && !okSteps ? <span className="text-[10px]" style={{ color: "var(--heal-card-border)" }}>·</span> : ""}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--heal-muted)" }}>
            💧 喝够水 · 🚶 走够步 · ✅ 两样都达标（计入连续天数）；点日期可补录漏记的那天
          </p>
        </div>

        {/* 每日目标（有档案才显示） */}
        {profile && targets && (
          <div className="heal-card mb-4 p-4">
            <span className="mb-3 block text-sm font-medium">🎯 每日健康目标</span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "热量", value: `${targets.calorieTarget}`, unit: "kcal", hint: `代谢 ${targets.bmr}` },
                { label: "喝水", value: `${targets.waterTarget}`, unit: "ml", hint: "约 35ml/kg" },
                { label: "步数", value: `${targets.stepsTarget}`, unit: "步", hint: "按活动量" },
                { label: "BMI", value: `${targets.bmi}`, unit: "", hint: targets.bmiLabel },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl p-3 text-center" style={{ background: "var(--heal-amber-50)" }}>
                  <div className="text-[11px]" style={{ color: "var(--heal-muted)" }}>
                    {item.label}
                  </div>
                  <div className="text-lg font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                    {item.value}
                    <span className="text-[10px]"> {item.unit}</span>
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
                    {item.hint}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 体重记录（放在目标卡之后：先看目标，再记录并观察趋势） */}
        <WeightCard
          fallbackWeight={profile?.weightKg ?? null}
          onRecorded={(kg) => {
            // 同步档案体重，让喝水目标（35ml/kg）与热量目标（BMR/TDEE）跟着重算
            if (!profile) return;
            const next = saveHealthProfile({
              sex: profile.sex,
              age: profile.age,
              heightCm: profile.heightCm,
              weightKg: kg,
              activityLevel: profile.activityLevel,
              goal: profile.goal,
              allergies: profile.allergies,
              conditions: profile.conditions,
            });
            setProfile(next);
            setWeightKg(kg);
            // 体重变了 → 仪表盘上的体重与迷你曲线也要重算
            setDataVersion((v) => v + 1);
          }}
        />

        {/* 运动记录（独立于步数打卡：不写 rewards，里程碑也只弹自己的庆祝） */}
        <ExerciseCard
          onMilestone={(milestones, hero) =>
            setCelebration({
              badges: milestones,
              hero,
              texts: {
                title: "运动达成！",
                subtitle: milestones.map((m) => m.label).join(" · "),
                praise: "动起来就已经赢过昨天的自己了 💪",
                cta: "继续加油",
              },
            })
          }
        />

        {/* 健康档案表单 */}
        <div className="heal-card p-4">
          <span className="mb-3 block text-sm font-medium">📋 我的健康档案</span>

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs">性别</label>
              <div className="flex gap-2">
                {(["男", "女"] as Sex[]).map((s) => (
                  <button key={s} type="button" onClick={() => setSex(s)} className={`heal-btn flex-1 px-3 py-1.5 text-xs ${sex === s ? "heal-btn-feature" : "heal-btn-ghost"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs">年龄</label>
              <input
                type="number"
                inputMode="numeric"
                min={10}
                max={100}
                className="w-full rounded-xl border p-2 text-sm"
                value={age ?? ""}
                placeholder="如 20"
                onChange={(e) => setAge(e.target.value === "" ? null : Number(e.target.value))}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">身高（cm）</label>
              <input
                type="number"
                inputMode="numeric"
                min={100}
                max={250}
                className="w-full rounded-xl border p-2 text-sm"
                value={heightCm ?? ""}
                placeholder="如 170"
                onChange={(e) => setHeightCm(e.target.value === "" ? null : Number(e.target.value))}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">体重（kg）</label>
              <input
                type="number"
                inputMode="decimal"
                min={25}
                max={200}
                className="w-full rounded-xl border p-2 text-sm"
                value={weightKg ?? ""}
                placeholder="如 60.5"
                onChange={(e) => setWeightKg(e.target.value === "" ? null : Number(e.target.value))}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
          </div>

          <label className="mb-1 block text-xs">日常活动量</label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {ACTIVITY_LEVELS.map((a) => (
              <button key={a.label} type="button" onClick={() => setActivityLevel(a.label)} className={`heal-btn px-2 py-1.5 text-left text-xs ${activityLevel === a.label ? "heal-btn-feature" : "heal-btn-ghost"}`}>
                {a.label}
                <span className="mt-0.5 block text-[10px] font-normal" style={{ color: "var(--heal-muted)" }}>
                  {a.desc}
                </span>
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs">健康目标</label>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {HEALTH_GOALS.map((g) => (
              <button key={g.key} type="button" onClick={() => setGoal(g.key)} className={`heal-btn px-2 py-1.5 text-xs ${goal === g.key ? "heal-btn-primary" : "heal-btn-ghost"}`}>
                {g.key}
                <span className="mt-0.5 block text-[10px] font-normal" style={{ color: "var(--heal-muted)" }}>
                  {g.desc}
                </span>
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs">忌口 / 过敏（一句话）</label>
          <input className="mb-3 w-full rounded-xl border p-2 text-sm" placeholder="如：海鲜过敏，不吃香菜" value={allergies} onChange={(e) => setAllergies(e.target.value)} style={{ borderColor: "var(--heal-card-border)" }} />

          <label className="mb-1 block text-xs">身体状况备注</label>
          <input className="mb-3 w-full rounded-xl border p-2 text-sm" placeholder="如：肠胃不太好，少吃太辣太冰" value={conditions} onChange={(e) => setConditions(e.target.value)} style={{ borderColor: "var(--heal-card-border)" }} />

          {formError && <p className="mb-2 text-xs text-rose-600">{formError}</p>}

          <button type="button" onClick={handleSaveProfile} className="heal-btn heal-btn-primary w-full px-4 py-2.5 text-sm">
            {profile ? "更新档案（目标会随之刷新）" : "保存档案，生成我的每日目标"}
          </button>
          <p className="mt-2 text-[11px]" style={{ color: "var(--heal-muted)" }}>
            档案保存在你自己设备的浏览器里，推荐饭菜和外卖时会自动参考。
          </p>
        </div>
      </div>

      <RewardDialog
        open={!!celebration}
        streak={celebration?.streak ?? 0}
        newBadges={celebration?.badges ?? []}
        replay={celebration?.replay ?? false}
        hero={celebration?.hero}
        texts={celebration?.texts}
        onClose={() => setCelebration(null)}
      />
    </main>
  );
}
