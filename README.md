# Fenrir

A [Pi](https://github.com/earendil-works/pi) package that takes over the session header: the
**Fenrir** wolf banner, the runtime info panel (git branch, path, MCP servers, packages, agents,
skills, extensions, version, custom tools), and the **Fenrir** theme.

Why a package instead of a fork: Pi has a single header slot and the last writer wins. Fenrir
claims that slot at runtime, so upstream updates never touch it and nothing upstream is patched,
vendored or imported.

> **Status:** the banner, panel, theme and takeover logic are implemented and covered by the test
> suite (114 tests). The deferred-install race that decides which banner wins depends on host
> dispatch timing, so it is verified by test but still worth a one-time smoke check in a real
> terminal — see [Verify it worked](#verify-it-worked).

## Requirements

- Pi with extension/package support (the manifest declares the host packages
  `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` as optional peer dependencies;
  Pi supplies them).
- No Node dependencies and no build step. The tests need a Node that supports
  `--experimental-strip-types`.
- A truecolor terminal for the exact palette (see [Change the colors](docs/customizing.md#change-the-colors)).
- Roughly 78 columns or more if you want the sigil and wordmark side by side; narrower
  terminals stack them.

## Install

```sh
pi install git:github.com/Mjolnirk-Industries/fenrir
```

Or try the whole package for a single session without installing it:

```sh
pi --extension /path/to/fenrir
```

Point `--extension` at the extension file (`/path/to/fenrir/extensions/fenrir.ts`) instead to
load only the header and skip the theme. `-e` is the short form of `--extension`.

## Verify it worked

1. Start Pi. The Fenrir banner and panel should be the header, not Pi's built-in banner.
2. Run `/fenrir:status`. It reports the ownership phase and the collected panel counts, for
   example `phase=owned reclaims=0 renders=12 width=120; git=main path=… mcp=…`.
3. Run `/fenrir:reinstall`. It re-asserts ownership on demand.
4. Restart with the disable switch (below). Pi's built-in header should return.

## Configuration surface

| Knob | Where | Kind |
| --- | --- | --- |
| `FENRIR_DISABLE` | environment | opt out of the takeover |
| Banner art | `art/sigil.txt`, `art/sigil.zones.txt`, `art/wordmark.txt` | data files |
| Zone colors | `lib/style.ts` → `FENRIR_PALETTE` | code |
| Wordmark color | `extensions/fenrir.ts` → `WORDMARK_ZONE` | code |
| Animation | `lib/anim.ts` → `DEFAULT_ANIM_PLAN` | code |
| Takeover timing | `lib/header-owner.ts` → `DEFAULT_INSTALL_DELAY_MS`, `DEFAULT_RECLAIM_DELAY_MS`, `DEFAULT_MAX_RECLAIMS` | code |
| Theme | `themes/Fenrir.json` | selected in Pi |

[docs/customizing.md](docs/customizing.md) covers each of these with the exact edit, its
constraints and how to validate it.

## Commands

Both are slash commands registered with `pi.registerCommand` — they are not keyboard shortcuts.

| Command | Effect |
| --- | --- |
| `/fenrir:status` | Reports the header ownership phase (`owned`, `reclaiming`, `gave-up`, …), the reclaim count, the render count, the last render width, and the collected panel field counts. Refreshes the panel data first. |
| `/fenrir:reinstall` | Re-asserts the Fenrir header immediately, still bounded by the same reclaim budget. |

## Disable switch

```sh
FENRIR_DISABLE=1 pi
```

Skips the takeover entirely and leaves Pi's built-in header in place. The check is a plain
truthiness test on the environment variable, so **any** non-empty value disables Fenrir
(including `FENRIR_DISABLE=0`); unset it to re-enable.

## Updating

```sh
pi update --extensions
```

`pi install` pins git tags and commits, and updates reconcile the checkout without moving a
configured ref. To update one package only, use `pi update <source>`.

## Uninstall

```sh
pi remove git:github.com/Mjolnirk-Industries/fenrir
```

`pi list` shows configured packages.

## Troubleshooting

**The upstream banner wins.** The upstream banner installs from a deferred timer. Fenrir installs
from a later timer to land last; if it still loses the slot, its component is disposed and it
reclaims, up to a bounded number of attempts. If Pi's built-in banner simply wins and stays,
raise the install delay — see
[Tune the takeover](docs/customizing.md#tune-the-takeover). `/fenrir:status` will show a phase
such as `gave-up`.

**The art fails to load and no header is installed.** Fenrir installs nothing at all when the
art cannot be read, parsed, or aligned; it emits one warning notification
(`Fenrir header not installed: …`) and leaves Pi's built-in header in place. This is deliberate:
a malformed delivery never renders wrong. The message names the offending character and its
row/column for a bad zone map. Test the grids with the suite below.

**Confirm what the header is doing.** Run `/fenrir:status`. `phase=owned` with a rising `renders`
count means Fenrir holds the slot; `phase=gave-up` means it stopped reclaiming. If the header is
not active at all, the command replies `Fenrir header is not active (disabled, non-TUI, or not
started)`.

## Further reading

- [docs/customizing.md](docs/customizing.md) — change the art, colors, panel, animation and
  takeover timing.
- [docs/design-brief.md](docs/design-brief.md) — the canvas budget, resolution ladder and
  acceptance checklist for the art.
- [art/README.md](art/README.md) — the art data files and their format rules.

## Development

No dependencies, no build step. Every effect the host provides is injected, so the pure modules
under `lib/` run on bare Node:

```sh
node --experimental-strip-types --test tests/*.test.ts
```

(`npm test` runs the same command.)

| Module | Responsibility |
| --- | --- |
| `lib/width.ts` | Visible width and truncation for the package's own single-width art |
| `lib/collect.ts` | The nine panel fields, each failure degrading a single field |
| `lib/panel.ts` | Panel layout: two columns at 122+ columns, one below |
| `lib/sigil.ts` | Wolf sigil and `FENRIR` wordmark, composed from plain text and colored by zone |
| `lib/anim.ts` | One-shot reveal timing and the freeze threshold |
| `lib/style.ts` | Truecolor palette and per-zone art painting |
| `lib/header-owner.ts` | Header ownership state machine: deferred install, loss signal, bounded reclaim |
| `extensions/fenrir.ts` | Pi wiring: lifecycle, renderer, commands |

## License

MIT. Fenrir is an unofficial customization for Pi. It is not affiliated with, and contains no
code from, `gentle-shell`, `gentle-pi` or their authors.
