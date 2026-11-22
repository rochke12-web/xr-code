// Arena-style lane manager for free photo generation.
//
// How LMArena-style free tiers stay alive (adapted 2026-11-22 from the
// observable mechanics): they never depend on ONE provider's quota — they
// keep a POOL of interchangeable models, learn which lanes are healthy RIGHT
// NOW, route every request to the best available lane, and quarantine lanes
// that start rejecting (429/outage) instead of hammering them. Anonymous
// users get through because the cost is spread thin across the whole pool.
//
// This module is the same algorithm, sized for our painter pool:
//  · every paint result feeds a per-model health record (EMA latency, ok/fail)
//  · a lane that fails with a rate-limit-style error gets a cooldown — the
//    circuit breaker — so the worker never burns its budget on a dead lane
//  · ordering = healthy lanes first, then fastest EMA, default order last
//  · in-memory per instance (resets on cold start — harmless, it re-learns)

export type LaneStat = {
  ok: number;
  fail: number;
  emaMs: number;          // exponential moving average of successful paint time
  cooldownUntil: number;  // circuit breaker: skip this lane until this epoch ms
  lastError: string;
};

const stats = new Map<string, LaneStat>();

const EMA_ALPHA = 0.3;
const DEFAULT_COOLDOWN_MS = 90_000; // one 429 window + slack

function lane(model: string): LaneStat {
  let s = stats.get(model);
  if (!s) {
    s = { ok: 0, fail: 0, emaMs: 0, cooldownUntil: 0, lastError: "" };
    stats.set(model, s);
  }
  return s;
}

/** Record the outcome of one paint attempt on a lane. */
export function recordLane(model: string, ok: boolean, ms: number, err = ""): void {
  const s = lane(model);
  if (ok) {
    s.ok += 1;
    s.emaMs = s.emaMs ? Math.round(s.emaMs * (1 - EMA_ALPHA) + ms * EMA_ALPHA) : ms;
    s.lastError = "";
  } else {
    s.fail += 1;
    s.lastError = err.slice(0, 120);
    // rate-limit / quota style rejections trip the breaker; one-off empties don't
    if (/429|too many|rate|quota|402|503/i.test(err)) {
      s.cooldownUntil = Date.now() + DEFAULT_COOLDOWN_MS;
    }
  }
}

function score(s: LaneStat, now: number): number {
  const total = s.ok + s.fail;
  const rate = total ? s.ok / total : 0.5; // unseen lanes start optimistic
  const speed = s.emaMs ? 1 / (1 + s.emaMs / 30000) : 0.5; // ~30s paint ≈ 0.5
  return rate * 2 + speed;
}

/**
 * Order the painter queue arena-style: lanes out of cooldown first, ranked
 * by success rate then measured speed; cooling lanes go to the BACK (still
 * reachable — if every lane is cooling we'd rather try than fail).
 */
export function orderLanes(models: string[]): string[] {
  const now = Date.now();
  const hot = models.filter(m => lane(m).cooldownUntil <= now);
  const cool = models.filter(m => lane(m).cooldownUntil > now);
  const byScore = (a: string, b: string) => score(lane(b), now) - score(lane(a), now);
  return [...hot.sort(byScore), ...cool.sort(byScore)];
}

/** True while the circuit breaker holds a lane open-failed. */
export function laneCooling(model: string): boolean {
  return lane(model).cooldownUntil > Date.now();
}

/** Test/debug snapshot. */
export function laneSnapshot(): Record<string, LaneStat> {
  return Object.fromEntries(stats);
}
