import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const THEME_URL = new URL("../themes/Fenrir.json", import.meta.url);
const PACKAGE_URL = new URL("../package.json", import.meta.url);

// Copied verbatim from the upstream "Gentle" theme referenced while authoring
// this palette (E:/HomeLab/Fenrir/themes/Gentle.json). Kept as a literal so the
// test stays hermetic and does not depend on a sibling checkout.
const UPSTREAM_SCHEMA =
  "https://raw.githubusercontent.com/earendil-works/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json";

const HEX = /^#[0-9A-Fa-f]{6}$/;

// The closure of chromatic values the owner allowed: wolf orange, ember/ink,
// steel (x2), sand, and the two tinted tool backgrounds. Anything else in the
// theme must be a warm neutral.
const CHROMATIC = new Set([
  "#F28C28",
  "#E4572E",
  "#6E8FA6",
  "#93AEC3",
  "#C9B79B",
  "#151C22",
  "#241311",
]);

interface Theme {
  $schema: string;
  name: string;
  vars: Record<string, string>;
  colors: Record<string, string>;
  export: Record<string, string>;
}

interface PackageJson {
  pi?: { extensions?: string[]; themes?: string[]; theme?: unknown };
  files?: string[];
}

const EXPECTED_VARS: Record<string, string> = {
  bg: "#14110F",
  bgPanel: "#14110F",
  bgElement: "#1D1916",
  userMessageBg: "#28221E",
  bgSubtle: "#191512",
  surfaceLine: "#28221E",
  border: "#28221E",
  borderSubtle: "#38302A",
  text: "#D8D2C8",
  muted: "#8C8378",
  dim: "#6B635A",
  disabled: "#6B635A",
  accent: "#F28C28",
  blue: "#6E8FA6",
  secondary: "#93AEC3",
  heading: "#E3DCD0",
  syntaxComment: "#7C7469",
  syntaxKeyword: "#E4572E",
  syntaxFunction: "#F28C28",
  syntaxString: "#C9B79B",
  syntaxNumber: "#93AEC3",
  syntaxType: "#6E8FA6",
  syntaxPunctuation: "#A99F93",
  green: "#6E8FA6",
  warning: "#F28C28",
  red: "#E4572E",
  brightBlack: "#8C8378",
  brightGreen: "#93AEC3",
  brightYellow: "#F28C28",
  brightPurple: "#93AEC3",
  brightMagenta: "#E4572E",
  brightBlue: "#93AEC3",
  selection: "#38302A",
  toolSuccessBg: "#151C22",
  toolPendingBg: "#191512",
  toolErrorBg: "#241311",
  infoBg: "#191512",
};

// Upstream key order and targets, with the five deliberate accent remaps:
// accent / borderAccent / thinkingMedium / thinkingHigh / bashMode point at the
// wolf-orange `accent` var instead of upstream's `blue`.
const EXPECTED_COLORS: Record<string, string> = {
  accent: "accent",
  border: "border",
  borderAccent: "accent",
  borderMuted: "borderSubtle",
  success: "green",
  error: "red",
  warning: "warning",
  muted: "muted",
  dim: "dim",
  text: "text",
  thinkingText: "muted",
  selectedBg: "selection",
  userMessageBg: "userMessageBg",
  userMessageText: "text",
  customMessageBg: "bgSubtle",
  customMessageText: "text",
  customMessageLabel: "blue",
  toolPendingBg: "toolPendingBg",
  toolSuccessBg: "toolSuccessBg",
  toolErrorBg: "toolErrorBg",
  toolTitle: "blue",
  toolOutput: "text",
  mdHeading: "heading",
  mdLink: "blue",
  mdLinkUrl: "muted",
  mdCode: "green",
  mdCodeBlock: "text",
  mdCodeBlockBorder: "borderSubtle",
  mdQuote: "warning",
  mdQuoteBorder: "borderSubtle",
  mdHr: "muted",
  mdListBullet: "blue",
  toolDiffAdded: "green",
  toolDiffRemoved: "red",
  toolDiffContext: "muted",
  syntaxComment: "syntaxComment",
  syntaxKeyword: "syntaxKeyword",
  syntaxFunction: "syntaxFunction",
  syntaxVariable: "text",
  syntaxString: "syntaxString",
  syntaxNumber: "syntaxNumber",
  syntaxType: "syntaxType",
  syntaxOperator: "warning",
  syntaxPunctuation: "syntaxPunctuation",
  thinkingOff: "borderSubtle",
  thinkingMinimal: "dim",
  thinkingLow: "muted",
  thinkingMedium: "accent",
  thinkingHigh: "accent",
  thinkingXhigh: "secondary",
  bashMode: "accent",
};

let cachedTheme: Theme | undefined;

function theme(): Theme {
  if (cachedTheme === undefined) {
    cachedTheme = JSON.parse(readFileSync(THEME_URL, "utf8")) as Theme;
  }
  return cachedTheme;
}

function pkg(): PackageJson {
  return JSON.parse(readFileSync(PACKAGE_URL, "utf8")) as PackageJson;
}

/** Resolve a semantic key to a concrete #RRGGBB color through `vars`. */
function resolve(target: string): string {
  const vars = theme().vars ?? {};
  const value = vars[target] ?? target;
  assert.ok(
    typeof value === "string" && HEX.test(value),
    `colors target ${JSON.stringify(target)} did not resolve to a concrete color (got ${JSON.stringify(value)})`,
  );
  return value.toUpperCase();
}

test("theme parses as Fenrir with the upstream schema", () => {
  const t = theme();
  assert.equal(t.name, "Fenrir");
  assert.equal(t.$schema, UPSTREAM_SCHEMA);
});

test("vars expose exactly the 37 owner keys with the recorded values", () => {
  const vars = theme().vars;
  assert.equal(Object.keys(vars).length, 37);
  assert.deepEqual(Object.keys(vars).sort(), Object.keys(EXPECTED_VARS).sort());
  assert.deepEqual(vars, EXPECTED_VARS);
});

test("every semantic color resolves to a concrete value through vars", () => {
  const colors = theme().colors;
  assert.equal(Object.keys(colors).length, 51);
  for (const [key, target] of Object.entries(colors)) {
    const resolved = resolve(target);
    assert.ok(HEX.test(resolved), `colors.${key} -> ${target} is not a concrete color`);
  }
});

test("the colors map matches upstream verbatim apart from the accent remap", () => {
  const colors = theme().colors;
  assert.deepEqual(Object.keys(colors), Object.keys(EXPECTED_COLORS));
  assert.deepEqual(colors, EXPECTED_COLORS);
});

test("the owner palette anchors survive", () => {
  const vars = theme().vars;
  assert.equal(vars.accent, "#F28C28");
  assert.equal(vars.blue, "#6E8FA6");
  assert.equal(vars.green, "#6E8FA6");
  assert.equal(vars.red, "#E4572E");
  assert.equal(vars.warning, "#F28C28");
  assert.equal(vars.text, "#D8D2C8");
  assert.equal(vars.bg, "#14110F");
});

test("the wolf-orange accent owns the accent role, not steel", () => {
  const colors = theme().colors;
  for (const key of ["accent", "borderAccent", "thinkingMedium", "thinkingHigh", "bashMode"]) {
    assert.equal(resolve(colors[key]), "#F28C28", `colors.${key} should resolve to wolf orange`);
  }
  assert.equal(resolve(colors.toolTitle), "#6E8FA6");
  assert.equal(resolve(colors.mdLink), "#6E8FA6");
});

test("the export block resolves through vars and holds the recorded mapping", () => {
  const exp = theme().export;
  assert.deepEqual(exp, { pageBg: "bg", cardBg: "bgElement", infoBg: "infoBg" });
  for (const target of Object.values(exp)) {
    assert.ok(HEX.test(resolve(target)), `export target ${target} is not a concrete color`);
  }
});

test("no hue outside the recorded set leaks into the palette", () => {
  const vars = theme().vars;
  for (const [key, raw] of Object.entries(vars)) {
    const value = raw.toUpperCase();
    assert.ok(HEX.test(value), `vars.${key} is not a #RRGGBB color: ${raw}`);
    if (CHROMATIC.has(value)) continue;
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);
    assert.ok(
      r > g && g > b,
      `vars.${key} ${raw} is neither a recorded chromatic color nor a warm neutral with R > G > B`,
    );
  }
});

test("package.json ships the theme without auto-applying it", () => {
  const manifest = pkg();
  assert.deepEqual(manifest.pi?.themes, ["./themes"]);
  assert.ok(manifest.files?.includes("themes/"), "files must ship themes/");
  assert.equal("theme" in (manifest.pi ?? {}), false, "pi.theme must not auto-apply the theme");
});
