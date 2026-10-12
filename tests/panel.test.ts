import test from "node:test";
import assert from "node:assert/strict";
import { buildPanelLines } from "../lib/panel.ts";
import type { PanelStyle } from "../lib/panel.ts";
import type { PanelData } from "../lib/collect.ts";
import { visibleWidth } from "../lib/width.ts";

const LABELS = [
  "GIT:",
  "PATH:",
  "MCP:",
  "PLUGINS:",
  "AGENTS:",
  "SKILLS:",
  "EXTENSIONS:",
  "VER:",
  "TOOLS:",
];

function data(overrides: Partial<PanelData> = {}): PanelData {
  return {
    gitBranch: "main",
    cwd: "/home/dev/project",
    mcpServers: 2,
    packages: 3,
    agents: 4,
    skills: 5,
    extensions: 6,
    version: "1.2.3",
    customTools: 7,
    ...overrides,
  };
}

function assertNoTrailingWhitespace(lines: string[], context: string): void {
  for (const line of lines) {
    assert.ok(!/[ \t]$/.test(line), `${context}: trailing whitespace in ${JSON.stringify(line)}`);
  }
}

function assertFits(lines: string[], width: number, context: string): void {
  for (const line of lines) {
    assert.ok(
      visibleWidth(line) <= width,
      `${context}: width ${visibleWidth(line)} > ${width} for ${JSON.stringify(line)}`,
    );
  }
}

// ANSI-only hooks keep visible width unchanged, like real theme styling.
const ansiStyle: PanelStyle = {
  label: (text) => `\x1b[35m${text}\x1b[39m`,
  value: (text) => `\x1b[36m${text}\x1b[39m`,
  accent: (text) => `\x1b[33m${text}\x1b[39m`,
};

test("narrow layout below 122 uses one column and nine rows", () => {
  const lines = buildPanelLines(data(), 121);
  assert.equal(lines.length, 9);
  LABELS.forEach((label, index) => {
    assert.ok(lines[index].startsWith(label), `row ${index} should start with ${label}`);
  });
  // No row may hold two labels in narrow mode.
  for (const line of lines) {
    assert.ok(!(line.includes("GIT:") && line.includes("PATH:")));
  }
});

test("wide layout at 122 pairs columns into five rows", () => {
  const lines = buildPanelLines(data(), 122);
  assert.equal(lines.length, 5);
  assert.ok(lines[0].includes("GIT:") && lines[0].includes("PATH:"));
  assert.ok(lines[1].includes("MCP:") && lines[1].includes("PLUGINS:"));
  assert.ok(lines[2].includes("AGENTS:") && lines[2].includes("EXTENSIONS:"));
  assert.ok(lines[3].includes("SKILLS:") && lines[3].includes("TOOLS:"));
  assert.ok(lines[4].includes("VER:"));
  assert.ok(!lines[4].includes("TOOLS:"));
});

test("the wide/narrow threshold flips exactly between 121 and 122", () => {
  assert.equal(buildPanelLines(data(), 121).length, 9);
  assert.equal(buildPanelLines(data(), 122).length, 5);
});

test("value formats match the upstream panel", () => {
  const narrow = buildPanelLines(data(), 100);
  assert.ok(narrow[0].includes("main"));
  assert.ok(narrow[1].includes("/home/dev/project"));
  assert.ok(narrow[2].includes("2 server(s)"));
  assert.ok(narrow[3].includes("3 package(s)"));
  assert.ok(narrow[4].includes("4 agents"));
  assert.ok(narrow[5].includes("5 loaded"));
  assert.ok(narrow[6].includes("6 active"));
  assert.ok(narrow[7].includes("v1.2.3"));
  assert.ok(narrow[8].includes("7 custom"));
});

test("the default style is the identity function", () => {
  const explicit: PanelStyle = { label: (t) => t, value: (t) => t, accent: (t) => t };
  for (const width of [80, 121, 122, 200]) {
    assert.deepEqual(buildPanelLines(data(), width), buildPanelLines(data(), width, explicit));
  }
});

test("a supplied style hook is applied to labels, values and the git accent", () => {
  const lines = buildPanelLines(data(), 121, ansiStyle);
  assert.ok(lines[0].includes("\x1b[35mGIT:\x1b[39m"));
  assert.ok(lines[0].includes("\x1b[33mmain\x1b[39m"));
  assert.ok(!lines[0].includes("\x1b[36mmain\x1b[39m"));
  assert.ok(lines[1].includes("\x1b[36m/home/dev/project\x1b[39m"));
  assertFits(lines, 121, "styled narrow");
  assertNoTrailingWhitespace(lines, "styled narrow");
});

test("an extreme matrix stays inside the width with no trailing whitespace", () => {
  const extreme = data({
    gitBranch: "branch-".repeat(200),
    cwd: "",
    mcpServers: 0,
    packages: Number.MAX_SAFE_INTEGER,
    agents: 0,
    skills: Number.MAX_SAFE_INTEGER,
    extensions: 0,
    version: "",
    customTools: Number.MAX_SAFE_INTEGER,
  });
  for (const width of [40, 80, 100, 121, 122, 180, 240]) {
    const lines = buildPanelLines(extreme, width);
    assertFits(lines, width, `extreme @ ${width}`);
    assertNoTrailingWhitespace(lines, `extreme @ ${width}`);
  }
});

test("every rendered line fits for widths 40..240 inclusive (sweep invariant)", () => {
  for (let width = 40; width <= 240; width++) {
    const lines = buildPanelLines(data(), width);
    const expected = width >= 122 ? 5 : 9;
    assert.equal(lines.length, expected, `row count at width ${width}`);
    assertFits(lines, width, `sweep @ ${width}`);
    assertNoTrailingWhitespace(lines, `sweep @ ${width}`);
  }
});

test("the sweep invariant also holds with ANSI style hooks applied", () => {
  for (let width = 40; width <= 240; width++) {
    const lines = buildPanelLines(data(), width, ansiStyle);
    assertFits(lines, width, `styled sweep @ ${width}`);
    assertNoTrailingWhitespace(lines, `styled sweep @ ${width}`);
  }
});

test("empty values render clean rows without trailing whitespace", () => {
  const lines = buildPanelLines(
    data({ gitBranch: "", cwd: "", version: "" }),
    121,
  );
  assert.equal(lines.length, 9);
  assertFits(lines, 121, "empty values");
  assertNoTrailingWhitespace(lines, "empty values");
  assert.ok(lines[7].includes("VER:"));
});
