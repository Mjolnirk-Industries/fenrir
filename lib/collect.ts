// Pure collectors for the Fenrir info panel.
//
// Every external effect is injected through CollectDeps: no `node:fs`, no
// `child_process`, no ambient process access. collectPanelData must never throw
// or reject; each field degrades independently to its placeholder or zero.

import { join } from "node:path";

export interface PanelData {
  gitBranch: string;
  cwd: string;
  mcpServers: number;
  packages: number;
  agents: number;
  skills: number;
  extensions: number;
  version: string;
  customTools: number;
}

export interface CollectDeps {
  agentDir: string;
  readFile(path: string): Promise<string>;
  readdir(path: string): Promise<string[]>;
  execFile(file: string, args: string[], options: { cwd: string }): Promise<{ stdout: string }>;
  getCommands(): Array<{ source?: string }>;
  getAllTools(): Array<{ sourceInfo?: { source?: string } }>;
  version: string;
}

// Reported whenever git cannot describe the work tree; never the empty string.
const GIT_FALLBACK = "Not a git repo";

function safeString(read: () => unknown): string {
  try {
    const value = read();
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    return String(value);
  } catch {
    return "";
  }
}

async function readGitBranch(deps: CollectDeps, cwd: string): Promise<string> {
  try {
    const head = await deps.execFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
    const branch = safeString(() => head?.stdout).trim();
    if (branch.length === 0) return GIT_FALLBACK;
    if (branch !== "HEAD") return branch;
    try {
      const sha = await deps.execFile("git", ["rev-parse", "--short", "HEAD"], { cwd });
      const short = safeString(() => sha?.stdout).trim();
      return short.length > 0 ? `detached@${short}` : GIT_FALLBACK;
    } catch {
      return GIT_FALLBACK;
    }
  } catch {
    return GIT_FALLBACK;
  }
}

async function countMcpServers(deps: CollectDeps, agentDir: string): Promise<number> {
  try {
    const raw = await deps.readFile(join(agentDir, "mcp.json"));
    const cfg = JSON.parse(raw) as { mcpServers?: unknown } | null;
    const servers = (cfg?.mcpServers ?? {}) as Record<string, unknown>;
    return Object.keys(servers).length;
  } catch {
    return 0;
  }
}

async function readPackages(deps: CollectDeps, agentDir: string): Promise<unknown[]> {
  try {
    const raw = await deps.readFile(join(agentDir, "settings.json"));
    const cfg = JSON.parse(raw) as { packages?: unknown } | null;
    return Array.isArray(cfg?.packages) ? cfg.packages : [];
  } catch {
    return [];
  }
}

async function countAgents(deps: CollectDeps, agentDir: string): Promise<number> {
  try {
    const entries = await deps.readdir(join(agentDir, "agents"));
    return entries.filter(
      (name) => typeof name === "string" && name.endsWith(".md") && !name.startsWith("sdd-"),
    ).length;
  } catch {
    return 0;
  }
}

function countSkills(deps: CollectDeps): number {
  try {
    return deps.getCommands().filter((command) => command.source === "skill").length;
  } catch {
    return 0;
  }
}

function countCustomTools(deps: CollectDeps): number {
  try {
    return deps.getAllTools().filter(
      (tool) => !["builtin", "sdk"].includes(safeString(() => tool?.sourceInfo?.source)),
    ).length;
  } catch {
    return 0;
  }
}

// Mirrors the upstream spec resolver: strips `npm:`, keeps scoped names intact.
function packageNameFromSpec(spec: unknown): string | undefined {
  if (typeof spec !== "string") return undefined;
  const clean = spec.replace(/^npm:/, "");
  if (clean.startsWith("@")) {
    const parts = clean.split("@");
    return parts.length > 2 ? `@${parts[1]}` : clean;
  }
  return clean.split("@")[0] || undefined;
}

async function countExtensions(
  packages: readonly unknown[],
  deps: CollectDeps,
  agentDir: string,
): Promise<number> {
  const npmDir = join(agentDir, "npm", "node_modules");
  let count = 0;
  for (const spec of packages) {
    const name = packageNameFromSpec(spec);
    if (!name) continue;
    try {
      const raw = await deps.readFile(join(npmDir, name, "package.json"));
      const pkg = JSON.parse(raw) as { pi?: { extensions?: unknown } } | null;
      const extensions = pkg?.pi?.extensions;
      if (Array.isArray(extensions)) count += extensions.length;
    } catch {
      // Git-installed packages have no npm manifest; unreadable ones count 0.
    }
  }
  return count;
}

export async function collectPanelData(deps: CollectDeps, cwd: string): Promise<PanelData> {
  try {
    const agentDir = safeString(() => deps.agentDir);
    const version = safeString(() => deps.version);

    const [gitBranch, mcpServers, agents, packages] = await Promise.all([
      readGitBranch(deps, cwd),
      countMcpServers(deps, agentDir),
      countAgents(deps, agentDir),
      readPackages(deps, agentDir),
    ]);

    return {
      gitBranch,
      cwd,
      mcpServers,
      packages: packages.length,
      agents,
      skills: countSkills(deps),
      extensions: await countExtensions(packages, deps, agentDir),
      version,
      customTools: countCustomTools(deps),
    };
  } catch {
    // Belt-and-braces: the contract is that this function never throws.
    return {
      gitBranch: GIT_FALLBACK,
      cwd,
      mcpServers: 0,
      packages: 0,
      agents: 0,
      skills: 0,
      extensions: 0,
      version: "",
      customTools: 0,
    };
  }
}
