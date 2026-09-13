"use client";

import type { Badge } from "../lib/rewards";

/**
 * 达标庆祝弹窗。每天最多弹一次（由调用方通过 celebrated 记录保证）。
 */
export function RewardDialog({
  open,
  streak,
  newBadges,
  onClose,
}: {
  open: boolean;
  streak: number;
  newBadges: Badge[];
  onClose: () => void;
}) {
  if (!open) return null;

  // 按连续天数给分层级的鼓励，避免每次都同一句话
  const praise =
    streak >= 30
      ? "这已经不是坚持了，是习惯 💛"
      : streak >= 7
        ? "一周都没落下，很稳 👏"
        : streak >= 3
          ? "已经连上好几天了，继续保持 ✨"
          : "今天两样都做到了，开个好头 🌟";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="heal-card w-full max-w-sm p-5 text-center" style={{ background: "var(--heal-card-bg)" }}>
        <div className="mb-1 text-4xl">🎉</div>
        <h2 className="mb-1 text-base font-medium">今日打卡完成！</h2>
        <p className="mb-4 text-xs" style={{ color: "var(--heal-muted)" }}>
          喝水 ✅ 步数 ✅ 两样都达标了
        </p>

        <div className="mb-4 rounded-2xl p-4" style={{ background: "var(--heal-amber-50)" }}>
          <div className="text-3xl font-medium" style={{ color: "var(--heal-amber-deep)" }}>
            🔥 {streak} 天
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--heal-muted)" }}>
            连续达标
          </div>
        </div>

        {newBadges.length > 0 && (
          <div className="mb-4 rounded-2xl p-4" style={{ background: "var(--heal-blue-50)" }}>
            <div className="mb-2 text-xs font-medium" style={{ color: "var(--heal-blue-text)" }}>
              解锁新徽章
            </div>
            <div className="flex flex-col gap-3">
              {newBadges.map((b) => (
                <div key={b.id}>
                  <div className="text-3xl">{b.emoji}</div>
                  <div className="text-xs font-medium" style={{ color: "var(--heal-blue-text)" }}>
                    {b.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mb-4 text-xs leading-5" style={{ color: "var(--heal-muted)" }}>
          {praise}
        </p>

        <button type="button" onClick={onClose} className="heal-btn heal-btn-primary w-full px-3 py-2 text-sm">
          知道了
        </button>
      </div>
    </div>
  );
}
