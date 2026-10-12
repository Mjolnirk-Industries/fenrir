import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ANIM_PLAN,
  isFrozen,
  opacityFor,
  revealFraction,
  revealRows,
} from "../lib/anim.ts";

test("the default plan runs 32 ticks at 40ms and then stops", () => {
  assert.equal(DEFAULT_ANIM_PLAN.frameCount, 32);
  assert.equal(DEFAULT_ANIM_PLAN.tickMs, 40);
});

test("revealFraction clamps to 0..1 and never decreases", () => {
  assert.equal(revealFraction(0), 0);
  assert.equal(revealFraction(DEFAULT_ANIM_PLAN.frameCount), 1);
  assert.equal(revealFraction(DEFAULT_ANIM_PLAN.frameCount + 5), 1);
  assert.equal(revealFraction(-5), 0);

  let previous = -1;
  for (let tick = -5; tick <= DEFAULT_ANIM_PLAN.frameCount + 5; tick++) {
    const value = revealFraction(tick);
    assert.ok(value >= 0 && value <= 1, `out of range at ${tick}: ${value}`);
    assert.ok(value >= previous, `not monotonic at ${tick}: ${value} < ${previous}`);
    previous = value;
  }
});

test("opacityFor ramps over the first third and sticks at 1", () => {
  assert.equal(opacityFor(0), 0);
  assert.equal(opacityFor(DEFAULT_ANIM_PLAN.frameCount), 1);

  let previous = -1;
  for (let tick = 0; tick <= DEFAULT_ANIM_PLAN.frameCount + 5; tick++) {
    const value = opacityFor(tick);
    assert.ok(value >= 0 && value <= 1);
    assert.ok(value >= previous, `opacity not monotonic at ${tick}`);
    previous = value;
  }

  const third = Math.ceil(DEFAULT_ANIM_PLAN.frameCount / 3);
  for (let tick = third; tick <= DEFAULT_ANIM_PLAN.frameCount + 5; tick++) {
    assert.equal(opacityFor(tick), 1, `expected full opacity at ${tick}`);
  }
});

test("isFrozen flips exactly at frameCount", () => {
  assert.equal(isFrozen(DEFAULT_ANIM_PLAN.frameCount - 1), false);
  assert.equal(isFrozen(DEFAULT_ANIM_PLAN.frameCount), true);
  assert.equal(isFrozen(DEFAULT_ANIM_PLAN.frameCount + 100), true);
  assert.equal(isFrozen(-1), false);
});

test("revealFraction and isFrozen honor a custom plan", () => {
  const plan = { frameCount: 10, tickMs: 100 };
  assert.equal(revealFraction(0, plan), 0);
  assert.equal(revealFraction(5, plan), 0.5);
  assert.equal(revealFraction(10, plan), 1);
  assert.equal(isFrozen(9, plan), false);
  assert.equal(isFrozen(10, plan), true);
});

test("revealRows reveals from the bottom up at 0, 0.5 and 1", () => {
  const rows = ["ABCDE", "FGHIJ", "KLMNO"];
  assert.deepEqual(revealRows(rows, 0), ["     ", "     ", "     "]);
  assert.deepEqual(revealRows(rows, 1), rows);
  assert.deepEqual(revealRows(rows, 0.5), ["     ", "FG   ", "KLMNO"]);
});

test("revealRows preserves the row count and every row's width", () => {
  const rows = ["ABCDE", "FGHIJK", "L", "", "MNO"];
  for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const out = revealRows(rows, fraction);
    assert.equal(out.length, rows.length);
    out.forEach((line, index) => {
      assert.equal(Array.from(line).length, Array.from(rows[index]).length);
    });
  }
});
