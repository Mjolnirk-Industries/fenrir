// Pure banner art for the Fenrir header.
//
// The art is delivered as plain text files under art/ and parsed here into
// blocks, plus a zone map that assigns a color zone to every cell. The art
// itself carries no color: Braille glyphs encode density, not meaning, so the
// zone map is the only source of color. This module is deliberately
// file-system free -- the extension reads the files and hands the text over --
// so it stays trivially testable.

export interface ArtBlock {
  /** Plain lines. Every line is padded with spaces to exactly `width` code points. */
  lines: string[];
  width: number;
  height: number;
}

export interface ZoneMap {
  /** Zone letters, padded with `.` to exactly `width` code points per row. */
  rows: string[];
  width: number;
  height: number;
}

const ART_PAD = " ";
const ZONE_PAD = ".";

/** Split a grid on LR or CRLF line endings and drop exactly one trailing empty row. */
function splitGrid(text: string): string[] {
  const rows = text.split(/\r?\n/);
  if (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();
  return rows;
}

function widest(rows: string[]): number {
  return rows.reduce((max, row) => Math.max(max, Array.from(row).length), 0);
}

function padRight(row: string, width: number, pad: string): string {
  const current = Array.from(row).length;
  return current >= width ? row : row + pad.repeat(width - current);
}

/**
 * Parse one art grid. Rows are split on `\r?\n`, a single trailing empty line is
 * dropped, `width` is the maximum code-point count, and every short row is
 * padded with spaces. A short last row therefore never shrinks the block.
 */
export function parseArtBlock(text: string): ArtBlock {
  const rows = splitGrid(text);
  const width = widest(rows);
  const lines = rows.map((row) => padRight(row, width, ART_PAD));
  return { lines, width, height: lines.length };
}

/**
 * Parse one zone map. Behaves like `parseArtBlock`, but pads short rows with `.`
 * (unpainted) so a trailing row with no color reads as background.
 */
export function parseZoneMap(text: string): ZoneMap {
  const rows = splitGrid(text);
  const width = widest(rows);
  const padded = rows.map((row) => padRight(row, width, ZONE_PAD));
  return { rows: padded, width, height: padded.length };
}

const VALID_ZONE_CHARACTERS = new Set(["A", "B", "C", "D", "E", "."]);

/**
 * Verify a parsed zone map belongs to a parsed art block. Throws a `TypeError`
 * that names the offending character and its 1-based row and column when the
 * row counts differ, a zone row contains a character outside `A B C D E .`, or a
 * zone row is wider than the art.
 *
 * A zone row *narrower* than the art is explicitly tolerated: the cells past its
 * end have no zone and are left unpainted by the renderer.
 */
export function assertZoneMapAligned(art: ArtBlock, zones: ZoneMap): void {
  if (zones.height !== art.height) {
    throw new TypeError(
      `zone map has ${zones.height} row(s) but the art has ${art.height}`,
    );
  }

  for (let row = 0; row < zones.height; row++) {
    const cells = Array.from(zones.rows[row]);
    if (cells.length > art.width) {
      throw new TypeError(
        `zone row ${row + 1} is ${cells.length} column(s) wide but the art is ${art.width}`,
      );
    }
    for (let col = 0; col < cells.length; col++) {
      const ch = cells[col];
      if (!VALID_ZONE_CHARACTERS.has(ch)) {
        throw new TypeError(
          `unsupported zone character ${JSON.stringify(ch)} at row ${row + 1}, column ${col + 1}`,
        );
      }
    }
  }
}

export interface ComposeOptions {
  sigil: ArtBlock;
  wordmark: ArtBlock;
  width: number;
  gap?: number;
}

function sliceToWidth(line: string, max: number): string {
  const chars = Array.from(line);
  return chars.length <= max ? line : chars.slice(0, max).join("");
}

function padToWidth(line: string, width: number): string {
  const current = Array.from(line).length;
  return current >= width ? line : line + " ".repeat(width - current);
}

function lengthOf(line: string): number {
  return Array.from(line).length;
}

/**
 * Place the sigil and wordmark side by side when they fit, stacking them
 * (wordmark above sigil) otherwise. The shorter block is vertically centered.
 * Every output line is padded to the widest produced line and never exceeds
 * `width`. Pure: the block widths are taken as given.
 */
export function composeBanner(
  options: ComposeOptions,
): { lines: string[]; sideBySide: boolean } {
  const { sigil, wordmark } = options;
  const gap = Math.max(0, options.gap ?? 3);
  const cap = Number.isFinite(options.width) ? Math.max(0, Math.floor(options.width)) : 0;

  const sideBySide = sigil.width + gap + wordmark.width <= cap;

  let raw: string[];
  if (sideBySide) {
    const height = Math.max(sigil.height, wordmark.height);
    const sigilTop = Math.floor((height - sigil.height) / 2);
    const wordmarkTop = Math.floor((height - wordmark.height) / 2);
    const filler = " ".repeat(gap);
    raw = [];
    for (let row = 0; row < height; row++) {
      const left =
        row >= sigilTop && row < sigilTop + sigil.height ? sigil.lines[row - sigilTop] : "";
      const right =
        row >= wordmarkTop && row < wordmarkTop + wordmark.height
          ? wordmark.lines[row - wordmarkTop]
          : "";
      raw.push(`${padToWidth(left, sigil.width)}${filler}${padToWidth(right, wordmark.width)}`);
    }
  } else {
    raw = [...wordmark.lines, ...sigil.lines];
  }

  const truncated = raw.map((line) => sliceToWidth(line, cap));
  const widestLine = truncated.reduce((max, line) => Math.max(max, lengthOf(line)), 0);
  return { lines: truncated.map((line) => padToWidth(line, widestLine)), sideBySide };
}
