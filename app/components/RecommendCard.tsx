"use client";

import { useState } from "react";
import { ShoppingList } from "./ShoppingList";
import type { Dish } from "../lib/types";

type RecommendResult = {
  title: string;
  dishes: Dish[];
  shoppingList: string[];
  aiMessage: string;
};

export function RecommendCard({
  result,
  onAccept,
  onRegenerate,
  onFeedback,
  loading,
}: {
  result: RecommendResult;
  onAccept: () => void;
  onRegenerate: () => void;
  onFeedback: (text: string) => void;
  loading: boolean;
}) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="heal-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-lg font-medium" style={{ color: "var(--foreground)", fontFamily: "var(--font-serif, serif)" }}>
          {result.title}
        </span>
        <span className="heal-pill px-2.5 py-1 text-xs" style={{ background: "var(--heal-amber-50)", color: "var(--heal-amber-text)" }}>
          {result.dishes.length} 道
        </span>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        {result.dishes.map((dish, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm"
            style={{ background: "var(--heal-bg)", border: "0.5px solid var(--heal-card-border)" }}
          >
            <div>
              <span className="font-medium">{dish.name}</span>
              <span
                className="heal-pill ml-2 px-2 py-1.5 text-[11px]"
                style={{ background: "var(--heal-amber-50)", color: "var(--heal-amber-text)" }}
              >
                {dish.role}
              </span>
            </div>
            <span className="text-xs" style={{ color: "var(--heal-muted)" }}>
              {dish.ingredients.map((ing) => ing.label + (ing.fromPantry ? "" : "*")).join("・")}
            </span>
          </div>
        ))}
      </div>

      <ShoppingList items={result.shoppingList} />

      <div
        className="mb-3 rounded-2xl p-3 text-sm leading-7"
        style={{ background: "var(--heal-blue-50)", color: "var(--heal-blue-text)", fontFamily: "var(--font-serif, serif)" }}
      >
        ❤ {result.aiMessage}
      </div>

      <div className="mb-2 flex gap-2">
        <button type="button" onClick={onAccept} disabled={loading} className="heal-btn heal-btn-primary flex-1 px-3 py-2 text-sm">
          就吃这桌 ✅
        </button>
        <button type="button" onClick={onRegenerate} disabled={loading} className="heal-btn heal-btn-ghost px-3 py-2 text-sm">
          换一桌 🔄
        </button>
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-full border px-3 py-2 text-sm"
          placeholder="不想要香菜 / 汤换成别的..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && feedback.trim()) {
              onFeedback(feedback);
              setFeedback("");
            }
          }}
          style={{ borderColor: "var(--heal-card-border)" }}
        />
        <button
          type="button"
          disabled={loading || !feedback.trim()}
          onClick={() => {
            onFeedback(feedback);
            setFeedback("");
          }}
          className="heal-btn heal-btn-ghost px-3 py-2 text-sm"
        >
          发送
        </button>
      </div>
    </div>
  );
}
