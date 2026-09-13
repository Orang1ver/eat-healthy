"use client";

import { useEffect, useRef, useState } from "react";
import { motion, animate, useReducedMotion } from "motion/react";
import type { Badge } from "../lib/rewards";

/**
 * 达标庆祝弹窗（动画版）。
 * - 入场：卡片 spring 弹出 + 遮罩淡入
 * - 主效果：连续天数数字滚动 + 彩带
 * - 辅助：新徽章依次入场
 * - prefers-reduced-motion：跳过彩带与弹跳，内容直接可见（动画不是唯一 reveal 方式）
 */

const CONFETTI_COLORS = ["#FAC775", "#DCEFFC", "#FFD9A0", "#0C447C", "#ffffff"];

export function RewardDialog({
  open,
  streak,
  newBadges,
  replay = false,
  onClose,
}: {
  open: boolean;
  streak: number;
  newBadges: Badge[];
  /** 回看模式：标题改为"成就回看"，徽章区显示"我的徽章"而非"解锁新徽章" */
  replay?: boolean;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [displayStreak, setDisplayStreak] = useState(0);
  const confettiRef = useRef<{ reset: () => void } | null>(null);

  // 打开时：数字滚动 + 彩带（动态加载 confetti，不占首屏体积）
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    if (reduced) {
      setDisplayStreak(streak);
      return;
    }

    const controls = animate(0, streak, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplayStreak(Math.round(v)),
    });

    import("canvas-confetti")
      .then((mod) => {
        if (cancelled) return;
        const fire = mod.default;
        confettiRef.current = fire;
        // 左下角斜喷
        fire({
          particleCount: 90,
          spread: 70,
          origin: { x: 0.1, y: 0.9 },
          colors: CONFETTI_COLORS,
          zIndex: 60,
          disableForReducedMotion: true,
        });
        // 右下角斜喷，稍微延迟形成呼应
        setTimeout(() => {
          if (!cancelled) {
            fire({
              particleCount: 90,
              spread: 70,
              origin: { x: 0.9, y: 0.9 },
              colors: CONFETTI_COLORS,
              zIndex: 60,
              disableForReducedMotion: true,
            });
          }
        }, 180);
        // 解锁徽章时，顶部再撒一波金色的
        if (newBadges.length > 0) {
          setTimeout(() => {
            if (!cancelled) {
              fire({
                particleCount: 140,
                spread: 100,
                origin: { x: 0.5, y: 0.2 },
                colors: ["#FAC775", "#FFD9A0", "#ffffff"],
                scalar: 1.1,
                zIndex: 60,
                disableForReducedMotion: true,
              });
            }
          }, 380);
        }
      })
      .catch(() => {
        /* 彩带加载失败不影响庆祝弹窗本身 */
      });

    return () => {
      cancelled = true;
      controls.stop();
      setDisplayStreak(0);
      confettiRef.current?.reset();
    };
  }, [open, streak, newBadges.length, reduced]);

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
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="heal-card w-full max-w-sm p-5 text-center"
        style={{ background: "var(--heal-card-bg)" }}
        initial={reduced ? false : { scale: 0.75, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 22 }}
      >
        <motion.div
          className="mb-1 text-4xl"
          initial={reduced ? false : { scale: 0, rotate: -20 }}
          animate={reduced ? {} : { scale: 1, rotate: 0 }}
          transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 12, delay: 0.15 }}
        >
          🎉
        </motion.div>
        <h2 className="mb-1 text-base font-medium">{replay ? "🏅 打卡成就回看" : "今日打卡完成！"}</h2>
        <p className="mb-4 text-xs" style={{ color: "var(--heal-muted)" }}>
          {replay ? "这是你坚持下来的样子" : "喝水 ✅ 步数 ✅ 两样都达标了"}
        </p>

        <motion.div
          className="mb-4 rounded-2xl p-4"
          style={{ background: "var(--heal-amber-50)" }}
          initial={reduced ? false : { scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={reduced ? { duration: 0.15 } : { delay: 0.25, type: "spring", stiffness: 260, damping: 18 }}
        >
          <div className="text-3xl font-medium tabular-nums" style={{ color: "var(--heal-amber-deep)" }}>
            🔥 {displayStreak} 天
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--heal-muted)" }}>
            连续达标
          </div>
        </motion.div>

        {newBadges.length > 0 && (
          <motion.div
            className="mb-4 rounded-2xl p-4"
            style={{ background: "var(--heal-blue-50)" }}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0.15 } : { delay: 0.45, duration: 0.3 }}
          >
            <div className="mb-2 text-xs font-medium" style={{ color: "var(--heal-blue-text)" }}>
              {replay ? "我的徽章" : "解锁新徽章"}
            </div>
            <div className="flex flex-col gap-3">
              {newBadges.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={reduced ? false : { scale: 0.5, opacity: 0 }}
                  animate={reduced ? {} : { scale: 1, opacity: 1 }}
                  transition={reduced ? { duration: 0.15 } : { delay: 0.55 + i * 0.18, type: "spring", stiffness: 300, damping: 15 }}
                >
                  <div className="text-3xl">{b.emoji}</div>
                  <div className="text-xs font-medium" style={{ color: "var(--heal-blue-text)" }}>
                    {b.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <p className="mb-4 text-xs leading-5" style={{ color: "var(--heal-muted)" }}>
          {praise}
        </p>

        <button type="button" onClick={onClose} className="heal-btn heal-btn-primary w-full px-3 py-2 text-sm">
          {replay ? "继续加油" : "知道了"}
        </button>
      </motion.div>
    </motion.div>
  );
}
