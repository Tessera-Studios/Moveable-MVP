/**
 * Pure statistics helpers shared by the patient dashboard, progress page, and
 * the PDF export route. Kept free of Supabase/server dependencies so they can
 * be unit-tested in isolation.
 */

/** Converts a UTC timestamp to a YYYY-MM-DD calendar date in the given IANA timezone. */
export function toLocalDate(utcDate: string, timezone: string): string {
  return new Date(utcDate).toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Returns the unique set of local calendar days (YYYY-MM-DD) for the given timestamps. */
export function distinctLocalDays(
  timestamps: string[],
  timezone: string
): string[] {
  return Array.from(new Set(timestamps.map((t) => toLocalDate(t, timezone))));
}

/**
 * Current consecutive-day completion streak. The streak is "active" only if it
 * includes today or yesterday (in the patient's timezone), then counts
 * backwards over consecutive completed days.
 */
export function calculateStreak(
  completedDates: string[],
  timezone: string
): number {
  if (completedDates.length === 0) return 0;

  const dateSet = new Set(completedDates);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: timezone }
  );

  const startDate = dateSet.has(today)
    ? today
    : dateSet.has(yesterday)
      ? yesterday
      : null;

  if (!startDate) return 0;

  let streak = 0;
  const cursor = new Date(startDate + "T12:00:00");

  while (true) {
    const ds = cursor.toLocaleDateString("en-CA", { timeZone: timezone });
    if (!dateSet.has(ds)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/**
 * Fraction (0–1) of days in a range that had at least one completed session.
 * Counting distinct days (not raw sessions) keeps the value within 0–100% even
 * when multiple sessions are completed on the same day.
 */
export function complianceRate(
  distinctCompletedDays: number,
  daysInRange: number
): number {
  if (daysInRange <= 0) return 0;
  return distinctCompletedDays / daysInRange;
}
