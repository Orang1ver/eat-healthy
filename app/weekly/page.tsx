"use client";

import { useEffect, useMemo, useState } from "react";
import { MealDetailDialog } from "../components/MealDetailDialog";
import { AddMealDialog } from "../components/AddMealDialog";
import { apiKeyHeaders } from "../lib/apiKeys";
import { addDays, formatWeekRange, todayISO, weekDates, weekStartOf, WEEKDAY_LABELS } from "../lib/date";
import {
  getCheckinsInWeek,
  getMealsInWeek,
  loadCheckin,
  loadHealthProfile,
  loadUserProfile,
  loadWeeklyInsight,
  saveUserProfile,
  saveWeeklyInsight,
} from "../lib/storage";
import { buildHealthContext, buildWeekHealthSummary, calcDailyTargets } from "../lib/health";
import type { MealRecord } from "../lib/types";

export default function WeeklyPage() {
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayISO()));
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [selected, setSelected] = useState<MealRecord | null>(null);
  const [addTarget, setAddTarget] = useState<string | null>(null); // 日期 ISO
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    setMeals(getMealsInWeek(weekStart));
    setInsight(loadWeeklyInsight(weekStart)?.reply || "");
  }, [weekStart]);

  const days = useMemo(() => weekDates(weekStart), [weekStart]);

  function mealsForDay(date: string) {
    return meals.filter((m) => m.date === date).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }

  async function generateInsight() {
    setLoadingInsight(true);
    try {
      const profile = loadHealthProfile();
      const targets = profile ? calcDailyTargets(profile) : null;
      const res = await fetch("/api/weekly-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiKeyHeaders() },
        body: JSON.stringify({
          meals,
          weekRange: formatWeekRange(weekStart),
          userProfile: loadUserProfile()?.content,
          healthContext: profile ? buildHealthContext(profile, loadCheckin(todayISO()), targets) : undefined,
          weekHealthSummary: buildWeekHealthSummary(getCheckinsInWeek(weekStart)) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "分析失败");
      setInsight(data.reply);
      saveWeeklyInsight({ weekStart, reply: data.reply, generatedAt: Date.now() });

      const profileRes = await fetch("/api/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiKeyHeaders() },
        body: JSON.stringify({ recentMeals: meals, existingProfile: loadUserProfile()?.content }),
      });
      const profileData = await profileRes.json();
      if (profileRes.ok && profileData.content) saveUserProfile(profileData.content);
    } catch (e: any) {
      setInsight(e.message || "生成失败");
    } finally {
      setLoadingInsight(false);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--heal-bg)" }}>
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-medium" style={{ fontFamily: "var(--font-serif, serif)" }}>
            📅 本周饮食回顾
          </h1>
          <a href="/" className="heal-btn heal-btn-ghost px-3 py-1.5 text-xs">
            ← 返回首页
          </a>
        </header>

        <div className="mb-4 flex items-center justify-center gap-4">
          <button type="button" onClick={() => setWeekStart((w) => addDays(w, -7))} className="heal-btn heal-btn-ghost px-2 py-1 text-sm">
            ‹
          </button>
          <span className="text-sm" style={{ color: "var(--heal-muted)" }}>
            {formatWeekRange(weekStart)}
          </span>
          <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))} className="heal-btn heal-btn-ghost px-2 py-1 text-sm">
            ›
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {days.map((d, i) => {
            const dayMeals = mealsForDay(d);
            return (
              <div key={d} className="heal-card flex flex-col p-2">
                <div className="mb-2 text-center">
                  <div className="text-xs font-medium" style={{ color: "var(--heal-amber-deep)" }}>
                    {WEEKDAY_LABELS[i]}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--heal-muted)" }}>
                    {d.slice(5)}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  {dayMeals.length === 0 && (
                    <div className="py-2 text-center text-[10px]" style={{ color: "var(--heal-card-border)" }}>
                      还没有记录
                    </div>
                  )}
                  {dayMeals.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelected(m)}
                      className="rounded-lg px-1.5 py-1 text-left text-[10px] leading-tight"
                      style={
                        m.source === "manual"
                          ? { background: "var(--heal-blue-50)", color: "var(--heal-blue-text)" }
                          : { background: "var(--heal-amber-50)", color: "var(--heal-amber-text)" }
                      }
                    >
                      <div className="font-medium">{m.time}</div>
                      <div>
                        {m.title || m.dishes[0]?.name}
                        {m.dishes.length > 1 ? ` +${m.dishes.length - 1}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAddTarget(d)}
                  className="heal-btn mt-2 py-1 text-[11px]"
                  style={{ borderRadius: 8, border: "1px dashed var(--heal-card-border)", color: "var(--heal-muted)", background: "transparent" }}
                >
                  + 添加
                </button>
              </div>
            );
          })}
        </div>

        <div className="heal-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">🧠 AI 营养分析师</span>
            <button type="button" disabled={loadingInsight} onClick={generateInsight} className="heal-btn heal-btn-primary px-3 py-1.5 text-xs">
              {loadingInsight ? "分析中…" : "生成本周分析"}
            </button>
          </div>
          <div className="rounded-2xl p-3 text-sm leading-7" style={{ background: "var(--heal-blue-50)", color: "var(--heal-blue-text)" }}>
            {insight || "点击上方按钮，让 AI 营养分析师看看你这周吃得怎么样。"}
          </div>
        </div>
      </div>

      <MealDetailDialog meal={selected} onClose={() => setSelected(null)} onChanged={() => setMeals(getMealsInWeek(weekStart))} />
      <AddMealDialog
        open={!!addTarget}
        date={addTarget || todayISO()}
        onClose={() => setAddTarget(null)}
        onSaved={() => setMeals(getMealsInWeek(weekStart))}
      />
    </main>
  );
}
