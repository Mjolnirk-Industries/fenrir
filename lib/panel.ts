// Pure layout for the Fenrir info panel.
//
// Reproduces the upstream two-column / one-column layout, but with the Fenrir
// fixes: the label column is padded to the longest label in the block, columns
// are separated by spaces, and the value columns are sized from the real
// remaining width so no line ever exceeds `width`. Lines never carry trailing
// whitespace.

import type { PanelData } from "./collect.ts";
import { padEndToWidth, truncateToWidth, visibleWidth } from "./width.ts";

export interface PanelStyle {
  label(text: string): string;
  value(text: string): string;
  accent(text: string): string;
}

const IDENTITY_STYLE: PanelStyle = {
  label: (text) => text,
  value: (text) => text,
  accent: (text) => text,
};

const WIDE_MIN_WIDTH = 122;
const WIDE_GAP = "   ";
const NARROW_GAP = "  ";

type Cell = { label: string; value: string; accent: boolean };
type Row = [Cell, Cell | null];

function buildRows(data: PanelData): { wide: Row[]; narrow: Row[] } {
  const git: Cell = { label: "GIT:", value: data.gitBranch, accent: true };
  const path: Cell = { label: "PATH:", value: data.cwd, accent: false };
  const mcp: Cell = { label: "MCP:", value: `${data.mcpServers} server(s)`, accent: false };
  const plugins: Cell = { label: "PLUGINS:", value: `${data.packages} package(s)`, accent: false };
  const agents: Cell = { label: "AGENTS:", value: `${data.agents} agents`, accent: false };
  const skills: Cell = { label: "SKILLS:", value: `${data.skills} loaded`, accent: false };
  const extensions: Cell = {
    label: "EXTENSIONS:",
    value: `${data.extensions} active`,
    accent: false,
  };
  const ver: Cell = { label: "VER:", value: `v${data.version}`, accent: false };
  const tools: Cell = { label: "TOOLS:", value: `${data.customTools} custom`, accent: false };

  return {
    wide: [
      [git, path],
      [mcp, plugins],
      [agents, extensions],
      [skills, tools],
      [ver, null],
    ],
    narrow: [
      [git, null],
      [path, null],
      [mcp, null],
      [plugins, null],
      [agents, null],
      [skills, null],
      [extensions, null],
      [ver, null],
      [tools, null],
    ],
  };
}

function trimTrailingWhitespace(line: string): string {
  return line.replace(/[ \t]+$/, "");
}

export function buildPanelLines(
  data: PanelData,
  width: number,
  style: PanelStyle = IDENTITY_STYLE,
): string[] {
  if (!Number.isFinite(width) || width <= 0) return [];
  const limit = Math.floor(width);

  const wide = limit >= WIDE_MIN_WIDTH;
  const rows = buildRows(data)[wide ? "wide" : "narrow"];

  const labelWidth = rows.reduce(
    (max, [left, right]) =>
      Math.max(max, left.label.length, right ? right.label.length : 0),
    0,
  );

  const renderCell = (cell: Cell, valueWidth: number): string => {
    const label = padEndToWidth(style.label(cell.label), labelWidth);
    const styled = cell.accent ? style.accent(cell.value) : style.value(cell.value);
    const value = padEndToWidth(truncateToWidth(styled, valueWidth), valueWidth);
    return `${label} ${value}`;
  };

  const gap = wide ? WIDE_GAP : NARROW_GAP;
  const lines: string[] = [];

  for (const [left, right] of rows) {
    let line: string;
    if (right) {
      const fixed = 2 * (labelWidth + 1) + gap.length;
      const valueWidth = Math.max(0, Math.floor((limit - fixed) / 2));
      line = `${renderCell(left, valueWidth)}${gap}${renderCell(right, valueWidth)}`;
    } else {
      const valueWidth = Math.max(0, limit - (labelWidth + 1));
      line = renderCell(left, valueWidth);
    }

    const clipped = truncateToWidth(line, limit);
    const clean = trimTrailingWhitespace(clipped);
    // truncateToWidth never emits trailing whitespace, but padding can.
    lines.push(visibleWidth(clean) <= limit ? clean : truncateToWidth(clean, limit));
  }

  return lines;
}
