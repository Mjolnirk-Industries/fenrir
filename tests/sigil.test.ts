import test from "node:test";
import assert from "node:assert/strict";
import { FENRIR_WORDMARK, WOLF_SIGIL, composeBanner, zoneOfChar } from "../lib/sigil.ts";
import type { ArtBlock } from "../lib/sigil.ts";
import { visibleWidth } from "../lib/width.ts";

const BLOCKS = [WOLF_SIGIL, FENRIR_WORDMARK];
const ZONES = ["empty", "contour", "shade", "ink", "eye"];

test("every art line is exactly the declared width of palette characters", () => {
  for (const block of BLOCKS) {
    assert.equal(block.lines.length, block.height);
    for (const line of block.lines) {
      assert.equal(Array.from(line).length, block.width);
      for (const ch of line) {
        assert.ok(ZONES.includes(zoneOfChar(ch)), `unexpected zone for ${JSON.stringify(ch)}`);
      }
    }
  }
});

test("the sigil stays inside 24..28 columns and 10..14 rows", () => {
  assert.ok(WOLF_SIGIL.width >= 24 && WOLF_SIGIL.width <= 28);
  assert.ok(WOLF_SIGIL.height >= 10 && WOLF_SIGIL.height <= 14);
});

test("the wordmark is five rows tall and 30..46 columns wide", () => {
  assert.equal(FENRIR_WORDMARK.height, 5);
  assert.ok(FENRIR_WORDMARK.width >= 30 && FENRIR_WORDMARK.width <= 46);
});

test("art carries no ANSI and every glyph is a single terminal cell", () => {
  for (const line of [...WOLF_SIGIL.lines, ...FENRIR_WORDMARK.lines]) {
    assert.ok(!line.includes("\x1b"));
    assert.equal(visibleWidth(line), Array.from(line).length);
  }
});

test("the sigil draws a real head and an eye; the wordmark has no eye", () => {
  const ink = WOLF_SIGIL.lines.join("").replace(/ /g, "").length;
  assert.ok(ink >= 80, `expected >= 80 non-space characters, saw ${ink}`);
  assert.ok(
    WOLF_SIGIL.lines.some((line) => Array.from(line).some((ch) => zoneOfChar(ch) === "eye")),
    "the sigil needs an eye",
  );
  assert.ok(
    FENRIR_WORDMARK.lines.every((line) =>
      Array.from(line).every((ch) => zoneOfChar(ch) !== "eye"),
    ),
    "the wordmark must not contain an eye",
  );
});

test("zoneOfChar maps the palette and throws a TypeError for anything else", () => {
  assert.equal(zoneOfChar(" "), "empty");
  for (const ch of "█▀▄▌▐") assert.equal(zoneOfChar(ch), "contour");
  assert.equal(zoneOfChar("▒"), "shade");
  assert.equal(zoneOfChar("▓"), "ink");
  assert.equal(zoneOfChar("●"), "eye");

  for (const ch of ["x", "X", "|", "\t", "😀"]) {
    assert.throws(
      () => zoneOfChar(ch),
      TypeError,
      `expected zoneOfChar(${JSON.stringify(ch)}) to throw a TypeError`,
    );
  }

  // The message names the offending character (escaped for control characters).
  for (const ch of ["x", "|", "😀"]) {
    assert.throws(
      () => zoneOfChar(ch),
      (error: unknown) =>
        error instanceof TypeError && String((error as Error).message).includes(ch),
      `expected the message to name ${JSON.stringify(ch)}`,
    );
  }
});

test("composeBanner goes side by side at the exact threshold and stacks below", () => {
  const threshold = WOLF_SIGIL.width + 3 + FENRIR_WORDMARK.width;
  const wide = composeBanner({ sigil: WOLF_SIGIL, wordmark: FENRIR_WORDMARK, width: threshold });
  assert.equal(wide.sideBySide, true);
  assert.equal(wide.lines.length, Math.max(WOLF_SIGIL.height, FENRIR_WORDMARK.height));

  const narrow = composeBanner({
    sigil: WOLF_SIGIL,
    wordmark: FENRIR_WORDMARK,
    width: threshold - 1,
  });
  assert.equal(narrow.sideBySide, false);
  assert.equal(narrow.lines.length, WOLF_SIGIL.height + FENRIR_WORDMARK.height);
});

test("composeBanner stacks the wordmark above the sigil", () => {
  const sigil: ArtBlock = { lines: ["sss"], width: 3, height: 1 };
  const wordmark: ArtBlock = { lines: ["www", "www"], width: 3, height: 2 };
  const out = composeBanner({ sigil, wordmark, width: 3 });
  assert.equal(out.sideBySide, false);
  assert.deepEqual(out.lines, ["www", "www", "sss"]);
});

test("composeBanner vertically centers the shorter block and honors the gap", () => {
  const sigil: ArtBlock = { lines: ["AAA"], width: 3, height: 1 };
  const wordmark: ArtBlock = { lines: ["BBB", "BBB", "BBB"], width: 3, height: 3 };

  const defaultGap = composeBanner({ sigil, wordmark, width: 40 });
  assert.equal(defaultGap.sideBySide, true);
  assert.deepEqual(defaultGap.lines, ["      BBB", "AAA   BBB", "      BBB"]);

  const tightGap = composeBanner({ sigil, wordmark, width: 40, gap: 1 });
  assert.deepEqual(tightGap.lines, ["    BBB", "AAA BBB", "    BBB"]);
});

test("no composed line ever exceeds the requested width (sweep 20..200)", () => {
  for (let width = 20; width <= 200; width++) {
    const out = composeBanner({ sigil: WOLF_SIGIL, wordmark: FENRIR_WORDMARK, width });
    for (const line of out.lines) {
      assert.ok(
        visibleWidth(line) <= width,
        `width ${width}: ${visibleWidth(line)} > ${width} in ${JSON.stringify(line)}`,
      );
    }
  }
});
