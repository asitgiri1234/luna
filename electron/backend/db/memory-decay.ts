/**
 * # Memory decay
 *
 * Re-ranks a memory using how sure Luna was (`confidence`) and how
 * recently it was used (`lastUsed`, or `updatedAt` when it has never
 * been retrieved). The weight is always positive: a stale or
 * low-confidence memory sorts lower and is never deleted.
 */

const DAY_MS = 86_400_000;
/** Age at which the recency factor has fallen by half. */
const HALF_LIFE_DAYS = 45;

export function decayWeight(
  memory: { confidence: number; updatedAt: number; lastUsed: number | null },
  now = Date.now(),
): number {
  const stamp = memory.lastUsed ?? memory.updatedAt;
  const ageDays = Math.max(0, (now - stamp) / DAY_MS);
  const recency = Math.exp((-Math.LN2 * ageDays) / HALF_LIFE_DAYS);
  const confidence = Math.min(1, Math.max(0, memory.confidence));
  return (0.35 + 0.65 * recency) * (0.55 + 0.45 * confidence);
}
