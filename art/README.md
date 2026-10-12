# Art data

The banner art as plain text, so it can be edited without touching code. These files are the
source of truth; the renderer parses them at startup.

| File | What it is |
| --- | --- |
| `sigil.txt` | The wolf head. Braille patterns (U+2800–U+28FF) and spaces. |
| `sigil.zones.txt` | Color zones, same grid, one letter per cell. |
| `wordmark.txt` | The `FENRIR` wordmark in block characters. No zone file: it is painted one color. |

## Rules

- One character per terminal cell. Braille patterns and block elements qualify; emoji, CJK and
  combining marks do not.
- Rows do not need to be padded. `parseArtBlock` pads every row with spaces to the widest row,
  and `parseZoneMap` pads with `.`, so short rows are safe as long as both grids are
  left-anchored.
- Both grids must have the same number of rows. A row of the zone map is aligned with the same
  row of the art.

## Zone letters

| Letter | Color | Hue |
| --- | --- | --- |
| `A` | steel | `#6E8FA6` |
| `B` | ash | `#D8D2C8` |
| `C` | dark stone | `#28221E` |
| `D` | wolf orange | `#F28C28` |
| `E` | ember | `#E4572E` |
| `.` | nothing | the cell is left unpainted |

Any other character is rejected with a `TypeError` naming it, so a typo fails the tests instead
of painting the wrong color. A test asserts that the shipped grids have no art cell without a
zone and no painted zone without a glyph.

See `docs/design-brief.md` for the canvas budget, the resolution ladder per technique, and the
acceptance checklist.
