"use client";

import { useEffect, useState } from "react";
import { addMealRecord } from "../lib/storage";
import { nowHM } from "../lib/date";
import { DISH_ROLES, type DishRole } from "../lib/tags";
import type { Dish, MealChannel } from "../lib/types";

export function AddMealDialog({
  open,
  date,
  time,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  time?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [timeValue, setTimeValue] = useState(time || nowHM());
  const [dateValue, setDateValue] = useState(date);
  const [channel, setChannel] = useState<MealChannel>("自己做");
  const [dishes, setDishes] = useState<Dish[]>([{ name: "", role: "主菜", ingredients: [], flavorTags: [] }]);

  useEffect(() => {
    if (open) {
      setTimeValue(time || nowHM());
      setDateValue(date);
      setChannel("自己做");
      setDishes([{ name: "", role: "主菜", ingredients: [], flavorTags: [] }]);
    }
  }, [open, date, time]);

  if (!open) return null;

  function updateDish(i: number, patch: Partial<Dish>) {
    setDishes((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function removeDish(i: number) {
    setDishes((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addDish() {
    setDishes((prev) => [...prev, { name: "", role: "小菜", ingredients: [], flavorTags: [] }]);
  }

  function save() {
    const validDishes = dishes.filter((d) => d.name.trim());
    if (validDishes.length === 0) return;
    addMealRecord({
      date: dateValue,
      time: timeValue,
      title: validDishes[0].name,
      dishes: validDishes,
      channel,
      avoidTags: [],
      methodTags: [],
      source: "manual",
    });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="heal-card w-full max-w-md p-5">
        <h2 className="mb-3 text-base font-medium">手动补录这一餐</h2>
        <p className="mb-3 text-xs" style={{ color: "var(--heal-muted)" }}>
          自由选择吃饭的具体时间，不用套用固定的早/午/晚餐时段。
        </p>

        <div className="mb-3 flex gap-2">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="flex-1 rounded-xl border p-2 text-sm"
            style={{ borderColor: "var(--heal-card-border)" }}
          />
          <input
            type="time"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            className="rounded-xl border p-2 text-sm"
            style={{ borderColor: "var(--heal-card-border)" }}
          />
        </div>

        <div className="mb-3 flex gap-2">
          {(["自己做", "外卖"] as MealChannel[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={`heal-btn flex-1 px-2 py-1.5 text-sm ${channel === c ? "heal-btn-feature" : "heal-btn-ghost"}`}
            >
              {c === "自己做" ? "🍳 自己做" : "🛵 外卖"}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-col gap-2">
          {dishes.map((dish, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border px-2 py-1 text-sm"
                placeholder="菜名"
                value={dish.name}
                onChange={(e) => updateDish(i, { name: e.target.value })}
                style={{ borderColor: "var(--heal-card-border)" }}
              />
              <select
                value={dish.role}
                onChange={(e) => updateDish(i, { role: e.target.value as DishRole })}
                className="rounded-lg border px-1 py-1 text-xs"
                style={{ borderColor: "var(--heal-card-border)" }}
              >
                {DISH_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                className="w-28 rounded-lg border px-2 py-1 text-xs"
                placeholder="食材，逗号分隔"
                value={dish.ingredients.map((x) => x.label).join(",")}
                onChange={(e) =>
                  updateDish(i, {
                    ingredients: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((label) => ({ label, fromPantry: true })),
                  })
                }
                style={{ borderColor: "var(--heal-card-border)" }}
              />
              <button type="button" onClick={() => removeDish(i)} className="text-xs" style={{ color: "var(--heal-muted)" }}>
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addDish} className="heal-btn heal-btn-ghost self-start px-2 py-1 text-xs">
            + 新增一道菜
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
            取消
          </button>
          <button type="button" onClick={save} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
