// Pure coloring for the Fenrir header.
//
// Every color is an explicit truecolor SGR sequence built from an RGB tuple, so
// the banner and panel look the same regardless of the active Pi theme. The
// palette is the owner's measured wolf palette; the art zones are mapped here
// rather than baked into the art lines.

import { zoneOfChar } from "./sigil.ts";
import type { ArtZone } from "./sigil.ts";

export type Rgb = readonly [number, number, number];

export interface FenrirPalette {
  contour: Rgb;
  shade: Rgb;
  ink: Rgb;
  eye: Rgb;
  label: Rgb;
  value: Rgb;
  accent: Rgb;
  dim: Rgb;
}

const RESET = "\x1b[0m";

/** Truecolor foreground sequence for an RGB tuple, e.g. `\x1b[38;2;242;140;40m`. */
export function sgr(rgb: Rgb): string {
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
}

/** Wrap `text` in `rgb` and close it with a reset. `null` leaves the text alone. */
export function paint(text: string, rgb: Rgb | null): string {
  if (rgb === null) return text;
  return `${sgr(rgb)}${text}${RESET}`;
}

// Wolf orange contour, ember ink/accent, steel shade/label, ash eye/value, warm
// charcoal dim frame. `as const` tuples so consumers see exactly three channels.
export const FENRIR_PALETTE: FenrirPalette = {
  contour: [242, 140, 40],
  shade: [110, 143, 166],
  ink: [228, 87, 46],
  eye: [216, 210, 200],
  label: [110, 143, 166],
  value: [216, 210, 200],
  accent: [228, 87, 46],
  dim: [20, 17, 15],
};

function zoneColor(zone: ArtZone): Rgb | null {
  switch (zone) {
    case "contour":
      return FENRIR_PALETTE.contour;
    case "shade":
      return FENRIR_PALETTE.shade;
    case "ink":
      return FENRIR_PALETTE.ink;
    case "eye":
      return FENRIR_PALETTE.eye;
    case "empty":
      return null;
  }
}

// A real 50% darkening in RGB, not an opacity the terminal cannot express.
const DIM_FACTOR = 0.5;

function darken(rgb: Rgb): Rgb {
  return [
    Math.round(rgb[0] * DIM_FACTOR),
    Math.round(rgb[1] * DIM_FACTOR),
    Math.round(rgb[2] * DIM_FACTOR),
  ];
}

/**
 * Color one banner art line. Each character is routed through `zoneOfChar`; a
 * space (`empty`) stays unpainted, every other zone paints a run in its palette
 * color, and every run is closed with a reset. `{ dimmed: true }` darkens the
 * whole line so the animation can render it visibly darker.
 */
export function paintArtLine(line: string, options: { dimmed?: boolean } = {}): string {
  const dimmed = options.dimmed === true;
  let out = "";
  let runColor: string | null = null;

  const closeRun = (): void => {
    if (runColor !== null) {
      out += RESET;
      runColor = null;
    }
  };

  for (const ch of Array.from(line)) {
    const rgb = zoneColor(zoneOfChar(ch));
    if (rgb === null) {
      closeRun();
      out += ch;
      continue;
    }
    const color = sgr(dimmed ? darken(rgb) : rgb);
    if (color !== runColor) {
      closeRun();
      out += color;
      runColor = color;
    }
    out += ch;
  }

  closeRun();
  return out;
}
