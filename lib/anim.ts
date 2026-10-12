// Pure animation state for the Fenrir header startup reveal.
//
// The header runs once and then freezes for good: there is no permanent repaint
// loop. Every function here is a pure tick -> value mapping so the wiring layer
// owns the timer and this module stays trivially testable.

export interface AnimPlan {
  /** Total ticks before the header freezes, inclusive of the last animated tick. */
  frameCount: number;
  /** Milliseconds between ticks. */
  tickMs: number;
}

export const DEFAULT_ANIM_PLAN: AnimPlan = { frameCount: 32, tickMs: 40 };

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/** Progress of the reveal at `tick`, clamped to 0..1 and monotonic non-decreasing. */
export function revealFraction(tick: number, plan: AnimPlan = DEFAULT_ANIM_PLAN): number {
  if (plan.frameCount <= 0) return 1;
  return clamp01(tick / plan.frameCount);
}

/** 0..1 opacity ramp used for the fade-in of the revealed art. */
export function opacityFor(tick: number, plan: AnimPlan = DEFAULT_ANIM_PLAN): number {
  const third = plan.frameCount / 3;
  if (third <= 0) return 1;
  return clamp01(tick / third);
}

/** True when the header no longer needs a timer. */
export function isFrozen(tick: number, plan: AnimPlan = DEFAULT_ANIM_PLAN): boolean {
  return tick >= plan.frameCount;
}

/**
 * Reveal `rows` progressively from the bottom up. Fraction 0 blanks every row;
 * fraction 1 returns the rows unchanged. A partially revealed row keeps its
 * left-hand portion up to its share of that row's width. Row count and each
 * row's width are always preserved.
 */
export function revealRows(rows: string[], fraction: number): string[] {
  const count = rows.length;
  if (count === 0) return [];

  const revealed = clamp01(fraction) * count;
  return rows.map((row, index) => {
    const chars = Array.from(row);
    const distanceFromBottom = count - 1 - index;
    if (revealed >= distanceFromBottom + 1) return row;
    if (revealed <= distanceFromBottom) return " ".repeat(chars.length);

    const share = revealed - distanceFromBottom;
    const keep = Math.floor(chars.length * share);
    return chars.slice(0, keep).join("") + " ".repeat(chars.length - keep);
  });
}
