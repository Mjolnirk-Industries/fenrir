// Pi extension entry point for the Fenrir startup header.
//
// Thin wiring only. The pure logic lives in lib/: this module owns the deferred
// install race (via HeaderOwner), the one-shot reveal animation, the data
// refresh, the two /fenrir commands, and idempotent cleanup.
//
// The host package is imported lazily inside the session_start handler so that
// importing this module never requires @earendil-works/pi-coding-agent. That is
// what lets the test suite load it under bare node.

import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_ANIM_PLAN, isFrozen, revealFraction, revealRows } from "../lib/anim.ts";
import { collectPanelData } from "../lib/collect.ts";
import type { CollectDeps, PanelData } from "../lib/collect.ts";
import { HeaderOwner } from "../lib/header-owner.ts";
import type { HeaderComponent, HeaderOwnerDeps } from "../lib/header-owner.ts";
import { buildPanelLines } from "../lib/panel.ts";
import type { PanelStyle } from "../lib/panel.ts";
import {
  assertZoneMapAligned,
  composeBanner,
  parseArtBlock,
  parseZoneMap,
} from "../lib/sigil.ts";
import type { ArtBlock, ZoneMap } from "../lib/sigil.ts";
import { FENRIR_PALETTE, paint, paintZonedArt } from "../lib/style.ts";
import type { ZoneLetter } from "../lib/style.ts";

const PANEL_STYLE: PanelStyle = {
  label: (text) => paint(text, FENRIR_PALETTE.A),
  value: (text) => paint(text, FENRIR_PALETTE.B),
  accent: (text) => paint(text, FENRIR_PALETTE.E),
};

// The wordmark ships without a zone file: it is painted one color. Zone `B`
// (ash) keeps the name bright and legible and does not compete with the eye's
// wolf orange.
const WORDMARK_ZONE: ZoneLetter = "B";

const ART_URLS = {
  sigil: new URL("../art/sigil.txt", import.meta.url),
  zones: new URL("../art/sigil.zones.txt", import.meta.url),
  wordmark: new URL("../art/wordmark.txt", import.meta.url),
} as const;

interface BannerArt {
  sigil: ArtBlock;
  wordmark: ArtBlock;
  /** The sigil's zone grid as plain lines, padded to the sigil width. */
  sigilZones: ArtBlock;
  /** The wordmark's single-color zone grid, generated at load. */
  wordmarkZones: ArtBlock;
}

function padZoneRow(row: string, width: number): string {
  const current = Array.from(row).length;
  return current >= width ? row : row + ".".repeat(width - current);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read and parse the three delivered art files once per session. Throws on any
 * read, parse, or alignment failure; the caller turns that into a single
 * notification and leaves Pi's built-in header in place.
 */
async function loadBannerArt(): Promise<BannerArt> {
  const [sigilText, zoneText, wordmarkText] = await Promise.all([
    readFile(ART_URLS.sigil, "utf8"),
    readFile(ART_URLS.zones, "utf8"),
    readFile(ART_URLS.wordmark, "utf8"),
  ]);

  const sigil = parseArtBlock(sigilText);
  const zones: ZoneMap = parseZoneMap(zoneText);
  assertZoneMapAligned(sigil, zones);
  const wordmark = parseArtBlock(wordmarkText);

  // A zone row narrower than the art is legal and reads as unpainted; pad it
  // with `.` so the composed zone grid lines up with the composed art grid.
  const sigilZones: ArtBlock = {
    lines: zones.rows.map((row) => padZoneRow(row, sigil.width)),
    width: sigil.width,
    height: zones.height,
  };

  // Publish a zone grid for the wordmark so the whole composed banner can be
  // painted in one paintZonedArt pass. Spaces stay `.`, so they stay unpainted.
  const wordmarkZones: ArtBlock = {
    lines: wordmark.lines.map((line) =>
      Array.from(line)
        .map((ch) => (ch === " " ? "." : WORDMARK_ZONE))
        .join(""),
    ),
    width: wordmark.width,
    height: wordmark.height,
  };

  return { sigil, wordmark, sigilZones, wordmarkZones };
}

function execFileAsync(
  file: string,
  args: string[],
  options: { cwd: string },
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout) => {
      if (error) reject(error);
      else resolve({ stdout });
    });
  });
}

function describeData(data: PanelData | null): string {
  if (data === null) return "no panel data";
  return [
    `git=${data.gitBranch}`,
    `path=${data.cwd}`,
    `mcp=${data.mcpServers}`,
    `plugins=${data.packages}`,
    `agents=${data.agents}`,
    `skills=${data.skills}`,
    `extensions=${data.extensions}`,
    `ver=${data.version}`,
    `tools=${data.customTools}`,
  ].join(" ");
}

export default function fenrirExtension(pi: ExtensionAPI): void {
  let activeOwner: HeaderOwner | null = null;
  let activeData: PanelData | null = null;
  let refreshActive: (() => Promise<void>) | null = null;
  let teardown: (() => void) | null = null;

  const runTeardown = (): void => {
    const fn = teardown;
    teardown = null;
    if (fn) fn();
    activeOwner = null;
    activeData = null;
    refreshActive = null;
  };

  pi.on("session_start", async (_event, ctx) => {
    if (process.env.FENRIR_DISABLE) return;
    if (!ctx.hasUI) return;

    // A reload/new/fork fires session_shutdown first, but be defensive.
    runTeardown();

    // Read the delivered art once. A read, parse, or alignment failure means we
    // install nothing at all: notify once and leave Pi's built-in header.
    let art: BannerArt;
    try {
      art = await loadBannerArt();
    } catch (error) {
      try {
        ctx.ui.notify(`Fenrir header not installed: ${describeError(error)}`, "warning");
      } catch {
        // A notification failure must never escape the lifecycle handler.
      }
      return;
    }

    const host = await import("@earendil-works/pi-coding-agent").catch(() => null);
    if (host === null) return;

    const agentDir = typeof host.getAgentDir === "function" ? host.getAgentDir() : "";
    const version = typeof host.VERSION === "string" ? host.VERSION : "";

    let panelData: PanelData | null = null;
    let animTick = 0;
    let animFrozen = false;
    let animHandle: unknown = null;
    let cacheWidth = -1;
    let cacheOut: string[] | null = null;

    const schedule = (fn: () => void, delayMs: number): unknown => setTimeout(fn, delayMs);
    const cancel = (handle: unknown): void => {
      if (handle !== null && handle !== undefined) clearTimeout(handle as ReturnType<typeof setTimeout>);
    };
    const cancelAnimation = (): void => {
      if (animHandle !== null) {
        cancel(animHandle);
        animHandle = null;
      }
    };

    const collectDeps = (): CollectDeps => ({
      agentDir,
      version,
      readFile: (path) => readFile(path, "utf8"),
      readdir: (path) => readdir(path),
      execFile: execFileAsync,
      getCommands: () => (typeof pi.getCommands === "function" ? pi.getCommands() : []),
      getAllTools: () => (typeof pi.getAllTools === "function" ? pi.getAllTools() : []),
    });

    const refresh = async (): Promise<void> => {
      panelData = await collectPanelData(collectDeps(), ctx.cwd);
      activeData = panelData;
      cacheOut = null;
      cacheWidth = -1;
    };
    await refresh();

    // Built lazily by HeaderOwner on the first render. The reveal runs once:
    // while animating it schedules the next tick through the injected scheduler,
    // and once frozen render() serves a per-width cache so a static pass does no
    // art or panel work.
    const build = (tui: unknown): HeaderComponent => {
      const requestRender = (): void => {
        const render = (tui as { requestRender?: () => void } | null)?.requestRender;
        if (typeof render === "function") {
          try {
            render.call(tui);
          } catch {
            // A torn-down TUI must never take the session down with it.
          }
        }
      };

      const step = (): void => {
        animHandle = null;
        animTick += 1;
        if (isFrozen(animTick, DEFAULT_ANIM_PLAN)) {
          animFrozen = true;
          cacheOut = null;
          cacheWidth = -1;
        }
        requestRender();
        if (!animFrozen) animHandle = schedule(step, DEFAULT_ANIM_PLAN.tickMs);
      };
      animHandle = schedule(step, DEFAULT_ANIM_PLAN.tickMs);

      return {
        render(width: number): string[] {
          if (animFrozen && cacheOut !== null && cacheWidth === width) return cacheOut;
          const banner = composeBanner({ sigil: art.sigil, wordmark: art.wordmark, width });
          // Compose the zone grid with the same layout so it stays aligned
          // column for column; the wordmark contributes its generated grid.
          const zoneBanner = composeBanner({
            sigil: art.sigilZones,
            wordmark: art.wordmarkZones,
            width,
          });
          const revealed = animFrozen
            ? banner.lines
            : revealRows(banner.lines, revealFraction(animTick, DEFAULT_ANIM_PLAN));
          const panelLines = panelData === null ? [] : buildPanelLines(panelData, width, PANEL_STYLE);
          const lines = [
            ...paintZonedArt(revealed, zoneBanner.lines, { dimmed: !animFrozen }),
            "",
            ...panelLines,
          ];
          if (animFrozen) {
            cacheOut = lines;
            cacheWidth = width;
          }
          return lines;
        },
        invalidate(): void {
          cacheOut = null;
          cacheWidth = -1;
        },
        dispose(): void {
          cancelAnimation();
        },
      };
    };

    const deps: HeaderOwnerDeps = {
      setHeader: (factory) => {
        try {
          ctx.ui.setHeader(factory as unknown as Parameters<typeof ctx.ui.setHeader>[0]);
        } catch {
          // Hosts without a terminal header simply ignore the request.
        }
      },
      schedule,
      cancel,
      notify: (message, level) => ctx.ui.notify(message, level),
    };

    const owner = new HeaderOwner(deps, build);
    activeOwner = owner;
    refreshActive = refresh;
    owner.start();

    teardown = (): void => {
      cancelAnimation();
      owner.stop();
    };
  });

  pi.on("session_shutdown", () => {
    runTeardown();
  });

  pi.registerCommand("fenrir:status", {
    description: "Show the Fenrir header ownership status and the collected panel counts",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const owner = activeOwner;
      if (owner === null) {
        ctx.ui.notify("Fenrir header is not active (disabled, non-TUI, or not started)", "info");
        return;
      }
      try {
        await refreshActive?.();
      } catch {
        // Keep reporting the last known data if a refresh fails.
      }
      const status = owner.status();
      ctx.ui.notify(
        `Fenrir header: phase=${status.phase} reclaims=${status.reclaims} renders=${status.renders} ` +
          `width=${status.lastWidth ?? "?"}; ${describeData(activeData)}`,
        "info",
      );
    },
  });

  pi.registerCommand("fenrir:reinstall", {
    description: "Re-assert the Fenrir header ownership on demand",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const owner = activeOwner;
      if (owner === null) {
        ctx.ui.notify("Fenrir header is not active; nothing to reinstall", "warning");
        return;
      }
      const before = owner.status();
      owner.reclaim();
      const after = owner.status();
      ctx.ui.notify(
        `Fenrir reinstall: phase ${before.phase} -> ${after.phase}, ` +
          `reclaims ${before.reclaims} -> ${after.reclaims}`,
        after.phase === "gave-up" ? "warning" : "info",
      );
    },
  });
}
