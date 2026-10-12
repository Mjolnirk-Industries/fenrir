# Fenrir

A [Pi](https://github.com/earendil-works/pi) package that takes over the session header: the
**Fenrir** startup banner plus the runtime info panel (git branch, path, MCP servers, packages,
agents, skills, extensions, version, custom tools).

Why a package instead of a fork: `gentle-shell` draws its own startup banner in the header and
updates itself from upstream. Editing that code means reapplying the branding on every update.
This package instead claims Pi's header slot at runtime, so upstream updates never touch it.

> **Status: scaffolding.** The package is under construction; the header extension is not
> implemented yet. See `odd/tasks/fenrir-header.md` for the task list and the measured evidence.

## Install

```sh
pi install git:github.com/Mjolnirk-Industries/fenrir
```

## Escape hatch

```sh
FENRIR_DISABLE=1 pi
```

Disables the extension entirely and leaves Pi's built-in header in place.

## License

MIT. Fenrir is an unofficial customization for Pi; it is not affiliated with, and contains no
code from, `gentle-shell` or `gentle-pi`.
