import React from "react";

interface StreakBannerProps {
  streak: number;
  totalCompleted: number;
}

function streakMessage(streak: number): string {
  if (streak === 0) return "Start your streak today!";
  if (streak === 1) return "Day one — keep it going!";
  if (streak < 5) return `${streak} days strong. Don't stop now.`;
  if (streak < 14) return `You're on a ${streak}-day streak!`;
  return `${streak} days. Unstoppable.`;
}

export default function StreakBanner({
  streak,
  totalCompleted,
}: StreakBannerProps): React.JSX.Element {
  return (
    <div
      className="px-5 pt-14 pb-6"
      style={{
        background: "linear-gradient(135deg, #1E88E5 0%, #00897B 100%)",
      }}
    >
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-white/80 text-[11px] font-semibold uppercase tracking-widest"
            >
              Current Streak
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-white leading-none"
              style={{ fontSize: "56px", fontWeight: 900, lineHeight: 1 }}
            >
              {streak}
            </span>
            <span className="text-white/80 text-lg font-medium">
              {streak === 1 ? "day" : "days"}
            </span>
            {streak > 0 && (
              <span className="text-2xl" role="img" aria-label="fire">
                🔥
              </span>
            )}
          </div>
          <p className="text-white/90 text-sm font-medium mt-2">
            {streakMessage(streak)}
          </p>
        </div>

        <div className="text-right">
          <p
            className="text-white/70 text-[11px] font-semibold uppercase tracking-widest"
          >
            Total
          </p>
          <p className="text-white font-bold text-2xl leading-none">
            {totalCompleted}
          </p>
          <p className="text-white/70 text-xs mt-0.5">sessions</p>
        </div>
      </div>
    </div>
  );
}
