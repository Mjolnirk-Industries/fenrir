// Pure coloring for the Fenrir header.
//
// Every color is an explicit truecolor SGR sequence built from an RGB tuple, so
// the banner and panel look the same regardless of the active Pi theme. The
// zone palette is the designer's: the sigil's zone map selects a letter per
// cell and the letter is resolved here, never baked into the art.

export type Rgb = readonly [number, number, number];

export type ZoneLetter = "A" | "B" | "C" | "D" | "E";

/**
 * The designer's zones. `A` steel (outline, structure), `B` ash (bright face,
 * highlights), `C` dark stone (shadow, silhouette fill), `D` wolf orange
 * (signature accent and the eye) and `E` ember (hot details).
 */
export const FENRIR_PALETTE: Record<ZoneLetter, Rgb> = {
  A: [110, 143, 166],
  B: [216, 210, 200],
  C: [40, 34, 30],
  D: [242, 140, 40],
  E: [228, 87, 46],
};

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

function isZoneLetter(letter: string | undefined): letter is ZoneLetter {
  return (
    letter === "A" ||
    letter === "B" ||
    letter === "C" ||
    letter === "D" ||
    letter === "E"
  );
}

// A real 55% reduction in RGB, not an opacity the terminal cannot express. Each
// channel is floored so a dimmed run is always strictly darker than the normal
// palette (no channel of any zone maps to itself).
const DIM_FACTOR = 0.55;

function dim(rgb: Rgb): Rgb {
  return [
    Math.floor(rgb[0] * DIM_FACTOR),
    Math.floor(rgb[1] * DIM_FACTOR),
    Math.floor(rgb[2] * DIM_FACTOR),
  ];
}

/**
 * Color art lines from a zone map, one line of art to one line of zones.
 *
 * Maximal runs of the same zone share a single SGR prefix and a single reset at
 * the end of the run, so a line closes every style it opens. A cell whose zone
 * is `.`, or whose art character is a space, passes through unchanged; a zone
 * row shorter than its art line simply leaves the tail unpainted. `{ dimmed:
 * true }` scales every channel down for the startup fade-in.
 *
 * Throws a `TypeError` when `artLines` and `zoneRows` differ in length.
 */
export function paintZonedArt(
  artLines: string[],
  zoneRows: string[],
  options: { dimmed?: boolean } = {},
): string[] {
  if (artLines.length !== zoneRows.length) {
    throw new TypeError(
      `paintZonedArt: ${artLines.length} art line(s) but ${zoneRows.length} zone row(s)`,
    );
  }

  const dimmed = options.dimmed === true;

  return artLines.map((line, row) => {
    const cells = Array.from(line);
    const zones = Array.from(zoneRows[row] ?? "");
    let out = "";
    let openColor: string | null = null;

    const closeRun = (): void => {
      if (openColor !== null) {
        out += RESET;
        openColor = null;
      }
    };

    for (let col = 0; col < cells.length; col++) {
      const ch = cells[col];
      const letter = zones[col];
      const rgb = ch === " " || !isZoneLetter(letter) ? null : FENRIR_PALETTE[letter];

      if (rgb === null) {
        closeRun();
        out += ch;
        continue;
      }

      const color = sgr(dimmed ? dim(rgb) : rgb);
      if (color !== openColor) {
        closeRun();
        out += color;
        openColor = color;
      }
      out += ch;
    }

    closeRun();
    return out;
  });
}
