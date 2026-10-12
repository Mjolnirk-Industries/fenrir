# Reference: the upstream rose (format study)

This is the banner art that ships with `gentle-shell`, extracted from `ROSE_LARGE_RAW` in its
`extensions/startup-banner.ts`. It is included **only as a format and quality reference** for
whoever designs the Fenrir wolf. Do not copy the rose itself: it is upstream's brand, MIT
licensed code or not.

## Measured

| | |
| --- | --- |
| Size | **37 columns x 17 rows** |
| Filled cells | 387 of 629 (62%) |
| Unique glyphs | 104, all from the Braille Patterns block (U+2800–U+28FF) |
| Most used | `⣿` x37, `⣀` x13, `⠈` x13, `⠛` x12, `⠉` x11 |
| Block or line-drawing characters | none |

## The point: Braille gives eight dots per cell

Every character here is a Braille pattern. One Braille cell is a 2x4 matrix of dots inside the
space of a single terminal cell, so a 37x17 grid drawn this way has an effective resolution of
**74 columns x 68 rows**.

That is the entire technique. It is why this rose reads as a rose at 37 columns wide while a
wolf drawn with `█` at 26 columns reads as a blob: solid blocks give one pixel per cell, Braille
gives eight.

Two consequences for the Fenrir design:

1. **Use Braille if the design needs real detail.** Same canvas budget, eight times the
   resolution.
2. **A zone map becomes mandatory.** With Braille, color cannot be inferred from the character:
   `⣿` is a density, not a semantic. Color has to come from a second grid of the same size
   holding one zone letter per cell. That is exactly the two-grid delivery format the brief asks
   for, and this rose is why it is the recommended path rather than an option.

## Caveats before committing to Braille

- Braille renders correctly in the terminals where the upstream banner already runs, so it is
  proven on this machine. It is not universally safe: a font without Braille glyphs shows
  boxes, and a few fonts render the block double-width, which would break alignment.
  Half and quadrant blocks (`▀ ▄ ▌ ▐ ▖ ▗ ▘ ▝ ▙ ▟ ▛ ▜ ▚ ▞`) are the fallback: only 2x the
  resolution, but safe everywhere.
- The renderer measures one code point per column, which holds for Braille and for the block
  characters. Any glyph of ambiguous width would break the panel alignment below the art.

## The art, verbatim

```
             ⣠⣾⣷⣶⣦⣤⣤⣄⣠⣄⣀  ⢀⣀⣀
          ⢀⣴⣿⣿⠿⣋⣭⣭⣯⣭⣍⣭⣿⣟⠛⠛⠿⣿⣷⣄
      ⢀⣴⣾⡟⢻⣿⡟⠁⣼⣿⠏⣵⢻⣿⣻⣿⣿⢿⡻⣿⣿⣶⡌⢿⣿⣷⣦⣤⡄
   ⣤⣶⣾⣿⣿⠏ ⠈⢿⣄ ⢹⣏⠠⠟⣾⣿⣿⣿⣿⣿⠷⣏⣼⠟⢡⣿⡟⠋⢻⣿⣿⡄
   ⠈⣿⣿⣿⣿⡆   ⣽⢧⡘⠈⠳⣦⣍⠛⠛⢦⣉⣴⣛⣫⣭⣴⡟⠋  ⣾⣿⣿⡿
   ⢀⠹⣿⣿⣿⣷⣤⡄ ⠋ ⠙⢆ ⣠⠴⠟⠛⣛⣛⣛⠟⠋⠁⠺⡇ ⣀⣴⣿⣿⡟⠁
   ⠈⣀⠈⠛⠷⠿⣿⣿⣷⣤⣀ ⢠⠋   ⠈⠉⠉    ⣠⣴⣥⠾⠛⠉⣰⣿⣷
          ⠹⣯⣝⠛⠛⠷⢶⣤⣤⣀   ⢀⡠⠖⠋⠉⢉⣀⣀⣴⣾⣿⠿⠟⠃
             ⠘⠻⢿⣦⣄⡀  ⠉⠛⢦⠠⢊⠤⠴⢒⣛⣛⣩⣽⡿⠟⠁
        ⠶⢶⣤⣄⡀⠨⠭⠽⠟⣓⢦⣀⠈⢇⡥⠖⠛⠋⠉⠉
           ⠈⢷ ⠐⠂⢤⣽⣄ ⠰⡎⠙⠳⣄⡀ ⠈⢣⠘⢦⠋
            ⠈⢳⣀⡒⠉⠉⣉⠙⡲⣽⣄ ⣏⠳⡄ ⠘⡇ ⡾⠁
              ⠛⠻⢦⣄⣉⡁⣀⣀⣈⣙⣺⣌⡇⢠⢀⡇⡾
                   ⠈⠉    ⠈⠳⡄⣸⢱⠇
                           ⡷⠡⡯⢖⠉
                        ⢀⡴⢪⠔⣉⠔⠋
                           ⠐⠈
```

## For comparison: the upstream wordmark

`GENTLE SHELL` is 120 columns x 11 rows, drawn with only four characters: `█` (118), `▀` (155),
`▄` (133) and `▒` (185). Solid letterforms, no Braille. At 120 columns it only sits beside the
rose on very wide terminals; otherwise it stacks above it.

Fenrir's wordmark is 35 columns, so it sits beside the sigil from about 80 columns upward.
