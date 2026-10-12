# Feature: fenrir-header

Package: `github.com/Mjolnirk-Industries/fenrir` (public, MIT).
Local checkout: `E:/HomeLab/pi-fenrir`.
Upstream being supplemented: `gentle-shell` 4.1.0 (`gentle-pi` 4.1.0) on Pi 1.1.0.

## Objective

A Pi package that takes over Pi's single header slot at session start and renders the Fenrir
banner together with the runtime info panel that gentle-shell's startup banner currently
provides — without patching upstream code, so every upstream update leaves this package
untouched and working.

## Problem / Why

The owner wants their own banner and their own info panel. Patching a fork means reapplying
the branding on every upstream update and living with high-conflict files
(`extensions/startup-banner.ts` is 1116 lines). A Pi package is orthogonal to upstream: it
registers its own extension, and the upstream banner is displaced at runtime instead of
being edited.

## Evidence

Measured on the installed hosts, not inferred:

- `ctx.ui.setHeader(factory)` **replaces** the header. There is one header slot. The last
  writer wins. `setHeader(undefined)` restores Pi's built-in header.
  (`@earendil-works/pi-coding-agent` `dist/modes/interactive/interactive-mode.js`
  `setExtensionHeader`.)
- Pi documents this as a supported integration point ("Replace the header, footer, or
  editor") and ships `examples/extensions/custom-header.ts`.
- gentle-shell installs its banner from a `session_start` handler **inside a `setTimeout`**
  (`extensions/startup-banner.ts:749`), so a plugin that installs synchronously from its own
  `session_start` handler loses the race and its header is replaced by gentle's.
- `setExtensionHeader` disposes the previous custom header (`this.customHeader?.dispose()`).
  A disposed component is therefore a reliable "I lost the slot" signal.
- gentle-shell has **no** switch to disable its banner: `currentIntroMode()` is derived from
  `process.stdout.rows`/`columns` only (`full` | `minimal` | `skip`), not from configuration.
- gentle-shell's banner art colors come from its own `BANNER_PALETTES` RGB table and
  `banner.json`, **not** from the active Pi theme. A theme cannot restyle that art.
- The banner also renders an info panel. Nine fields with these sources:

| Field | Value | Source |
| --- | --- | --- |
| `GIT:` | branch | `git` in `ctx.cwd` |
| `PATH:` | cwd | extension context |
| `MCP:` | N servers | `<agentDir>/mcp.json` → `mcpServers` |
| `PLUGINS:` | N packages | `<agentDir>/settings.json` → `packages` |
| `AGENTS:` | N agents | `<agentDir>/agents/*.md`, excluding `sdd-*` |
| `SKILLS:` | N loaded | `pi.getCommands()` where `source === "skill"` |
| `EXTENSIONS:` | N active | extension files per package under `<agentDir>/npm/node_modules` |
| `VER:` | version | `VERSION` from `@earendil-works/pi-coding-agent` |
| `TOOLS:` | N custom | `pi.getAllTools()` excluding `builtin` and `sdk` |

- Layout: two columns at `width >= 122`, one column below that. Labels are padded to the
  widest label, values are truncated to the available width.
- `visibleWidth()` / `truncateToWidth()` from `@earendil-works/pi-tui` are the width
  primitives; the art here stays inside single-width box-drawing and block glyphs so a local
  width function matches the host's.

## Product decisions

- Scope is the header: banner art **and** info panel. The owner wants both replaced.
- Package name `fenrir`; repository public; MIT.
- The startup animation runs once and then freezes; afterwards the header is static and
  cached per width and tick. No permanent repaint loop.
- The package ships the Fenrir theme alongside the extension, so one install configures both.
- Install channel is git: `pi install git:github.com/Mjolnirk-Industries/fenrir`. No npm
  publication is required to use it.
- This package never reads or writes gentle-shell's `banner.json`. It owns its own config.
- The upstream banner keeps running, unaware; we simply win the slot and dispose its
  component. Nothing is monkey-patched, imported from gentle-pi, or vendored.
- If the package is disabled or fails to install, Pi's own header is restored, never a blank
  header.

## Architecture

Pure logic is separated from host wiring so it can be tested without installing Pi.

- `extensions/fenrir.ts` — host wiring only: `session_start` deferred install, ownership
  watchdog, `/fenrir` commands, `session_shutdown` cleanup, `FENRIR_DISABLE` escape hatch.
- `lib/collect.ts` — pure collectors with injected `fs` and `execFile`; returns `PanelData`.
- `lib/panel.ts` — pure layout; `PanelData` + width → `string[]`.
- `lib/sigil.ts` — pure art: wolf sigil and `FENRIR` wordmark as plain lines.
- `lib/anim.ts` — pure animation state: tick → which strokes are visible; freeze threshold.
- `lib/width.ts` — visible width for our own single-width art (ANSI-strip + code point count).
- `tests/*.test.ts` — `node --experimental-strip-types --test`.

## Race handling

Four mechanisms, in order of confidence:

1. **Deferred install.** Install from a timer that fires later than gentle-shell's own
   deferred install, so ours is the last write.
2. **Disposal as loss signal.** If our component's `dispose()` is called while the session is
   still active, we lost the slot; reinstall, bounded to a small number of attempts.
3. **`/fenrir:status`** reports whether the header currently belongs to us, and
   `/fenrir:reinstall` re-asserts on demand.
4. **`FENRIR_DISABLE=1`** opts out completely, restoring Pi's built-in header.

## Tasks

- [ ] **T1** Scaffold: `package.json` with `pi.extensions`, README, MIT LICENSE, `.gitignore`,
  this document.
- [ ] **T2** `lib/width.ts` + `lib/collect.ts` with tests: each of the nine fields, including
  failure paths (absent `mcp.json`, absent `settings.json`, not a git repo).
- [ ] **T3** `lib/panel.ts` with tests: wide (>=122) and narrow layouts, label alignment,
  value truncation, empty/missing values.
- [ ] **T4** `lib/sigil.ts` + `lib/anim.ts` with tests: art shape, stroke reveal frames,
  freeze threshold, every rendered line within a single terminal cell per character.
- [ ] **T5** `extensions/fenrir.ts`: wiring, deferred install, disposal watchdog, commands,
  cleanup, escape hatch.
- [ ] **T6** Theme: port the verified `themes/Fenrir.json` and register it in the package.
- [ ] **T7** Empirical race verification on a real terminal, plus README install/verify steps.

## Risks

- **The race cannot be proven by reading code.** Host dispatch timing decides it, and only an
  interactive run on the owner's terminal settles it. Every other task is verifiable by test.
- gentle-shell may change its install timing or gain a banner-disable switch in a future
  version; the deferred install and the watchdog are chosen to survive that, but they are
  timing assumptions.
- Replacing the header means also owning the panel: a bug in a collector can leave fields
  empty. Collectors must degrade to a visible placeholder, never throw.
- Terminal width handling: our art is single-width by construction, but any glyph with
  ambiguous width would corrupt alignment on some terminals.

## Out of scope

- Patching, vendoring, or importing anything from gentle-shell.
- Replacing any other Pi UI surface (footer, editor, widgets, status).
- Publishing to npm, or an independent update channel.
