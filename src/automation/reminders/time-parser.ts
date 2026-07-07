/**
 * # Lightweight natural-language time parser
 *
 * Turns phrases the intent detector extracts ("tomorrow 5 PM", "in 10
 * minutes", "2026-07-08T17:00") into an absolute timestamp. Deliberately
 * small and dependency-free; returns null when it can't be sure, so the
 * reminder executor can report a friendly failure.
 */
export function parseTime(input: string, now = new Date()): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  // 1. ISO / Date-parseable strings.
  const iso = Date.parse(input);
  if (Number.isFinite(iso)) return iso;

  // 2. Relative: "in N minutes/hours/days".
  const relative = /in\s+(\d+)\s*(min|minute|minutes|hour|hours|day|days)/.exec(text);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const ms =
      unit.startsWith("min") ? amount * 60_000 :
      unit.startsWith("hour") ? amount * 3_600_000 :
      amount * 86_400_000;
    return now.getTime() + ms;
  }

  // 3. "today" / "tomorrow" (+ optional clock time), else a bare clock time.
  const target = new Date(now);
  let dayMatched = false;
  if (text.includes("tomorrow")) {
    target.setDate(target.getDate() + 1);
    dayMatched = true;
  } else if (text.includes("today") || text.includes("tonight")) {
    dayMatched = true;
  }

  const clock = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(text);
  if (clock) {
    let hour = Number(clock[1]);
    const minute = clock[2] ? Number(clock[2]) : 0;
    const meridiem = clock[3];
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    target.setHours(hour, minute, 0, 0);
    // A bare time already past today rolls to tomorrow.
    if (!dayMatched && target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }

  if (dayMatched) {
    target.setHours(9, 0, 0, 0); // default to 9am when only a day is given
    return target.getTime();
  }
  return null;
}
