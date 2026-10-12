// Width primitives for Fenrir's own single-width art and panel text.
//
// The art and panel strings are single-width by construction, so one code point
// equals one terminal cell. ANSI SGR sequences are invisible and must be
// stripped before counting. Deliberately dependency-free: no width library.

const ANSI_CSI_SGR = /\x1b\[[0-9;]*m/g;
const ELLIPSIS = "…";

function stripAnsi(text: string): string {
  return text.replace(ANSI_CSI_SGR, "");
}

/** Visible width of `text`: code points after stripping ANSI SGR sequences. */
export function visibleWidth(text: string): number {
  return Array.from(stripAnsi(text)).length;
}

/**
 * Return `text` unchanged when it fits in `max` columns. Otherwise truncate and
 * end with a single-width ellipsis, reserving one column for it. `max <= 0`
 * yields the empty string; `max === 1` may yield just the ellipsis.
 *
 * A leading SGR sequence is preserved and explicitly closed with a reset, so a
 * styled value that gets truncated keeps its color instead of silently
 * losing it. Styling that starts mid-string (multi-segment lines) is dropped by
 * the strip step: the result is unstyled but always safe, never leaking an
 * unclosed style into the following line.
 */
export function truncateToWidth(text: string, max: number): string {
  if (max <= 0) return "";
  if (visibleWidth(text) <= max) return text;
  const chars = Array.from(stripAnsi(text));
  const body = chars.slice(0, max - 1).join("") + ELLIPSIS;
  const leading = /^(?:\x1b\[[0-9;]*m)+/.exec(text)?.[0] ?? "";
  return leading ? `${leading}${body}\x1b[0m` : body;
}

/** Pad `text` with spaces to `width`. Never truncates. */
export function padEndToWidth(text: string, width: number): string {
  const current = visibleWidth(text);
  if (current >= width) return text;
  return text + " ".repeat(width - current);
}
