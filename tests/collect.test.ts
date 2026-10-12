import test from "node:test";
import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectPanelData } from "../lib/collect.ts";
import type { CollectDeps } from "../lib/collect.ts";

// Placeholder reported when git cannot describe the work tree.
const GIT_FALLBACK = "Not a git repo";

async function tempAgentDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "fenrir-collect-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

/** Real-fs injected deps; tests override individual hooks for failure paths. */
function deps(agentDir: string, overrides: Partial<CollectDeps> = {}): CollectDeps {
  return {
    agentDir,
    readFile: (path) => readFile(path, "utf8"),
    readdir: (path) => readdir(path),
    execFile: async (_file, args) => {
      if (args[1] === "--abbrev-ref") return { stdout: "main\n" };
      return { stdout: "abc1234\n" };
    },
    getCommands: () => [],
    getAllTools: () => [],
    version: "9.9.9",
    ...overrides,
  };
}

test("gitBranch reports the current branch name", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(deps(dir), "/work/repo");
  assert.equal(data.gitBranch, "main");
});

test("gitBranch reports detached@<short sha> on detached HEAD", async (t) => {
  const dir = await tempAgentDir(t);
  const calls: string[][] = [];
  const data = await collectPanelData(
    deps(dir, {
      execFile: async (_file, args) => {
        calls.push(args);
        if (args[1] === "--abbrev-ref") return { stdout: "HEAD\n" };
        if (args[1] === "--short") return { stdout: "a1b2c3d\n" };
        throw new Error(`unexpected git args: ${args.join(" ")}`);
      },
    }),
    "/work/repo",
  );
  assert.equal(data.gitBranch, "detached@a1b2c3d");
  assert.equal(calls.length, 2);
});

test("gitBranch degrades when execFile fails (not a repo, git missing, non-zero exit)", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(
    deps(dir, {
      execFile: async () => {
        throw new Error("git: command not found");
      },
    }),
    "/work/repo",
  );
  assert.equal(data.gitBranch, GIT_FALLBACK);
  assert.notEqual(data.gitBranch, "");
});

test("gitBranch degrades when detached sha lookup fails", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(
    deps(dir, {
      execFile: async (_file, args) => {
        if (args[1] === "--abbrev-ref") return { stdout: "HEAD\n" };
        throw new Error("rev-parse --short failed");
      },
    }),
    "/work/repo",
  );
  assert.equal(data.gitBranch, GIT_FALLBACK);
});

test("gitBranch degrades when output is empty", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(
    deps(dir, { execFile: async () => ({ stdout: "\n" }) }),
    "/work/repo",
  );
  assert.equal(data.gitBranch, GIT_FALLBACK);
});

test("cwd is reported verbatim", async (t) => {
  const dir = await tempAgentDir(t);
  const cwd = "/an/unusual/path with spaces/";
  const data = await collectPanelData(deps(dir), cwd);
  assert.equal(data.cwd, cwd);
});

test("mcpServers counts keys of <agentDir>/mcp.json mcpServers", async (t) => {
  const dir = await tempAgentDir(t);
  await writeFile(
    join(dir, "mcp.json"),
    JSON.stringify({ mcpServers: { alpha: {}, beta: { cmd: "x" }, gamma: {} } }),
    "utf8",
  );
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.mcpServers, 3);
});

test("mcpServers degrades to 0 when mcp.json is absent", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.mcpServers, 0);
});

test("mcpServers degrades to 0 on malformed JSON", async (t) => {
  const dir = await tempAgentDir(t);
  await writeFile(join(dir, "mcp.json"), "{ this is not json", "utf8");
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.mcpServers, 0);
});

test("mcpServers degrades to 0 when mcpServers is null", async (t) => {
  const dir = await tempAgentDir(t);
  await writeFile(join(dir, "mcp.json"), JSON.stringify({ mcpServers: null }), "utf8");
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.mcpServers, 0);
});

test("packages counts <agentDir>/settings.json packages array", async (t) => {
  const dir = await tempAgentDir(t);
  await writeFile(
    join(dir, "settings.json"),
    JSON.stringify({ packages: ["pkg-a", "pkg-b", "pkg-c"] }),
    "utf8",
  );
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.packages, 3);
});

test("packages degrades to 0 when packages is not an array", async (t) => {
  const dir = await tempAgentDir(t);
  await writeFile(
    join(dir, "settings.json"),
    JSON.stringify({ packages: "pkg-a" }),
    "utf8",
  );
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.packages, 0);
});

test("packages degrades to 0 when settings.json is absent", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.packages, 0);
});

test("packages degrades to 0 on malformed settings.json", async (t) => {
  const dir = await tempAgentDir(t);
  await writeFile(join(dir, "settings.json"), "not json at all", "utf8");
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.packages, 0);
});

test("agents counts .md files excluding sdd- entries", async (t) => {
  const dir = await tempAgentDir(t);
  const agentsDir = join(dir, "agents");
  await mkdir(agentsDir, { recursive: true });
  await writeFile(join(agentsDir, "reviewer.md"), "", "utf8");
  await writeFile(join(agentsDir, "planner.md"), "", "utf8");
  await writeFile(join(agentsDir, "sdd-implement.md"), "", "utf8");
  await writeFile(join(agentsDir, "notes.txt"), "", "utf8");
  await mkdir(join(agentsDir, "nested"), { recursive: true });
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.agents, 2);
});

test("agents degrades to 0 when the agents directory is absent", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.agents, 0);
});

test("agents degrades to 0 when readdir throws", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(
    deps(dir, {
      readdir: async () => {
        throw new Error("EACCES");
      },
    }),
    "/work",
  );
  assert.equal(data.agents, 0);
});

test("skills counts getCommands() entries with source skill", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(
    deps(dir, {
      getCommands: () => [
        { source: "skill" },
        { source: "skill" },
        { source: "command" },
        {},
        { source: undefined },
      ],
    }),
    "/work",
  );
  assert.equal(data.skills, 2);
});

test("skills degrades to 0 when getCommands throws", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(
    deps(dir, {
      getCommands: () => {
        throw new Error("host unavailable");
      },
    }),
    "/work",
  );
  assert.equal(data.skills, 0);
});

test("extensions counts declared pi.extensions across package manifests", async (t) => {
  const dir = await tempAgentDir(t);
  const npmDir = join(dir, "npm", "node_modules");
  await mkdir(join(npmDir, "pkg-a"), { recursive: true });
  await writeFile(
    join(npmDir, "pkg-a", "package.json"),
    JSON.stringify({ pi: { extensions: ["a.ts", "b.ts"] } }),
    "utf8",
  );
  await mkdir(join(npmDir, "@scope", "pkg-b"), { recursive: true });
  await writeFile(
    join(npmDir, "@scope", "pkg-b", "package.json"),
    JSON.stringify({ pi: { extensions: ["c.ts"] } }),
    "utf8",
  );
  // Missing manifest and malformed manifest must each contribute 0.
  await mkdir(join(npmDir, "pkg-bad"), { recursive: true });
  await writeFile(join(npmDir, "pkg-bad", "package.json"), "{broken", "utf8");
  await writeFile(
    join(dir, "settings.json"),
    JSON.stringify({
      packages: ["npm:pkg-a", "@scope/pkg-b", "pkg-missing", "pkg-bad"],
    }),
    "utf8",
  );
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.packages, 4);
  assert.equal(data.extensions, 3);
});

test("extensions degrades to 0 when settings.json is absent", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(deps(dir), "/work");
  assert.equal(data.extensions, 0);
});

test("version is reported verbatim", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(deps(dir, { version: "4.1.0-rc.1" }), "/work");
  assert.equal(data.version, "4.1.0-rc.1");
});

test("customTools excludes builtin and sdk sources", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(
    deps(dir, {
      getAllTools: () => [
        { sourceInfo: { source: "builtin" } },
        { sourceInfo: { source: "sdk" } },
        { sourceInfo: { source: "extension" } },
        {},
      ],
    }),
    "/work",
  );
  assert.equal(data.customTools, 2);
});

test("customTools degrades to 0 when getAllTools throws", async (t) => {
  const dir = await tempAgentDir(t);
  const data = await collectPanelData(
    deps(dir, {
      getAllTools: () => {
        throw new Error("host unavailable");
      },
    }),
    "/work",
  );
  assert.equal(data.customTools, 0);
});

test("collectPanelData never throws and degrades every field", async () => {
  const data = await collectPanelData(
    {
      agentDir: "/does/not/exist",
      readFile: async () => {
        throw new Error("ENOENT");
      },
      readdir: async () => {
        throw new Error("ENOENT");
      },
      execFile: async () => {
        throw new Error("git failed");
      },
      getCommands: () => {
        throw new Error("no host");
      },
      getAllTools: () => {
        throw new Error("no host");
      },
      version: "1.2.3",
    },
    "/work",
  );
  assert.deepEqual(data, {
    gitBranch: GIT_FALLBACK,
    cwd: "/work",
    mcpServers: 0,
    packages: 0,
    agents: 0,
    skills: 0,
    extensions: 0,
    version: "1.2.3",
    customTools: 0,
  });
});
