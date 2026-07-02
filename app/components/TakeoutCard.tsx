"use client";

import type { TakeoutDish } from "../lib/types";

type Pick = TakeoutDish & { reason: string; pairTip?: string };

export function TakeoutCard({ pick, onAccept }: { pick: Pick; onAccept: () => void }) {
  return (
    <div className="heal-card p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-medium">
          {pick.restaurant} · {pick.name}
        </span>
        {pick.priceRange && (
          <span className="text-xs" style={{ color: "var(--heal-muted)" }}>
            {pick.priceRange}
          </span>
        )}
      </div>
      <div className="mb-2 text-xs" style={{ color: "var(--heal-muted)" }}>
        品类：{pick.category}
      </div>
      <div
        className="mb-3 rounded-2xl p-3 text-sm leading-7"
        style={{ background: "var(--heal-blue-50)", color: "var(--heal-blue-text)", fontFamily: "var(--font-serif, serif)" }}
      >
        ❤ {pick.reason}
        {pick.pairTip ? `（${pick.pairTip}）` : ""}
      </div>
      <button type="button" onClick={onAccept} className="heal-btn heal-btn-primary w-full px-3 py-2 text-sm">
        就吃这个 ✅
      </button>
    </div>
  );
}
