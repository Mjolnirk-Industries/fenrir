# Fenrir banner — art brief

For whoever draws the art. Everything here is a hard technical constraint of the terminal
renderer; within them the design is free.

## What the art is for

The package claims Pi's header slot at startup and paints, top to bottom:

```
   ┌────────────────────────────────────────────────────────────┐
   │   WOLF SIGIL          FENRIR                               │   <- banner art
   │                                                            │
   │   GIT:            main            MCP:  3 server(s)        │   <- info panel
   │   PATH:           /e/HomeLab      PLUGINS:  4 package(s)   │
   │   ...                                                      │
   └────────────────────────────────────────────────────────────┘
```

The banner is the brand. The panel below it is generated from live data and is **not** part of
the art.

## Hard constraints

1. **One terminal cell per character.** No emoji, no CJK, no combining marks, no astral
   characters. Anything wider than one cell breaks every alignment calculation.
2. **Monospace grid.** Each character is exactly one column, each line is one row.
3. **Plain text.** No color codes inside the art. Color is applied afterwards from a separate
   zone map (see *Delivery format*), so the art must be readable as raw characters.
4. **Rendered at the top of the session, above the editor.** Height costs the user screen space,
   so shorter is better for the same legibility.

## Canvas

| | Columns | Rows |
| --- | --- | --- |
| Current art (replaceable) | 26 | 12 |
| Upstream precedent (their rose) | 37 | 17 |
| **Recommended** | **36 to 40** | **14 to 17** |
| Maximum | 44 | 18 |
| Minimum | 24 | 10 |

Why the recommendation: at 36 columns the head is legible; beyond 44 the banner starts pushing
the transcript off screen at common terminal heights. The upstream rose occupies 37x17, so a
Fenrir wolf of the same footprint is well within precedent.

### Width budget

The sigil sits **beside** the wordmark when both fit, with a 3-column gap, and **stacks** above
it when they do not:

```
sigil.width + 3 + wordmark.width <= terminal columns   -> side by side
otherwise                                              -> stacked
```

The wordmark is 35 columns wide (redesignable, see below). So:

- 40-column sigil: `40 + 3 + 35 = 78` fits in an 80-column terminal, comfortably in 100+.
- 44-column sigil: `82` needs an 82-column terminal, so it stacks on narrower ones.

## Delivery format

**Recommended: two grids.** Deliver the art and a same-size zone map, character for character.
This is required whenever the art uses Braille or more than one shade per glyph.

```
ART (36x14)                       ZONES (36x14)
     ▄█▄    ▄█▄                        A A A    A A A
    █████  █████                       AAAAA  AAAAA
   ...                                ...
```

Zone letters, and the color each one becomes:

| Letter | Meaning | Color | Hex |
| --- | --- | --- | --- |
| `A` | Outline, ears, structure | steel | `#6E8FA6` |
| `B` | Bright face, highlights | ash | `#D8D2C8` |
| `C` | Shadow, dark mass, silhouette fill | dark stone | `#28221E` |
| `D` | Signature accent and the eye | wolf orange | `#F28C28` |
| `E` | Embers, hot details | ember | `#E4572E` |
| `.` or space | Background, painted nothing | — | — |

This decouples the drawing from the coloring: any glyph can carry any zone, and the number of
shades is limited only by the six palette entries.

**Alternative: single grid.** Use only the characters the renderer already understands, one
color per character:

- outline: `█ ▀ ▄ ▌ ▐`
- shading: `▒` (mid) `▓` (dark)
- eye: `●`

Any character outside that list is rejected by a test rather than rendered wrong, so a typo in
the art fails the build instead of looking broken on screen.

### Character palette that is safe to use

All of these are single-cell and safe in any monospace font:

```
Block:      █ ▀ ▄ ▌ ▐ ░ ▒ ▓
Quads:      ▖ ▗ ▘ ▝ ▙ ▚ ▛ ▜ ▟ ▞
Lines:      ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ═ ║ ╔ ╗ ╚ ╝
Corners:    ◢ ◣ ◤ ◥ ◸ ◹ ◺ ◿
Geometric:  ● ○ ◆ ◇ ▲ ▼ ◀ ▶
```

### Resolution: the technique that decides everything

This is the difference between a legible wolf and a blob, and it is not about artistic skill —
it is about how many dots the design gets inside one terminal cell.

| Technique | Dots per cell | A 36x16 grid behaves like | Safety |
| --- | --- | --- | --- |
| `█` solid blocks | 1 | 36x16 | universal |
| Half and quadrant blocks `▀ ▄ ▌ ▐ ▖ ▗ ▘ ▝ ▙ ▟ ▛ ▜ ▚ ▞` | 2 to 4 | up to 72x32 | universal |
| **Braille patterns** `U+2800` to `U+28FF` | **8** (a 2x4 dot matrix) | **72x64** | proven on this machine |

**Braille is the technique the upstream rose uses, and it is why it reads as a rose.** It is
37 columns wide and drawn entirely from the Braille block (104 distinct glyphs, most used
`⣿ ⣀ ⠈ ⠛ ⠉`). See `docs/reference/upstream-rose-example.md` for the full art, the measured
glyph inventory, and the caveats. The current Fenrir wolf is drawn with plain `█`, so it gets
one dot per cell: that is the diagnosis of its weak look, not the choice of subject.

If Braille is used, the zone map is **mandatory**: a Braille glyph is a density, not a meaning,
so color cannot be derived from the character. The designer still cannot pick arbitrary colors
per dot, only per zone, but eight-zone shading is more than enough for a metal-and-fire wolf.

Recommendation: **half and quadrant blocks as the safe baseline, Braille if the extra
resolution is needed for the muzzle and the eye.**

## What must appear

A **geometric wolf head in profile, facing left**. The delivered art is the authority on
orientation: an earlier revision of this brief said "facing right" and it was wrong. Specifically
legible:

1. Two pointed ears, clearly separated by a valley.
2. A muzzle projecting to the right, distinct from the skull mass.
3. An eye on the profile line, in the accent color. This is the focal point.
4. A neck or shoulder line closing the bottom, so the head does not float.
5. No fur texture, no gradients, no photorealism: straight and angled strokes, flat masses.

It must read as a wolf at the delivered size and **without color** (test it in plain text).

## The wordmark (optional redesign)

`FENRIR` in block letters, currently 35 columns by 5 rows: 5x5 letters with 1-column gaps.
If you redesign it, stay within 46 columns and 5 to 7 rows, and keep the same two-grid delivery
option. Same character rules.

## Delivered art

The first accepted delivery lives in `art/`:

| File | Size | Notes |
| --- | --- | --- |
| `art/sigil.txt` | 40 x 15 | Braille only; the last row is short and is padded on load |
| `art/sigil.zones.txt` | 40 x 15 | Zone letters, aligned cell for cell with the sigil |
| `art/wordmark.txt` | 35 x 5 | Block letters, no zones (painted as a single color) |

Zones used: `D` 116 cells, `E` 84, `B` 30. Effective resolution 80 x 60 dots. Measured zero art
cells without a zone and zero painted zones without a glyph.

## The intro animation

The animation runs **once, at startup, and then stops for good** — no continuous repainting.

- 32 frames at 40 ms each: about **1.3 seconds**.
- Frame budget is fixed; the art does not need to be animated by the designer.

What happens in those frames today: the art is revealed bottom-up (it rises), and while the
reveal is running the whole banner is painted at 55 percent brightness; at the freeze tick it
switches to full brightness. There is no opacity ramp in between.

What the designer **can** deliver instead, if they want a real intro:

- **Keyframes.** 3 to 5 grids of the same size, played in order. Example arc: a low silhouette →
  the head fully risen → the eye ignites in the accent color → settled. Each keyframe follows
  the same format and rules as the final art.
- **A reveal direction.** Bottom-up (default), or left-to-right contour trace.

Hard rule: after the last frame the header must be static and cached. No pulsing, no glow
loops, no timers left running.

## The info panel (generated, not drawn)

Nine fields, always in this order:

| Label | Value format | Source |
| --- | --- | --- |
| `GIT:` | branch name | current repository |
| `PATH:` | working directory | session |
| `MCP:` | `N server(s)` | `mcp.json` |
| `PLUGINS:` | `N package(s)` | `settings.json` |
| `AGENTS:` | `N agents` | agent directory |
| `SKILLS:` | `N loaded` | registered skills |
| `EXTENSIONS:` | `N active` | package extensions |
| `VER:` | `v…` | host version |
| `TOOLS:` | `N custom` | registered custom tools |

Layout: two column pairs at 122 terminal columns and wider, a single column below that. Labels
are steel, values are ash, and the git branch is ember. The label column is padded to the widest
label (`EXTENSIONS:`), which sets the minimum usable width.

## Acceptance checklist

The design is accepted when:

- Every line is exactly the declared width, padded with spaces.
- Every character is one terminal cell.
- Only characters from the safe list are used, or a zone map is supplied.
- Each zone letter is one of `A B C D E . ` and the map is the same size as the art.
- The wolf reads as a wolf in plain text, without color.
- The block fits the canvas budget, and sigil plus wordmark fit side by side at 100 columns.
