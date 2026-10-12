import test from "node:test";
import assert from "node:assert/strict";
import { FENRIR_PALETTE, paint, paintArtLine, sgr } from "../lib/style.ts";
import { FENRIR_WORDMARK, WOLF_SIGIL } from "../lib/sigil.ts";
import { visibleWidth } from "../lib/width.ts";

const RESET = "\x1b[0m";
const ART = [...WOLF_SIGIL.lines, ...FENRIR_WORDMARK.lines];

test("sgr builds a truecolor foreground sequence", () => {
  assert.equal(sgr([242, 140, 40]), "\x1b[38;2;242;140;40m");
  assert.equal(sgr([0, 0, 0]), "\x1b[38;2;0;0;0m");
});

test("paint wraps with the color and a reset, and is identity for null", () => {
  assert.equal(paint("x", null), "x");
  assert.equal(paint("wolf", [1, 2, 3]), `${sgr([1, 2, 3])}wolf${RESET}`);
});

test("the palette matches the owner's measured colors", () => {
  assert.deepEqual(FENRIR_PALETTE.contour, [242, 140, 40]);
  assert.deepEqual(FENRIR_PALETTE.shade, [110, 143, 166]);
  assert.deepEqual(FENRIR_PALETTE.ink, [228, 87, 46]);
  assert.deepEqual(FENRIR_PALETTE.eye, [216, 210, 200]);
  assert.deepEqual(FENRIR_PALETTE.label, [110, 143, 166]);
  assert.deepEqual(FENRIR_PALETTE.value, [216, 210, 200]);
  assert.deepEqual(FENRIR_PALETTE.accent, [228, 87, 46]);
  assert.deepEqual(FENRIR_PALETTE.dim, [20, 17, 15]);
});

test("paintArtLine colors each zone from the palette and closes every run", () => {
  assert.equal(paintArtLine("█"), `${sgr(FENRIR_PALETTE.contour)}█${RESET}`);
  assert.equal(paintArtLine("▒"), `${sgr(FENRIR_PALETTE.shade)}▒${RESET}`);
  assert.equal(paintArtLine("▓"), `${sgr(FENRIR_PALETTE.ink)}▓${RESET}`);
  assert.equal(paintArtLine("●"), `${sgr(FENRIR_PALETTE.eye)}●${RESET}`);
  // Consecutive same-zone characters share one run.
  assert.equal(paintArtLine("██"), `${sgr(FENRIR_PALETTE.contour)}██${RESET}`);
  // A zone change closes the previous run.
  assert.equal(
    paintArtLine("█▒▓●"),
    `${sgr(FENRIR_PALETTE.contour)}█${RESET}${sgr(FENRIR_PALETTE.shade)}▒${RESET}` +
      `${sgr(FENRIR_PALETTE.ink)}▓${RESET}${sgr(FENRIR_PALETTE.eye)}●${RESET}`,
  );
  // Spaces split runs and stay unpainted.
  assert.equal(
    paintArtLine("█ █"),
    `${sgr(FENRIR_PALETTE.contour)}█${RESET} ${sgr(FENRIR_PALETTE.contour)}█${RESET}`,
  );
});

test("paintArtLine leaves an all-space line completely uncolored", () => {
  assert.equal(paintArtLine("      "), "      ");
});

test("paintArtLine keeps visibleWidth unchanged for every art line", () => {
  for (const line of ART) {
    assert.equal(visibleWidth(paintArtLine(line)), visibleWidth(line));
    assert.equal(visibleWidth(paintArtLine(line, { dimmed: true })), visibleWidth(line));
  }
});

test("dimmed art uses a genuinely darker RGB than normal art", () => {
  const normal = paintArtLine("█", { dimmed: false });
  const dimmed = paintArtLine("█", { dimmed: true });
  assert.notEqual(normal, dimmed);

  const normalRgb = /38;2;(\d+);(\d+);(\d+)/.exec(normal);
  const dimRgb = /38;2;(\d+);(\d+);(\d+)/.exec(dimmed);
  assert.ok(normalRgb && dimRgb, "both sequences carry an RGB triplet");
  for (let i = 1; i <= 3; i++) {
    const light = Number(normalRgb![i]);
    const dark = Number(dimRgb![i]);
    assert.ok(dark < light, `component ${i}: dim ${dark} should be darker than ${light}`);
  }
});

test("the eye and value colors are the same ash, and the accent is ember", () => {
  assert.deepEqual(FENRIR_PALETTE.eye, FENRIR_PALETTE.value);
  assert.deepEqual(FENRIR_PALETTE.accent, FENRIR_PALETTE.ink);
});
