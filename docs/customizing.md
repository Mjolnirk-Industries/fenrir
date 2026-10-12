# Customizing Fenrir

Fenrir has **no config file and no preferences surface**. The only setting is the `FENRIR_DISABLE`
environment variable (any non-empty value skips the takeover). Everything else is a data file or
a constant in the source, so every change below is an edit to this repository plus a test run.

All paths are relative to the repository root. Run the suite after any change:

```sh
node --experimental-strip-types --test tests/*.test.ts
```

If you are testing edits locally, load the checkout for one session instead of using an
installed copy:

```sh
pi --extension ./extensions/fenrir.ts     # header only
pi --extension .                          # whole package, including the theme
```

---

## Replace the art

### Files

| File | What it holds |
| --- | --- |
| `art/sigil.txt` | The wolf head. Braille patterns (U+2800–U+28FF) and spaces. |
| `art/sigil.zones.txt` | The color zone map: one letter per cell, same grid as the sigil. |
| `art/wordmark.txt` | The `FENRIR` wordmark in block characters. No zone file: it is painted one color. |

The three files are read once per session by `loadBannerArt` in `extensions/fenrir.ts`.

### Format rules

Parsing is done by `parseArtBlock` and `parseZoneMap` in `lib/sigil.ts`:

- One character per terminal cell. Braille, block and box-drawing glyphs qualify; **emoji, CJK,
  combining marks and astral characters do not**. Width is counted in code points
  (`lib/width.ts`), so a multi-cell glyph silently breaks every alignment calculation.
- Rows are split on `\r?\n`. Exactly one trailing empty line is dropped; a missing final newline
  is fine.
- Rows **may be short**. The widest row defines the block width, and every shorter row is padded
  to it — art with spaces, zones with `.`. The shipped `art/sigil.txt` ends with a short row that
  is padded on load.
- **Both grids must have the same number of rows.** `assertZoneMapAligned` throws a `TypeError`
  naming the row counts otherwise.
- A zone row may be **narrower** than the art: the cells past its end are left unpainted. A zone
  row **wider** than the art is rejected.
- Zone characters must be one of `A B C D E` or `.`. Any other character is rejected with a
  `TypeError` that names the character and its 1-based row and column.

### The width budget

`composeBanner` in `lib/sigil.ts` places the sigil and wordmark **side by side** when they fit,
and **stacks** the wordmark above the sigil otherwise:

```text
sigil.width + gap + wordmark.width <= terminal columns   -> side by side
otherwise                                                -> stacked (wordmark above sigil)
```

The gap defaults to **3** columns. The shipped sizes are sigil **40**, wordmark **35**, giving a
threshold of `40 + 3 + 35 = 78`: side by side at 78 columns or wider, stacked at 77 or below. In
side-by-side mode the shorter block is vertically centred. Every output line is truncated to the
terminal width and padded to the widest produced line, so the header never exceeds the terminal.

The art sits above a generated info panel; the panel is not part of the art. See
[docs/design-brief.md](design-brief.md) for the recommended canvas (36–40 columns, 14–17 rows),
the hard maximum (44×18) and the technique-by-technique resolution ladder.

### Failure rule

If any of the three files cannot be read, parsed, or aligned, Fenrir installs **nothing at all**.
It emits a single warning notification — `Fenrir header not installed: <reason>` — and leaves Pi's
built-in header in place. A malformed delivery never renders wrong on screen.

### How the tests validate a new delivery

`tests/sigil.test.ts` reads the shipped grids from disk, so a new delivery is checked by running
the suite. It asserts:

- the sigil parses to **40 × 15**, its zone map to **40 × 15**, and the wordmark to **35 × 5**;
- the sigil is entirely Braille patterns and spaces;
- every art and wordmark line is single-cell wide (`visibleWidth` equals the code-point count);
- the zone map uses only `A B C D E .`;
- there are **zero** glyph-without-zone and zero zone-without-glyph cells;
- `composeBanner` goes side by side at exactly 78 and stacks at 77;
- no composed line exceeds the requested width across a sweep of widths from 20 to 200.

If you change the dimensions, the exact-size and threshold assertions in `tests/sigil.test.ts`
must be updated to the new sizes. The single-cell, zone-character and alignment checks adapt to
the new art automatically.

---

## Change the colors

### The zone palette

The zone letter → RGB map lives in `lib/style.ts` as `FENRIR_PALETTE`:

| Letter | Meaning | Color | Hex | RGB |
| --- | --- | --- | --- | --- |
| `A` | outline, structure | steel | `#6E8FA6` | `[110, 143, 166]` |
| `B` | bright face, highlights | ash | `#D8D2C8` | `[216, 210, 200]` |
| `C` | shadow, silhouette fill | dark stone | `#28221E` | `[40, 34, 30]` |
| `D` | signature accent and the eye | wolf orange | `#F28C28` | `[242, 140, 40]` |
| `E` | embers, hot details | ember | `#E4572E` | `[228, 87, 46]` |
| `.` | nothing | — | the cell is left unpainted | — |

`paintZonedArt` (same file) resolves each cell's letter to a truecolor SGR foreground. Maximal
runs of one zone share a single prefix and a single reset, so every line closes what it opens. A
space or a `.` is passed through unpainted. Colors are explicit RGB sequences, so the art looks
the same under every Pi theme.

To **repaint without changing the palette**, edit `art/sigil.zones.txt`: swap the letters. To
**change a tone**, edit the RGB triple in `FENRIR_PALETTE`. The shipped art currently uses only
`B` (30 cells), `D` (116) and `E` (84) — **letters `A` and `C` are defined but unused**, so you
can introduce steel and dark stone purely as a data edit in the zone map.

### Add a sixth tone (code change)

The palette is capped at the five letters the renderer understands. A sixth tone requires code:

1. `lib/style.ts` — add the letter to the `ZoneLetter` union, add its RGB triple to
   `FENRIR_PALETTE`, and accept it in the `isZoneLetter` guard.
2. `lib/sigil.ts` — add the letter to `VALID_ZONE_CHARACTERS`.
3. Tests — extend `tests/sigil.test.ts` (`VALID_ZONE` regex) and `tests/style.test.ts` (the
   `LETTERS` array and the palette assertions).
4. Then use the new letter in `art/sigil.zones.txt`.

### The theme is separate

`themes/Fenrir.json` restyles the rest of the Pi interface — messages, borders, syntax
highlighting, tool output, status colors. It does **not** affect the banner art: the art's colors
come from `FENRIR_PALETTE` and are emitted directly, independent of the active theme. To change
the banner, edit the palette or the zone map. To change everything around it, edit the theme and
select it in `/settings` (Fenrir never auto-applies it — `package.json` has no `pi.theme` key).

---

## Change the wordmark color

`art/wordmark.txt` ships without a zone grid, so `loadBannerArt` generates one at load: every
non-space cell becomes the single constant `WORDMARK_ZONE` in `extensions/fenrir.ts`.

```ts
const WORDMARK_ZONE: ZoneLetter = "B";   // ash
```

Change this one constant to any zone letter (`A`–`E`) from the palette. Spaces stay `.`, so they
remain unpainted. If you want the wordmark to carry more than one color, give it a real zone file
and wire it in like the sigil's — today it is deliberately a single tone.

---

## Change the panel

Two modules split the work:

- `lib/collect.ts` — gathers the nine fields. Every external effect (file reads, `git`,
  `readdir`, command and tool lists, host version) is injected; no collector ever throws, and each
  failure degrades a single field to its placeholder or `0`. Git falls back to the literal
  `Not a git repo`.
- `lib/panel.ts` — `buildRows` defines the labels, the value formats, and the wide/narrow
  ordering; `buildPanelLines` lays them out.

### The nine fields

| Label | Value format | Source (`lib/collect.ts`) |
| --- | --- | --- |
| `GIT:` | branch name | `git rev-parse --abbrev-ref HEAD` in the session cwd; detached HEAD becomes `detached@<short sha>`, failure becomes `Not a git repo` |
| `PATH:` | working directory | the session cwd |
| `MCP:` | `N server(s)` | keys under `mcpServers` in `<agentDir>/mcp.json` |
| `PLUGINS:` | `N package(s)` | array length of `packages` in `<agentDir>/settings.json` |
| `AGENTS:` | `N agents` | `*.md` files in `<agentDir>/agents`, excluding `sdd-*` |
| `SKILLS:` | `N loaded` | `pi.getCommands()` entries whose `source === "skill"` |
| `EXTENSIONS:` | `N active` | `pi.extensions` entries declared by each installed package under `<agentDir>/npm/node_modules` |
| `VER:` | `v<version>` | `VERSION` from `@earendil-works/pi-coding-agent` |
| `TOOLS:` | `N custom` | `pi.getAllTools()` entries whose `sourceInfo.source` is not `builtin` or `sdk` |

Panel colors come from `PANEL_STYLE` in `extensions/fenrir.ts`: labels use palette **`A`**
(steel), values use **`B`** (ash), and the git branch accent uses **`E`** (ember).

### Reorder, relabel, reformat

`buildRows` builds two arrays, `wide` (label pairs per row) and `narrow` (one field per row).
Reorder both to reorder the panel; change a `label` field to relabel; change the template string
to change a value format. The label column is padded to the widest label in the block —
`EXTENSIONS:` today — which sets the minimum usable width.

Update `tests/panel.test.ts` alongside any of these: the `LABELS` array, the "value formats"
test, and the wide-pairing assertions.

### Add a field (two modules plus tests)

1. `lib/collect.ts` — add the property to the `PanelData` interface, add a collector that uses
   the injected dependencies and degrades to a placeholder or `0` on failure, add it to the
   returned object, and add it to the never-throws fallback object at the bottom of
   `collectPanelData`.
2. `lib/panel.ts` — add a `Cell` and place it in both the `wide` and `narrow` arrays.
3. Tests — `tests/collect.test.ts` (the new field, including its failure path) and
   `tests/panel.test.ts` (row counts change; the structured assertions below assume nine fields).

### The two-column threshold

`lib/panel.ts` defines `WIDE_MIN_WIDTH = 122`. At 122 columns and wider the panel uses two column
pairs (five rows); below that it uses one column (nine rows). `tests/panel.test.ts` asserts the
flip exactly between 121 and 122, and its width sweeps assert `width >= 122 ? 5 : 9` rows — update
those if you add or remove a field.

---

## Change the animation

All timing is in `lib/anim.ts`; the wiring is in `extensions/fenrir.ts`.

| Constant / function | Meaning |
| --- | --- |
| `DEFAULT_ANIM_PLAN = { frameCount: 32, tickMs: 40 }` | 32 ticks at 40 ms → about **1.3 seconds** |
| `revealFraction(tick, plan)` | `clamp01(tick / frameCount)` |
| `revealRows(rows, fraction)` | reveals rows **bottom-up**; a partly revealed row keeps its left-hand share of its width. Row count and each row's width are preserved |
| `isFrozen(tick, plan)` | `tick >= frameCount` — the freeze rule |
| `opacityFor(tick, plan)` | a 0→1 ramp over the first third. Exported and tested, but **not used by the wiring today** |

In `extensions/fenrir.ts` the renderer schedules `step` every `tickMs`. Each step increments the
tick, checks `isFrozen`, and — once frozen — sets the frozen flag, clears the cache and stops
rescheduling. While animating, `render` reveals the banner with `revealRows` and paints it with
`paintZonedArt(..., { dimmed: true })`; the dim is a constant 55 % brightness reduction, not a
per-frame fade. Once frozen, the art is painted at full colour and served from a per-width cache.
`dispose` cancels the timer.

- **Shorter or longer:** change `frameCount` and/or `tickMs`. Duration is roughly
  `frameCount * tickMs`. For example `{ frameCount: 16, tickMs: 30 }` is about 0.5 s.
- **Turn the reveal off:** set `frameCount: 0`. `revealFraction` then returns 1 immediately and
  `isFrozen` is true at tick 0, so the art is fully revealed from the first render. The renderer
  still schedules one step, so the first frame is painted dimmed and brightens on the first
  tick — there is no separate "no animation at all" flag today. Removing the timer entirely would
  be a small code change, clearly marked here as **not implemented**.

**Hard rule:** the animation is one-shot at startup. After the last frame the header must be
static and cached, with no timer left running — no pulsing, glow, or permanent repaint loop. Any
change you make must preserve that: once `isFrozen` is true, `step` must stop rescheduling.

> Not implemented: keyframe playback (three to five art grids played in order) and a
> left-to-right reveal direction are described as *possible deliveries* in
> [docs/design-brief.md](design-brief.md), but the renderer only implements the bottom-up reveal
> with a constant dim. Supporting keyframes would mean adding a plan that holds multiple grids
> and a new selection step in `lib/anim.ts`. It does not exist yet.

---

## Tune the takeover

The gated install and bounded reclaim live in `lib/header-owner.ts`:

| Option | Default constant | Meaning |
| --- | --- | --- |
| `installDelayMs` | `DEFAULT_INSTALL_DELAY_MS = 300` | wait before claiming the header slot the first time |
| `reclaimDelayMs` | `DEFAULT_RECLAIM_DELAY_MS = 400` | wait before re-claiming after losing the slot |
| `maxReclaims` | `DEFAULT_MAX_RECLAIMS = 3` | reclaim budget; when spent, the phase becomes `gave-up` |

`extensions/fenrir.ts` constructs `new HeaderOwner(deps, build)` with no options, so the defaults
above are what ships. To change the timing, edit the constants (or pass a `HeaderOwnerOptions`
object at construction).

- **The symptom that calls for raising `installDelayMs`:** our header appears, then is replaced
  by the upstream banner shortly after startup. That means the upstream banner installed *after*
  Fenrir. Raising the install delay makes Fenrir's install land later, so it is the last writer.
  Since the last writer wins, "later" is the whole mechanism.
- When the slot is lost, Fenrir notifies `Fenrir header lost the slot; reclaiming (n/max).`,
  waits `reclaimDelayMs`, and re-installs. Raising `maxReclaims` lets it fight longer before it
  gives up cleanly; raising `reclaimDelayMs` paces the retries.
- `/fenrir:status` reports the phase, reclaim count, render count and last width;
  `/fenrir:reinstall` re-asserts immediately, still bounded by the same budget.

---

## Validate a change

### Automated

```sh
node --experimental-strip-types --test tests/*.test.ts
```

What the suite checks about the art (see `tests/sigil.test.ts`): the declared grid sizes, that the
sigil is Braille-only, that every line is single-cell wide, that zones use only `A B C D E .`,
that there are no glyph-without-zone or zone-without-glyph cells, that the composition threshold
is exactly 78 (side by side) / 77 (stacked), and that no composed line exceeds the width across a
20–200 sweep. `tests/style.test.ts` pins the palette RGB values and the run-length painting;
`tests/anim.test.ts` pins the tick → reveal → freeze behaviour; `tests/panel.test.ts` pins the
nine labels, the value formats and the 121/122 layout flip; `tests/header-owner.test.ts` pins the
deferred install, the loss signal and the reclaim budget.

### Manual smoke check

In a real terminal, from the repository root:

```sh
pi --extension ./extensions/fenrir.ts
# or, to include the theme: pi --extension .
```

Then confirm:

1. The Fenrir banner and panel are the header, not Pi's built-in banner.
2. The animation plays once and then stops — no continued repainting.
3. `/fenrir:status` reports `phase=owned` with a `renders` count that keeps rising as you resize.
4. `/fenrir:reinstall` re-claims without error and the phase goes back to `owned`.
5. Resize across 77/78 columns: the wordmark should switch between stacked and side by side.
   Resize across 121/122: the panel should switch between one and two columns.
6. Restart with `FENRIR_DISABLE=1 pi` and confirm Pi's built-in header comes back.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Nothing appears; Pi's built-in header is shown | `FENRIR_DISABLE` is set to any non-empty value, the session has no TUI, the art failed to load, or the slot was lost | Unset `FENRIR_DISABLE`. Look for a `Fenrir header not installed: …` notification (art). Run `/fenrir:status`: if it says `not active`, the extension did not start. |
| The upstream banner wins shortly after startup | The upstream banner installed after Fenrir and took the slot | Raise `installDelayMs` (`DEFAULT_INSTALL_DELAY_MS`). Use `/fenrir:reinstall` for a one-off; check the phase with `/fenrir:status`. |
| The header shows but the art is missing | A read, parse or alignment failure in one of the three art files | Read the `Fenrir header not installed: …` message — it names a bad character and its row/column for a zone-map error. Fix the file and run the suite. |
| Colors look wrong | The terminal is not truecolor, or you edited the theme expecting the banner to change | Confirm truecolor in the terminal. Remember the art colors come from `FENRIR_PALETTE`, not `themes/Fenrir.json`. |
| Colors look dim at startup and never brighten | The art is painted at 55 % while animating and only painted full colour after the freeze tick; if it never brightens, the freeze tick never ran | Check that `frameCount > 0` and that nothing threw during the animation. A frozen header serves full colour from its cache. |
| The header is taller than expected | The art is oversized, or the terminal is too narrow for side-by-side so the wordmark is stacked above the sigil | Reduce the art's row/column count (see the canvas budget in [docs/design-brief.md](design-brief.md)), or widen the terminal to 78+ columns so the two blocks sit beside each other. |
| Alignment breaks; columns shift between rows | A multi-cell character (emoji, CJK, combining mark, astral) in the art, or a zone row wider than the art | Use single-cell glyphs only. The suite rejects a zone row wider than the art and checks that every line is single-cell wide. |
| The wordmark is clipped or missing | The composed line is wider than the terminal and is truncated to the terminal width | Keep `sigil.width + 3 + wordmark.width` within the terminals you target, or reduce the art width. The header is never allowed to exceed the terminal width. |
