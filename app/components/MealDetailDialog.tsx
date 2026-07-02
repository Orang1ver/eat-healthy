"use client";

import { useState } from "react";
import { DISH_ROLES, type DishRole } from "../lib/tags";
import { deleteMealRecord, updateMealRecord } from "../lib/storage";
import type { Dish, MealRecord } from "../lib/types";

export function MealDetailDialog({
  meal,
  onClose,
  onChanged,
}: {
  meal: MealRecord | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [timeValue, setTimeValue] = useState("");

  if (!meal) return null;

  function startEdit() {
    setDishes(meal!.dishes.map((d) => ({ ...d, ingredients: [...d.ingredients] })));
    setTimeValue(meal!.time);
    setEditing(true);
  }

  function save() {
    updateMealRecord(meal!.id, { dishes, time: timeValue });
    setEditing(false);
    onChanged();
    onClose();
  }

  function removeRecord() {
    deleteMealRecord(meal!.id);
    onChanged();
    onClose();
  }

  function updateDish(i: number, patch: Partial<Dish>) {
    setDishes((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function removeDish(i: number) {
    setDishes((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addDish() {
    setDishes((prev) => [...prev, { name: "", role: "小菜", ingredients: [], flavorTags: [] }]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="heal-card w-full max-w-md p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-base font-medium">{meal.title || meal.dishes[0]?.name || "这一餐"}</h2>
          <span className="text-xs" style={{ color: "var(--heal-muted)" }}>
            {meal.date} · {meal.time} · {meal.channel}
          </span>
        </div>

        {!editing ? (
          <>
            <div className="my-3 flex flex-col gap-2">
              {meal.dishes.map((dish, i) => (
                <div key={i} className="rounded-2xl px-3 py-2 text-sm" style={{ background: "var(--heal-bg)", border: "0.5px solid var(--heal-card-border)" }}>
                  <span className="font-medium">{dish.name}</span>
                  <span className="ml-2 text-xs" style={{ color: "var(--heal-muted)" }}>
                    [{dish.role}] {dish.ingredients.map((d) => d.label).join("、")}
                  </span>
                </div>
              ))}
            </div>
            {meal.aiMessage && (
              <div className="mb-3 rounded-2xl p-3 text-sm leading-7" style={{ background: "var(--heal-blue-50)", color: "var(--heal-blue-text)" }}>
                ❤ {meal.aiMessage}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={removeRecord} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
                删除 🗑️
              </button>
              <button type="button" onClick={startEdit} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
                编辑 ✏️
              </button>
              <button type="button" onClick={onClose} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
                关闭
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="my-3">
              <label className="mb-1 block text-xs" style={{ color: "var(--heal-muted)" }}>
                就餐时间
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="rounded-lg border px-2 py-1 text-sm"
                style={{ borderColor: "var(--heal-card-border)" }}
              />
            </div>
            <div className="mb-3 flex flex-col gap-2">
              {dishes.map((dish, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border px-2 py-1 text-sm"
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
              <button type="button" onClick={() => setEditing(false)} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
                取消
              </button>
              <button type="button" onClick={save} className="heal-btn heal-btn-primary px-3 py-2 text-sm">
                保存修改
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
