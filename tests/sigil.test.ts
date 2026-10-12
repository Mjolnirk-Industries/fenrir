import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertZoneMapAligned,
  composeBanner,
  parseArtBlock,
  parseZoneMap,
} from "../lib/sigil.ts";
import type { ArtBlock, ZoneMap } from "../lib/sigil.ts";
import { visibleWidth } from "../lib/width.ts";

// The real, shipped art is part of the delivery: these tests read it from disk
// so a broken or misaligned drop fails the suite instead of rendering wrong.
const sigilText = await readFile(new URL("../art/sigil.txt", import.meta.url), "utf8");
const zoneText = await readFile(new URL("../art/sigil.zones.txt", import.meta.url), "utf8");
const wordmarkText = await readFile(new URL("../art/wordmark.txt", import.meta.url), "utf8");

const SIGIL = parseArtBlock(sigilText);
const ZONES = parseZoneMap(zoneText);
const WORDMARK = parseArtBlock(wordmarkText);

const VALID_ZONE = /^[ABCDE.]$/;

function codePoints(line: string): string[] {
  return Array.from(line);
}

test("parseArtBlock pads a short last row to the widest row", () => {
  const block = parseArtBlock("██\n█\n");
  assert.equal(block.width, 2);
  assert.equal(block.height, 2);
  assert.deepEqual(block.lines, ["██", "█ "]);
});

test("parseArtBlock handles CRLF and a missing trailing newline", () => {
  const crlf = parseArtBlock("██\r\n█\r\n");
  assert.equal(crlf.width, 2);
  assert.equal(crlf.height, 2);
  assert.deepEqual(crlf.lines, ["██", "█ "]);

  const noFinalNewline = parseArtBlock("██\n█");
  assert.deepEqual(noFinalNewline.lines, ["██", "█ "]);
  assert.equal(noFinalNewline.height, 2);
});

test("parseArtBlock drops exactly one trailing empty line", () => {
  const block = parseArtBlock("a\n");
  assert.equal(block.height, 1);
  assert.deepEqual(block.lines, ["a"]);

  const kept = parseArtBlock("a\n\n");
  assert.equal(kept.height, 2);
  assert.deepEqual(kept.lines, ["a", " "]);
});

test("parseZoneMap pads with dots, never with spaces", () => {
  const zones = parseZoneMap("DD\nE\n");
  assert.equal(zones.width, 2);
  assert.equal(zones.height, 2);
  assert.deepEqual(zones.rows, ["DD", "E."]);
});

test("assertZoneMapAligned accepts an aligned pair and tolerates a narrow zone row", () => {
  const art = parseArtBlock("██\n██\n");
  assert.doesNotThrow(() =>
    assertZoneMapAligned(art, parseZoneMap("DD\nDD\n")),
  );

  // A zone row narrower than the art is legal; the extra cells read as unpainted.
  const narrow: ZoneMap = { rows: ["D", "D"], width: 1, height: 2 };
  assert.doesNotThrow(() => assertZoneMapAligned(art, narrow));
});

test("assertZoneMapAligned rejects a row-count mismatch", () => {
  const art = parseArtBlock("██\n██\n");
  const zones: ZoneMap = { rows: ["DD"], width: 2, height: 1 };
  assert.throws(() => assertZoneMapAligned(art, zones), TypeError);
});

test("assertZoneMapAligned rejects an invalid letter and names it", () => {
  const art = parseArtBlock("██\n██\n");
  const zones = parseZoneMap("DX\n..\n");
  assert.throws(
    () => assertZoneMapAligned(art, zones),
    (error: unknown) =>
      error instanceof TypeError &&
      String((error as Error).message).includes("X") &&
      String((error as Error).message).includes("1") &&
      String((error as Error).message).includes("2"),
    "the message must name the offending character and its row and column",
  );
});

test("assertZoneMapAligned rejects a zone row wider than the art", () => {
  const art = parseArtBlock("██\n██\n");
  const zones = parseZoneMap("DDD\n...\n");
  assert.throws(() => assertZoneMapAligned(art, zones), TypeError);
});

test("the shipped sigil and zone map parse to the declared 40 x 15 grids", () => {
  assert.equal(SIGIL.width, 40);
  assert.equal(SIGIL.height, 15);
  assert.equal(ZONES.width, 40);
  assert.equal(ZONES.height, 15);
  assert.equal(WORDMARK.width, 35);
  assert.equal(WORDMARK.height, 5);
  assert.doesNotThrow(() => assertZoneMapAligned(SIGIL, ZONES));
});

test("the shipped sigil is entirely Braille patterns and spaces", () => {
  for (const line of SIGIL.lines) {
    for (const ch of line) {
      if (ch === " ") continue;
      const cp = ch.codePointAt(0) ?? 0;
      assert.ok(
        cp >= 0x2800 && cp <= 0x28ff,
        `${JSON.stringify(ch)} (U+${cp.toString(16).toUpperCase()}) is outside U+2800-U+28FF`,
      );
    }
  }
});

test("every shipped art line is single-cell wide: visibleWidth equals code points", () => {
  for (const line of [...SIGIL.lines, ...WORDMARK.lines]) {
    assert.equal(visibleWidth(line), codePoints(line).length);
  }
});

test("the shipped zone map uses only A B C D E .", () => {
  for (const row of ZONES.rows) {
    for (const ch of row) {
      assert.ok(VALID_ZONE.test(ch), `unexpected zone character ${JSON.stringify(ch)}`);
    }
  }
});

test("the shipped grids have zero glyph-without-zone and zone-without-glyph cells", () => {
  for (let row = 0; row < SIGIL.height; row++) {
    const art = codePoints(SIGIL.lines[row]);
    const zone = codePoints(ZONES.rows[row]);
    for (let col = 0; col < SIGIL.width; col++) {
      const glyph = art[col] !== " ";
      const painted = zone[col] !== ".";
      assert.equal(
        glyph,
        painted,
        `row ${row} column ${col}: glyph=${glyph} painted=${painted}`,
      );
    }
  }
});

test("composeBanner goes side by side at exactly 78 and stacks at 77", () => {
  const threshold = SIGIL.width + 3 + WORDMARK.width;
  assert.equal(threshold, 78);

  const wide = composeBanner({ sigil: SIGIL, wordmark: WORDMARK, width: threshold });
  assert.equal(wide.sideBySide, true);
  assert.equal(wide.lines.length, Math.max(SIGIL.height, WORDMARK.height));

  const narrow = composeBanner({ sigil: SIGIL, wordmark: WORDMARK, width: threshold - 1 });
  assert.equal(narrow.sideBySide, false);
  assert.equal(narrow.lines.length, SIGIL.height + WORDMARK.height);
});

test("composeBanner vertically centers the wordmark beside the taller sigil", () => {
  const out = composeBanner({ sigil: SIGIL, wordmark: WORDMARK, width: 78 });
  assert.equal(out.sideBySide, true);
  assert.equal(out.lines.length, SIGIL.height);

  const gap = 3;
  const wordmarkCol = SIGIL.width + gap;
  for (let row = 0; row < out.lines.length; row++) {
    const cells = codePoints(out.lines[row]);
    const left = cells.slice(0, SIGIL.width).join("");
    assert.equal(left, SIGIL.lines[row], `row ${row}: sigil side must be untouched`);

    const right = cells.slice(wordmarkCol, wordmarkCol + WORDMARK.width).join("");
    const wordmarkRow = row - 5;
    if (wordmarkRow >= 0 && wordmarkRow < WORDMARK.height) {
      assert.equal(right, WORDMARK.lines[wordmarkRow], `row ${row}: wordmark must be centered`);
    } else {
      assert.equal(right, " ".repeat(WORDMARK.width), `row ${row}: wordmark must be blank`);
    }
  }
});

test("composeBanner stacks the wordmark above the sigil", () => {
  const sigil: ArtBlock = { lines: ["sss"], width: 3, height: 1 };
  const wordmark: ArtBlock = { lines: ["www", "www"], width: 3, height: 2 };
  const out = composeBanner({ sigil, wordmark, width: 3 });
  assert.equal(out.sideBySide, false);
  assert.deepEqual(out.lines, ["www", "www", "sss"]);
});

test("composeBanner honors the gap including a custom value", () => {
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
    const out = composeBanner({ sigil: SIGIL, wordmark: WORDMARK, width });
    for (const line of out.lines) {
      assert.ok(
        visibleWidth(line) <= width,
        `width ${width}: ${visibleWidth(line)} > ${width} in ${JSON.stringify(line)}`,
      );
    }
  }
});
