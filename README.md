# Fenrir

A [Pi](https://github.com/earendil-works/pi) package that takes over the session header: the
**Fenrir** startup banner, the runtime info panel (git branch, path, MCP servers, packages,
agents, skills, extensions, version, custom tools), and the **Fenrir** theme.

Why a package instead of a fork: `gentle-shell` draws its own startup banner in the header and
updates itself from upstream. Editing that code means reapplying the branding on every update.
This package instead claims Pi's single header slot at runtime, so upstream updates never touch
it and nothing upstream is patched, vendored or imported.

> **Status:** the banner, panel, theme and takeover logic are implemented and covered by 100
> tests. **The takeover itself has not yet been verified on a live terminal** — that is the one
> thing tests cannot prove, because it depends on host timing. See
> [Verifying the takeover](#verifying-the-takeover).

## Install

```sh
pi install git:github.com/Mjolnirk-Industries/fenrir
```

Or load it for a single session without installing:

```sh
pi --extension /path/to/fenrir/extensions/fenrir.ts
```

## How it works

Pi has exactly one header slot, and the last writer wins. The upstream banner installs itself
from a `session_start` handler inside a `setTimeout`, so Fenrir installs on a later timer, wins
the slot, and disposes the upstream banner in the process. If something replaces Fenrir later,
the disposal of its component is the signal: Fenrir reclaims the slot, up to a bounded number of
attempts, and then stops cleanly instead of fighting forever.

The banner animates once for about 1.3 seconds and then freezes. After that the header is
static and cached per width: there is no background repaint loop.

## Commands

| Command | Effect |
| --- | --- |
| `/fenrir:status` | Phase (`owned`, `reclaiming`, `gave-up`, ...), reclaim count, render count, last width, and the collected field counts |
| `/fenrir:reinstall` | Reclaims the header immediately, bounded by the same budget |

## Escape hatch

```sh
FENRIR_DISABLE=1 pi
```

Skips the takeover entirely and leaves Pi's built-in header in place.

## Theme

The package also ships the `Fenrir` theme, which you can select like any other Pi theme. It is
not applied automatically.

## Verifying the takeover

```sh
cd /path/to/fenrir
pi --extension ./extensions/fenrir.ts
```

What to check:

1. The Fenrir banner and panel are what you see, not the upstream rose banner.
2. `/fenrir:status` reports `phase: owned` and a render count that keeps rising.
3. `/fenrir:reinstall` reclaims without error.
4. Restarting with `FENRIR_DISABLE=1` brings back Pi's built-in header.

## Development

No dependencies, no build step. The pure modules under `lib/` take every host effect as an
injected argument, so the suite runs on bare Node:

```sh
node --experimental-strip-types --test tests/*.test.ts
```

| Module | Responsibility |
| --- | --- |
| `lib/width.ts` | Visible width and truncation for the package's own single-width art |
| `lib/collect.ts` | The nine panel fields, each failure degrading a single field |
| `lib/panel.ts` | Panel layout: two columns at 122+ columns, one below |
| `lib/sigil.ts` | Wolf sigil and `FENRIR` wordmark, colored by character zone |
| `lib/anim.ts` | One-shot reveal timing and the freeze threshold |
| `lib/style.ts` | Truecolor palette and per-zone art painting |
| `lib/header-owner.ts` | Header ownership state machine: deferred install, loss signal, bounded reclaim |
| `extensions/fenrir.ts` | Pi wiring: lifecycle, renderer, commands |

## License

MIT. Fenrir is an unofficial customization for Pi. It is not affiliated with, and contains no
code from, `gentle-shell`, `gentle-pi` or their authors.
