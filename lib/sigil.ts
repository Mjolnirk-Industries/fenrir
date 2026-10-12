// Pure banner art for the Fenrir header.
//
// Two fixed blocks -- the wolf sigil and the FENRIR wordmark -- plus a pure
// composer. The art is plain text: every line is padded to the block width and
// contains only characters understood by zoneOfChar, so color is decided per
// character by the renderer and never baked into the lines. Keep the blocks as
// readable line literals so they stay trivial to tweak visually.

export interface ArtBlock {
  /** Plain lines. Every line must be padded to exactly `width` code points. */
  lines: string[];
  width: number;
  height: number;
}

/** Color zone for one art character. */
export type ArtZone = "empty" | "contour" | "shade" | "ink" | "eye";

const ZONE_BY_CHAR: ReadonlyMap<string, ArtZone> = new Map<string, ArtZone>([
  [" ", "empty"],
  ["█", "contour"],
  ["▀", "contour"],
  ["▄", "contour"],
  ["▌", "contour"],
  ["▐", "contour"],
  ["▒", "shade"],
  ["▓", "ink"],
  ["●", "eye"],
]);

/** Map one art character to its color zone. Throws on anything else. */
export function zoneOfChar(ch: string): ArtZone {
  const zone = ZONE_BY_CHAR.get(ch);
  if (zone !== undefined) return zone;
  throw new TypeError(`zoneOfChar: unsupported art character ${JSON.stringify(ch)}`);
}

// Wolf head in profile, facing right: two pointed ears, a rounded skull, a
// dark muzzle jutting right on the eye line, and a receding jaw. 26 x 12.
// `█` is the contour, `▓` the dark muzzle, `●` the eye.
export const WOLF_SIGIL: ArtBlock = {
  width: 26,
  height: 12,
  lines: [
    "    █      █              ",
    "   ███    ███             ",
    "  █████  █████            ",
    " ███████████████          ",
    " █████████████████        ",
    " ███████●███████          ",
    " ██████████▓▓▓▓▓▓▓▓▓▓▓▓   ",
    "  █████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
    "  █████████████████████   ",
    "    ████████████████      ",
    "      ███████████         ",
    "        ███████           ",
  ],
};

// FENRIR in a 5x5 block font, letters separated by one blank column. 35 x 5.
export const FENRIR_WORDMARK: ArtBlock = {
  width: 35,
  height: 5,
  lines: [
    "█████ █████ █   █ ████  █████ ████ ",
    "█     █     ██  █ █   █   █   █   █",
    "████  ████  █ █ █ ████    █   ████ ",
    "█     █     █  ██ █  █    █   █  █ ",
    "█     █████ █   █ █   █ █████ █   █",
  ],
};

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
  const widest = truncated.reduce((max, line) => Math.max(max, lengthOf(line)), 0);
  return { lines: truncated.map((line) => padToWidth(line, widest)), sideBySide };
}
