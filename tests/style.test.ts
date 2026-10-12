import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FENRIR_PALETTE, paint, paintZonedArt, sgr } from "../lib/style.ts";
import type { ZoneLetter } from "../lib/style.ts";
import { parseArtBlock, parseZoneMap } from "../lib/sigil.ts";
import { visibleWidth } from "../lib/width.ts";

const RESET = "\x1b[0m";
const LETTERS: ZoneLetter[] = ["A", "B", "C", "D", "E"];

const SGR_RE = /\x1b\[38;2;\d+;\d+;\d+m/g;
const RESET_RE = /\x1b\[0m/g;

function count(re: RegExp, text: string): number {
  return (text.match(re) ?? []).length;
}

function stripAnsi(text: string): string {
  return text.replace(SGR_RE, "").replace(RESET_RE, "");
}

function rgbOf(sequence: string): [number, number, number] {
  const match = /38;2;(\d+);(\d+);(\d+)/.exec(sequence);
  assert.ok(match, `expected an RGB triplet in ${JSON.stringify(sequence)}`);
  return [Number(match![1]), Number(match![2]), Number(match![3])];
}

test("sgr builds a truecolor foreground sequence", () => {
  assert.equal(sgr([242, 140, 40]), "\x1b[38;2;242;140;40m");
  assert.equal(sgr([0, 0, 0]), "\x1b[38;2;0;0;0m");
});

test("paint wraps with the color and a reset, and is identity for null", () => {
  assert.equal(paint("x", null), "x");
  assert.equal(paint("wolf", [1, 2, 3]), `${sgr([1, 2, 3])}wolf${RESET}`);
});

test("the zone palette matches the designer's colors", () => {
  assert.deepEqual(FENRIR_PALETTE.A, [110, 143, 166]);
  assert.deepEqual(FENRIR_PALETTE.B, [216, 210, 200]);
  assert.deepEqual(FENRIR_PALETTE.C, [40, 34, 30]);
  assert.deepEqual(FENRIR_PALETTE.D, [242, 140, 40]);
  assert.deepEqual(FENRIR_PALETTE.E, [228, 87, 46]);
});

test("paintZonedArt maps each zone letter to its palette color", () => {
  for (const letter of LETTERS) {
    const painted = paintZonedArt(["█"], [letter])[0];
    assert.equal(painted, `${sgr(FENRIR_PALETTE[letter])}█${RESET}`, `zone ${letter}`);
  }
});

test("paintZonedArt coalesces a run into one SGR prefix and one reset", () => {
  const painted = paintZonedArt(["████"], ["DDDD"])[0];
  assert.equal(painted, `${sgr(FENRIR_PALETTE.D)}████${RESET}`);
  assert.equal(count(SGR_RE, painted), 1);
  assert.equal(count(RESET_RE, painted), 1);
});

test("paintZonedArt closes the previous run when the zone changes", () => {
  const painted = paintZonedArt(["███"], ["DDE"])[0];
  assert.equal(
    painted,
    `${sgr(FENRIR_PALETTE.D)}██${RESET}${sgr(FENRIR_PALETTE.E)}█${RESET}`,
  );
});

test("paintZonedArt leaves unpainted cells untouched and splits runs around them", () => {
  const painted = paintZonedArt(["███"], ["D.E"])[0];
  assert.equal(
    painted,
    `${sgr(FENRIR_PALETTE.D)}█${RESET}█${sgr(FENRIR_PALETTE.E)}█${RESET}`,
  );
  assert.equal(stripAnsi(painted), "███");
});

test("paintZonedArt never paints an art space, even with a zone", () => {
  const painted = paintZonedArt(["█ █"], ["DDD"])[0];
  assert.equal(
    painted,
    `${sgr(FENRIR_PALETTE.D)}█${RESET} ${sgr(FENRIR_PALETTE.D)}█${RESET}`,
  );
  assert.equal(paintZonedArt(["   "], ["DDD"])[0], "   ");
});

test("paintZonedArt tolerates a zone row narrower than the art (unpainted tail)", () => {
  const painted = paintZonedArt(["███"], ["D"])[0];
  assert.equal(painted, `${sgr(FENRIR_PALETTE.D)}█${RESET}██`);
});

test("paintZonedArt throws a TypeError when the two arguments differ in length", () => {
  assert.throws(() => paintZonedArt(["█"], []), TypeError);
  assert.throws(() => paintZonedArt([], ["D"]), TypeError);
});

test("paintZonedArt preserves the visible width of every line", () => {
  const lines = ["██  ██", "  ██  ", "██████"];
  const zones = ["DD..EE", "..DD..", "DDDEEE"];
  const painted = paintZonedArt(lines, zones);
  assert.equal(painted.length, lines.length);
  for (let i = 0; i < lines.length; i++) {
    assert.equal(visibleWidth(painted[i]), visibleWidth(lines[i]));
    assert.equal(stripAnsi(painted[i]), lines[i]);
  }
});

test("paintZonedArt never leaks an unclosed style", () => {
  const painted = paintZonedArt(["█.█ ███"], ["D.EDDDD"])[0];
  assert.equal(count(SGR_RE, painted), count(RESET_RE, painted));
  assert.equal(stripAnsi(painted), "█.█ ███");
});

test("dimmed art is strictly darker per channel than the normal palette", () => {
  for (const letter of LETTERS) {
    const normal = paintZonedArt(["█"], [letter], { dimmed: false })[0];
    const dimmed = paintZonedArt(["█"], [letter], { dimmed: true })[0];
    assert.notEqual(normal, dimmed, `zone ${letter} must change when dimmed`);
    const light = rgbOf(normal);
    const dark = rgbOf(dimmed);
    for (let channel = 0; channel < 3; channel++) {
      assert.ok(
        dark[channel] < light[channel],
        `zone ${letter} channel ${channel}: dim ${dark[channel]} must be darker than ${light[channel]}`,
      );
    }
  }
});

test("the shipped sigil survives painting at exactly its original width", async () => {
  const art = parseArtBlock(await readFile(new URL("../art/sigil.txt", import.meta.url), "utf8"));
  const zones = parseZoneMap(
    await readFile(new URL("../art/sigil.zones.txt", import.meta.url), "utf8"),
  );
  for (const dimmed of [false, true]) {
    const painted = paintZonedArt(art.lines, zones.rows, { dimmed });
    assert.equal(painted.length, art.lines.length);
    for (let row = 0; row < art.lines.length; row++) {
      assert.equal(visibleWidth(painted[row]), visibleWidth(art.lines[row]));
      assert.equal(stripAnsi(painted[row]), art.lines[row]);
      assert.equal(count(SGR_RE, painted[row]), count(RESET_RE, painted[row]));
    }
  }
});
